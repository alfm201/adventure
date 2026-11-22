"""Compress the published Hinge factors into a machine-friendly rank-k lookup."""
from pathlib import Path
import argparse
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('model')
ap.add_argument('out')
ap.add_argument('--rank',type=int,default=48)
args=ap.parse_args()
with open(args.model, 'rb') as f:
    def read(dtype,n):
        a=np.fromfile(f,dtype=dtype,count=n)
        if len(a)!=n: raise ValueError('truncated file')
        return a
    hdr=read('<i4',8)
    assert hdr.tolist()==[0x56435332,100,2899,0,256,16,0,0]
    base=read('<f4',101*2*2899).reshape(101,2,2899)
    _=read('<f4',1)
    scale=read('<f4',1)[0]
    phi=read('<i2',80730*256).reshape(80730,256).astype('f')*scale
    time=read('<f4',101*16).reshape(101,16)
    scale=read('<f4',1)[0]
    g=read('<i2',2*2899*256*16).reshape(2,2899,256,16).astype('f')*scale
    assert not f.read(1)
k=args.rank
if k==256:
    hand=phi; g_reduced=g
else:
    rng=np.random.default_rng(198100)
    # Balance hand sizes in the approximation of the score-space norm.
    handids=np.concatenate([rng.integers(l,h,4096) for l,h in zip([1,23,276,2300,14950],[23,276,2300,14950,80730])])
    sample=phi[handids].astype('d')
    w,u=np.linalg.eigh(sample.T@sample/len(sample))
    w=np.maximum(w,w.max()*1.e-10)
    M=u*np.sqrt(w)
    sample_r=rng.integers(0,101,24000)
    sample_b=rng.integers(0,2,24000)
    sample_p=rng.integers(1,2899,24000)
    x=np.empty((len(sample_r),256),'f')
    for i in range(0,len(x),200):
        sl=slice(i,i+200)
        x[sl]=np.einsum('ijkt,it->ijk',g[sample_b[sl],sample_p[sl]][:,None,:,:],time[sample_r[sl]])[:,0,:]
    weighted=x.astype('d')@M
    ev,v=np.linalg.eigh(weighted.T@weighted)
    P=v[:,::-1][:,:k]
    base_project=(M@P).astype('f')
    hand_project=((u/np.sqrt(w))@P).astype('f')
    hand=phi@hand_project
    g_reduced=(g.transpose(0,1,3,2)@base_project).transpose(0,1,3,2).copy()
    print('retained weighted norm',ev[-k:].sum()/ev.sum(),flush=True)
# Board value factors for all horizons, calculated once.
with open(args.out,'wb') as f:
    np.array([k],'<i4').tofile(f)
    base.astype('<f4').tofile(f)
    hand.astype('<f4').tofile(f)
    for t in time:
        vals=g_reduced.reshape(-1,16)@t
        vals.astype('<f4').tofile(f)
print(Path(args.out).stat().st_size,flush=True)
