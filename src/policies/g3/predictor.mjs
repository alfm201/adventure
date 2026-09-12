// Runtime dependencies: this module and model.json only.
export function features(state,env){
 const {position:p,diceUsed:t,bonusRoll:b,hand,deckAvailable:deck}=state;
 if(!Number.isInteger(p)||p<1||p>env.boardSize||!Number.isInteger(t)||t<0||t>100)throw Error('Invalid position or diceUsed');
 if(typeof b!=='boolean'||!Number.isInteger(deck)||deck<1||deck>0x3fffffff||!Array.isArray(hand)||hand.length>5||hand.some(c=>!Number.isInteger(c)||c<1||c>30))throw Error('Invalid bonus, hand or remaining deck');
 if(state.rulesVersion!==undefined&&state.rulesVersion!==env.rulesVersion)throw Error('Incompatible rules version');
 const n=env.classes.length,hc=Array(n).fill(0),dc=Array(n).fill(0);
 for(const c of hand)hc[env.classOf[c]]++;
 for(let i=0;i<30;i++)if(deck&(1<<i))dc[env.classOf[i+1]]++;
 const geo=env.geometry[p],gains=geo.slice(9,31),deckn=dc.reduce((a,b)=>a+b,0);
 let handmax=geo[6],handtotal=0,decktotal=0;
 for(let i=0;i<n;i++){if(hc[i])handmax=Math.max(handmax,gains[i]);handtotal+=hc[i]*gains[i];decktotal+=dc[i]*gains[i];}
 const x=[100-t,p,+b,hand.length,deckn,...hc,...dc,...geo,handmax,handtotal,decktotal/deckn];
 for(let j=0;j<(env.lookaheadHorizons||[]).length;j++){
  const base=31+24*j,cg=geo.slice(base+2,base+24);let best=geo[base+1],total=0;
  for(let i=0;i<n;i++){if(hc[i])best=Math.max(best,cg[i]);total+=hc[i]*cg[i];}x.push(best,total);
 }
 return x.map(Math.fround);
}

export function createPredictor(model){
 if(model.format!=='g3-state-only-v5')throw Error('Unsupported model format');
 return function predict(state){
  const x=features(state,model.environment);
  if(state.diceUsed===100&&!state.bonusRoll)return state.position;
  if(state.diceUsed===100&&state.bonusRoll&&state.hand.length===0)return x[1]+x[55];
  const c=model.trend,linear=x[1]+c[0]+c[1]*x[0]+c[2]*x[2],cache=new Map();let result=0;
  for(const member of model.members){
   let value=linear;
   if(member.forest!==null){
    if(!cache.has(member.forest)){
     const forest=model.forests[member.forest];let v=linear+forest.baseline;
     for(const tree of forest.trees){let node=0;while(tree.feature[node]>=0)node=x[tree.feature[node]]<=tree.threshold[node]?tree.left[node]:tree.right[node];v+=tree.value[node];}
     cache.set(member.forest,Math.max(1,Math.min(model.environment.boardSize,v)));
    }value=cache.get(member.forest);
   }
   if(member.neural){
    const m=member.neural;let z=[...x,Math.fround(value-linear)].map((v,i)=>Math.fround(Math.fround(v-m.mean[i])/m.scale[i]));
    for(const layer of m.layers)z=layer.weight.map((row,i)=>{let v=layer.bias[i];for(let j=0;j<row.length;j++)v+=row[j]*z[j];return Math.tanh(v);});
    value+=m.limit*z[0];
   }
   result+=member.weight*Math.max(1,Math.min(model.environment.boardSize,value));
  }
  return Math.max(1,Math.min(model.environment.boardSize,result));
 };
}
