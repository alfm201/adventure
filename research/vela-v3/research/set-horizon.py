"""Extend only the declared horizon of a complete short-prefix model."""
import json,pathlib,struct,sys
root=pathlib.Path(sys.argv[1]);new=int(sys.argv[2]);ready=json.loads((root/'ready.json').read_text())
old=ready['horizon'];cap=ready['cap']
if new<=old or ready['completed_layer']!=2*old+1:raise SystemExit('Expected a complete shorter model')
for n in range(cap+1):
 p=root/f'tier{n}{".i16" if n else ".f32"}'
 with p.open('r+b') as f:
  hdr=list(struct.unpack('<8i',f.read(32)))
  if hdr[0]!=0x33545341 or hdr[2]!=old or hdr[4]!=cap or hdr[5]!=n:raise SystemExit('Unexpected tier header')
  size=32+2*(old+1)*(hdr[3]+1)*hdr[6]*(2 if n else 4)
  if p.stat().st_size!=size:raise SystemExit('Incomplete or excessive tier prefix')
  f.seek(8);f.write(struct.pack('<i',new))
with (root/'pair.bin').open('r+b') as f:
 if struct.unpack('<i',f.read(4))[0]!=old:raise SystemExit('Unexpected pair header')
 f.seek(0);f.write(struct.pack('<i',new))
ready['horizon']=new;(root/'ready.json').write_text(json.dumps(ready))
