import argparse,json,re,os
from pathlib import Path
import numpy as np
from scipy.signal import lfilter
p=argparse.ArgumentParser()
p.add_argument('data',nargs='+');p.add_argument('--out',required=True);p.add_argument('--steps',type=int,default=4000);p.add_argument('--decay',type=float,default=.975);p.add_argument('--mc',type=float,default=.45);p.add_argument('--seed',type=int,default=5989);p.add_argument('--init');p.add_argument('--subtract-tv');p.add_argument('--position',action='store_true');p.add_argument('--hand-latent',action='store_true');p.add_argument('--export-only');p.add_argument('--updated',action='store_true')
args=p.parse_args();rng=np.random.default_rng(args.seed)
root=Path(__file__).resolve().parents[2]; base=root/'engine_probe/src/policies/vela/native'
txt=(base/'tables.hpp').read_text()
def table(name):
 return np.fromstring(re.search(r'(?:const int|constexpr int) '+name+r'\[\]=\{([^}]*)\}',txt).group(1),sep=',',dtype=np.int32)
ct,cv=table('CTYPE'),table('CVAL')
eff=list(dict.fromkeys(zip(ct[1:],cv[1:])));ids=np.array([0]+[eff.index(v)+1 for v in list(zip(ct[1:],cv[1:]))],dtype=np.int32)
capac=np.bincount(ids[1:],minlength=23)[1:].astype('f')
def geo_features():
 m=np.memmap(root/'finalrun/warm/r48.bin',dtype='f',mode='r');nrow=202*2899
 geo=m[1+nrow+80730*48:].reshape(202,2899,48)
 v=m[1:1+nrow].reshape(202,2899)
 pos=np.arange(2899);pfrac=pos/2898
 horizon=np.arange(202)//2;b=np.arange(202)%2;r=horizon[:,None]
 feat=[geo[:,:,:28]];take=[]
 for X in [np.broadcast_to(x,(202,2899)) for x in [r/100,np.sqrt(r+.1)/10,1/(1+r/4),b[:,None],pfrac,np.minimum(1,(2898-pos)/(1+r*18)),v-pos-18*r]]:
  take.append(X)
 for spread in [48,135,340,770,1600,4000]:
  take.extend([np.broadcast_to(np.sin(pos/spread),(202,2899)),np.broadcast_to(np.cos(pos/spread),(202,2899))])
 for A in [table('ROLL').reshape(2899,11)[:,5],table('NEXT')]+[table('LAND')[pos+3+c] for c in [-3,-1,1,3,5,8,11]]:
  land=A&4095;take.extend([np.broadcast_to((A&4096)!=0,(202,2899)),v[:,land]-v])
 feat.append(np.stack(take,axis=2));return np.concatenate(feat,axis=2).reshape(nrow,-1).astype('f')
G=geo_features()
hr48=np.memmap(root/'finalrun/warm/r48.bin','f',mode='r')[1+202*2899:1+202*2899+80730*48].reshape(80730,48)[:,:18]
def cardrank(cc):
 from scipy.special import comb
 X=np.sort(np.where(cc==0,30,cc),axis=1);n=np.sum(cc!=0,axis=1)
 B=comb(np.arange(29)[:,None],np.arange(7)[None,:]).round().astype('i')
 rank=np.where(n>0,B[22+n-1,np.maximum(n-1,0)],0)
 prev=np.ones(len(cc),'i')
 for j in range(5):
  ok=n>j;rem=n[ok]-j;cur=X[ok,j];rank[ok]+=B[22-prev[ok]+rem,rem]-B[22-cur+rem,rem];prev[ok]=cur
 return rank
dtype=np.dtype('i2,u1,u1,u1,(5,)u1,u2,u4,f4,u4'+(',f4,f4' if args.updated else ''))
def write_output(name,W,geo,position,handNorm=None):
 with open(name,'wb') as f:
  np.array([W[4].shape[0],48,20,len(geo)],'<i4').tofile(f)
  for a in [W[4][:76].T,W[5],W[6].T,W[7]]:a.astype('f').tofile(f)
  if handNorm is not None:
   lat=np.clip((hr48-handNorm[0])/handNorm[1],-6,6)
   (lat@W[4][76:]).astype('f').tofile(f)
  for i in range(0,len(geo),8192):
   idx=np.arange(i,min(i+8192,len(geo)));board=idx%2899
   out=np.maximum(geo[idx]@W[0]+W[1],0)@W[2]+W[3]
   if position is not None:
    decay=np.minimum(1,((idx//2899)//2+((idx//2899)%2))*.25)
    out+=position[board]*decay[:,None]
   (out*10).astype('f').tofile(f)
if args.export_only:
 saved=np.load(args.export_only)
 x=np.clip((G-saved['mean'])/saved['scale'],-6,6)
 write_output(args.out,[saved[str(i)] for i in range(8)],x,saved['position'] if 'position' in saved else None,saved['hnorm'] if 'hnorm' in saved else None)
 raise SystemExit
d=np.concatenate([np.fromfile(x,dtype=dtype) for x in args.data])
pid=(2*d['f1'].astype('i')+d['f2'])*2899+d['f0']
pos=d['f0'].astype(int); hand=d['f4'];deck=d['f6'];r=d['f1'];game=d['f8']
idm=ids[hand];hnorm=None
if args.hand_latent:
 ranks=np.empty(len(d),'i')
 for i in range(0,len(d),100000):ranks[i:i+100000]=cardrank(idm[i:i+100000])
 library=hr48[ranks[::37]];hnorm=np.stack([library.mean(0),np.maximum(library.std(0),.01)])
 handFeature=np.clip((hr48-hnorm[0])/hnorm[1],-6,6)
bits=np.arange(30,dtype=np.uint32)
def context(idx):
 h=idm[idx]; mask=deck[idx];n=len(idx); D=np.zeros((n,22),'f');H=D.copy()
 for i,c in enumerate(ids[1:]): D[:,c-1]+=(mask>>i)&1
 for i in range(5):
  c=h[:,i]; nz=c!=0; H[np.flatnonzero(nz),c[nz]-1]+=1
 dn=D.sum(1)[:,None];hn=d['f3'][idx,None].astype('f');de=D-dn*capac/30
 features=[H,de*5/(dn+1),de,np.eye(6,dtype='f')[hn[:,0].astype(int)],dn/30,1/(1+dn*.2),np.maximum(0,1-dn/10),np.sqrt(dn)/5.5]
 if args.hand_latent:features.append(handFeature[ranks[idx]])
 return np.column_stack(features).astype('f')
idx=np.arange(0,len(d),32)
gmean=G[pid[idx]].mean(0);gscale=np.maximum(G[pid[idx]].std(0),.1);G=np.clip((G-gmean)/gscale,-6,6)
if args.updated:
 inc=d['f7']+d['f9'];bias=d['f10']
else:inc=d['f7'];bias=0.
end=np.r_[np.where(game[:-1]!=game[1:])[0]+1,len(game)]
y=np.empty(len(d),'f')
at=0
for e in end:
 seg=inc[at:e][::-1];y[at:e]=args.mc*np.cumsum(seg)[::-1]+(1-args.mc)*lfilter([1],[1,-args.decay],seg)[::-1];at=e
y+=bias
if args.subtract_tv:y-=np.fromfile(args.subtract_tv,dtype='f')
split=end[int(len(end)*.94)-1]
val=rng.integers(split,len(d),22000)
# Residual is an inner product between nonlinear features of board/horizon and hand/deck.
H=context(np.arange(1));D=20;wh=48;wg=60
def wt(a,b,scale=1):return (rng.normal(size=(a,b))*np.sqrt(1/a)*scale).astype('f')
W=[wt(G.shape[1],wg),np.zeros(wg,'f'),wt(wg,D,.15),np.zeros(D,'f'),wt(H.shape[1],wh),np.zeros(wh,'f'),wt(wh,D),np.ones(D,'f')*.3]
def forward(g,h):
 ga=np.maximum(g@W[0]+W[1],0);go=ga@W[2]+W[3];ha=np.maximum(h@W[4]+W[5],0);ho=ha@W[6]+W[7];return ga,go,ha,ho
P=np.zeros((2899,D),'f')
def position_features(indices):
 return np.minimum(1,(r[indices].astype('f')+d['f2'][indices])*.25)[:,None]
def base_pred(indices):
 gg=G[pid[indices]];hh=context(indices);ga,go,ha,ho=forward(gg,hh);
 if args.position:go+=P[pos[indices]]*position_features(indices)
 return (go*ho).sum(1)*10
def update(ids,lr,t):
 g=G[pid[ids]];h=context(ids);ga,go,ha,ho=forward(g,h)
 if args.position:go+=P[pos[ids]]*position_features(ids)
 e=((go*ho).sum(1)-y[ids]/10)[:,None]/len(ids); dg=e*ho;dh=e*go;dag=(dg@W[2].T)*(ga>0);dah=(dh@W[6].T)*(ha>0)
 if args.position:
  # Position embeddings are sparse. Only visited squares receive a step.
  # The fixed inverse-frequency factor regularizes low-occupancy board tails.
  pp=pos[ids]; dd=dg*position_features(ids)
  np.add.at(P,pp,-lr*44*(dd*len(ids)+.008*P[pp]))
  np.clip(P,-.55,.55,out=P)
 grad=[g.T@dag,dag.sum(0),ga.T@dg,dg.sum(0),h.T@dah,dah.sum(0),ha.T@dh,dh.sum(0)]
 for i,x in enumerate(grad):
  M[i]*=.9;M[i]+=.1*x;V[i]*=.995;V[i]+=.005*x*x
  W[i]-=lr*np.sqrt(1-.995**t)/(1-.9**t)*M[i]/(np.sqrt(V[i])+1e-6)
M=[np.zeros_like(x) for x in W];V=[np.zeros_like(x) for x in W]
if args.init: 
 z=np.load(args.init)
 for i in range(len(W)):
  arr=z[str(i)];W[i][tuple(slice(0,k) for k in arr.shape)]=arr
 P=z['position'] if 'position' in z else P
best=1e9;hist=[]
for t in range(1,args.steps+1):
 update(rng.integers(0,split,1024),.0014*min(1,(args.steps-t)/(.7*args.steps)+.15),t)
 if t%200==0 or t==args.steps:
  pred=base_pred(val);rmse=np.sqrt(np.mean((pred-y[val])**2)).item()
  if rmse<best: best=rmse;saved=[x.copy() for x in W];psaved=P.copy()
  hist.append([t,rmse])
  if t%1000==0: print(t,rmse,flush=True)
W=saved;params={str(i):a for i,a in enumerate(W)};params.update(mean=gmean,scale=gscale)
if args.position:params['position']=psaved
if hnorm is not None:params['hnorm']=hnorm
np.savez(args.out+'.npz',**params);write_output(args.out,W,G,psaved if args.position else None,hnorm)
print(json.dumps(dict(n=len(d),episodes=len(end),val_rmse=best,baseline=float(np.sqrt(np.mean(y[val]**2))),hist=hist)))
