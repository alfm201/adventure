import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_ID = 'vela-v4.3'

def update_manifest():
    directory = ROOT / 'public/models' / MODEL_ID
    packed = ROOT / 'public/models/vela-v4.2/model.bin.gz'   # v4.3 reuses the unchanged v4.2 model file and path
    data = gzip.decompress(packed.read_bytes())
    if hashlib.sha256(data).hexdigest() != '3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9':
        raise ValueError('The frozen VELA v4.2 Hinge model is required')
    chunk = 8388608
    manifest = dict(schemaVersion=1, id=MODEL_ID, name='VELA v4.3', version='v4.3-20261030',
                    file='../vela-v4.2/model.bin.gz', bytes=packed.stat().st_size, decodedBytes=len(data),
                    sha256=hashlib.sha256(packed.read_bytes()).hexdigest(),
                    decodedSha256=hashlib.sha256(data).hexdigest(), chunkBytes=chunk,
                    chunkHashes=[hashlib.sha256(data[i:i+chunk]).hexdigest() for i in range(0,len(data),chunk)],
                    referenceMeanScore=1878.6, referenceGames=20000,
                    recommendedMemoryBytes=400000000, scorePredictor=True)
    manifest['runtime'] = {}
    for key, ext in [('module','mjs'),('wasm','wasm')]:
        file = ROOT / f'src/policies/vela/vela.{ext}'
        manifest['runtime'][key] = dict(file=f'../../../src/policies/vela/vela.{ext}',
                                        bytes=file.stat().st_size, sha256=hashlib.sha256(file.read_bytes()).hexdigest())
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    update_manifest()
