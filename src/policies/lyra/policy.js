const f = Math.fround;
export function branches(raw, R) {
  const classes = [...new Set([0, ...raw.slice(4, 4 + raw[3]).map(id => R.idmap[id])])].sort((a,b)=>a-b);
  const children=[], probabilities=[], offsets=[0];
  const make=(p,t,b,h,d)=>[p,t,b,h.length,...Array.from({length:5},(_,i)=>h[i]||0),d,+(t>=100&&!b)];
  for(const cls of classes){
    if(raw[10]) {children.push(raw.slice());probabilities.push(1);offsets.push(children.length);continue;}
    const hand=raw.slice(4,4+raw[3]);let id=0;
    if(cls){const slot=hand.findIndex(id=>R.idmap[id]===cls);if(slot<0)throw Error('Illegal class');id=hand.splice(slot,1)[0];}
    const landed=(t,b,code,prob)=>{
      const p=code&4095,deck=raw[9];
      if(!(code&4096)||hand.length===5){children.push(make(p,t,b,hand,deck));probabilities.push(prob);return;}
      const counts=new Int32Array(23),rep=new Int32Array(23);let n=0;
      for(let j=1;j<=30;j++)if(deck&(1<<(j-1))){counts[R.idmap[j]]++;rep[R.idmap[j]]=j;n++;}
      if(!n)throw Error('Empty deck');
      for(let cl=1;cl<=22;cl++)if(counts[cl]){
        let d=deck&~(1<<(rep[cl]-1));if(!d)d=0x3fffffff;
        children.push(make(p,t,b,[...hand,rep[cl]],d));probabilities.push(prob*counts[cl]/n);
      }
    };
    if(id&&R.ctype[cls]!==2){landed(raw[1],raw[2],R.ctype[cls]===3?R.NEXT[raw[0]]:R.LAND[raw[0]+R.cval[cls]+3],1);}
    else for(let sm=2;sm<=12;sm++){
      const ways=6-Math.abs(7-sm),dbl=+(!raw[2]&&sm%2===0),code=id?R.LAND[raw[0]+R.cval[cls]*sm+3]:R.ROLL[raw[0]*11+sm-2];
      if(ways-dbl)landed(raw[1]+(+!raw[2]),0,code,(ways-dbl)/36);
      if(dbl)landed(raw[1]+1,1,code,1/36);
    }
    offsets.push(children.length);
  }
  return {classes,children,probabilities,offsets};
}

export class Features {
  constructor(meta,buffer){
    this.meta=meta;this.d=meta.d??meta.arrays.pos.shape[1];this.rules=meta.rules;this.cache=new Map();this.A={};
    for(const [key,a] of Object.entries(meta.arrays))this.A[key]=new (a.dtype==='uint16'?Uint16Array:Float32Array)(buffer,a.offset,a.bytes/(a.dtype==='uint16'?2:4));
  }
  counts(raw){
    const hc=new Int32Array(22),dc=new Int32Array(22);let dn=0;
    for(let j=0;j<raw[3];j++)hc[this.rules.idmap[raw[4+j]]-1]++;
    for(let id=1;id<=30;id++)if(raw[9]&(1<<(id-1))){dc[this.rules.idmap[id]-1]++;dn++;}
    return {hc,dc,dn};
  }
  key(raw){const {hc,dc}=this.counts(raw);return [raw[0],raw[1],raw[2],raw[3],...hc,...dc].join(',');}
  position(p){
    if(this.cache.has(p)){const a=this.cache.get(p);this.cache.delete(p);this.cache.set(p,a);return a;}
    const {pos,land,weights}=this.A,d=this.d,a=new Float32Array(23*d);
    for(let cl=0;cl<23;cl++)for(let k=0;k<11;k++){
      const w=weights[cl*11+k],start=land[(p*23+cl)*11+k]*d;
      if(w===0)continue;
      for(let j=0;j<d;j++)a[cl*d+j]=f(a[cl*d+j]+f(pos[start+j]*w));
    }
    this.cache.set(p,a);if(this.cache.size>64)this.cache.delete(this.cache.keys().next().value);return a;
  }
  create(rows){
    const A=this.A,d=this.d,tokens=new Float32Array(rows.length*24*d),base=new Float32Array(rows.length);
    for(let i=0;i<rows.length;i++){
      const raw=rows[i],p=raw[0],r=Math.max(0,Math.min(100,100-raw[1])),b=raw[2],n=raw[3],{hc,dc,dn}=this.counts(raw),ap=this.position(p),off=i*24*d;
      const gfeatures=[f(n/5),f(dn/30)];
      base[i]=f(p+A.g[r*2+b]);
      for(let j=0;j<d;j++){
        let linear=0;for(let k=0;k<2;k++)linear=f(linear+f(A.gW[j*2+k]*gfeatures[k]));linear=f(linear+A.gB[j]);
        tokens[off+j]=f(f(f(A.pos[p*d+j]+A.r[r*d+j])+A.b[b*d+j])+linear);
      }
      for(let cl=0;cl<23;cl++){
        const k=cl-1,features=[A.scal[(p*23+cl)*2],A.scal[(p*23+cl)*2+1],cl?f(hc[k]/A.cap[k]):0,cl?+(hc[k]>0):0,cl?f(hc[k]/5):0,cl?f(dc[k]/A.cap[k]):0];
        for(let j=0;j<d;j++){
          let linear=0;for(let k=0;k<6;k++)linear=f(linear+f(A.aW[j*6+k]*features[k]));linear=f(linear+A.aB[j]);
          tokens[off+(cl+1)*d+j]=f(f(ap[cl*d+j]+A.act[cl*d+j])+linear);
        }
      }
    }
    return {tokens,base};
  }
}

export async function evaluate(raw,R,F,predict,options={}){
  const P=branches(raw,R),unique=[],back=[],seen=new Map();
  for(const child of P.children){
    if(child[10]){back.push(-1);continue;}
    const key=F.key(child);
    if(!seen.has(key)){seen.set(key,unique.length);unique.push(child);}
    back.push(seen.get(key));
  }
  const v=unique.length?await (options.predictStates?options.predictStates(unique):predict(F.create(unique),unique.length)):[];
  const values=P.children.map((c,i)=>back[i]<0?c[0]:Number(v[back[i]]));
  const q=P.classes.map((_,a)=>{let sum=0;for(let j=P.offsets[a];j<P.offsets[a+1];j++)sum+=P.probabilities[j]*values[j];return sum;});
  let best=0;for(let a=1;a<q.length;a++)if(q[a]>q[best])best=a;
  return {...P,values,q,best:P.classes[best],unique:unique.length};
}

export async function evaluateTwoStep(raw,R,F,predict,options={}){
  const P=branches(raw,R),states=[],stateIndex=new Map(),rootBack=[];
  for(const child of P.children){
    if(child[10]){rootBack.push(-1);continue;}
    const key=F.key(child);
    if(!stateIndex.has(key)){stateIndex.set(key,states.length);states.push(child);}
    rootBack.push(stateIndex.get(key));
  }
  const leaves=[],leafIndex=new Map();
  const plans=[];
  for(let i=0;i<states.length;i++){
    if(i%16===0)await options.checkpoint?.();
    const state=states[i];
    const plan=branches(state,R);
    const back=plan.children.map(child=>{
      if(child[10])return -1;
      const key=F.key(child);
      if(!leafIndex.has(key)){leafIndex.set(key,leaves.length);leaves.push(child);}
      return leafIndex.get(key);
    });
    plans.push({plan,back});
  }
  await options.checkpoint?.();
  const predicted=leaves.length?await (options.predictStates?options.predictStates(leaves):predict(F.create(leaves),leaves.length)):[];
  const middle=plans.map(({plan,back})=>{
    let best=-Infinity;
    for(let a=0;a<plan.classes.length;a++){
      let sum=0;
      for(let j=plan.offsets[a];j<plan.offsets[a+1];j++)
        sum+=plan.probabilities[j]*(back[j]<0?plan.children[j][0]:Number(predicted[back[j]]));
      if(sum>best)best=sum;
    }
    return best;
  });
  const values=P.children.map((child,j)=>rootBack[j]<0?child[0]:middle[rootBack[j]]);
  const q=P.classes.map((_,a)=>{
    let sum=0;for(let j=P.offsets[a];j<P.offsets[a+1];j++)sum+=P.probabilities[j]*values[j];return sum;
  });
  let best=0;for(let a=1;a<q.length;a++)if(q[a]>q[best])best=a;
  return {...P,values,q,best:P.classes[best],unique:leaves.length};
}
