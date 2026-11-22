import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_ID = 'vela-v5'
MODEL_FILENAME = f'{MODEL_ID}.bin.gz'
MODEL_SHA = '0b2b176f93b58f5f3496cd679897058723887d4fd6f8d2e571532e51d7afc581'
PREDICTOR_SHA = '9ba46993f6353bd527487bf9327ea4cdc505a0b5fa4112be8e37ceed4cd04c5c'


def pack_model(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != MODEL_SHA:
        raise ValueError('Unexpected VELA v5 model')
    directory = ROOT / 'public/models' / MODEL_ID
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / MODEL_FILENAME).open('wb') as stream:
        with gzip.GzipFile(filename='', mode='wb', fileobj=stream, mtime=0, compresslevel=9) as out:
            out.write(raw)


def update_manifest():
    directory = ROOT / 'public/models' / MODEL_ID
    if hashlib.sha256((directory / 'predictor.json').read_bytes()).hexdigest() != PREDICTOR_SHA:
        raise ValueError('Unexpected VELA v5 score predictor')
    packed = directory / MODEL_FILENAME
    data = gzip.decompress(packed.read_bytes())
    if hashlib.sha256(data).hexdigest() != MODEL_SHA:
        raise ValueError('The frozen VELA v5 model is required')
    chunk = 8388608
    manifest = dict(schemaVersion=1, id=MODEL_ID, name='VELA v5', version='v5-20261122',
                    file=MODEL_FILENAME, bytes=packed.stat().st_size, decodedBytes=len(data),
                    sha256=hashlib.sha256(packed.read_bytes()).hexdigest(),
                    decodedSha256=hashlib.sha256(data).hexdigest(), chunkBytes=chunk,
                    chunkHashes=[hashlib.sha256(data[i:i+chunk]).hexdigest() for i in range(0,len(data),chunk)],
                    referenceMeanScore=1880.669, referenceGames=20000,
                    recommendedMemoryBytes=1500000000, scorePredictor=True)
    manifest['runtime'] = {}
    for key, ext in [('module','mjs'),('wasm','wasm')]:
        file = ROOT / f'src/policies/vela/vela-v5.{ext}'
        manifest['runtime'][key] = dict(file=f'../../../src/policies/vela/vela-v5.{ext}',
                                        bytes=file.stat().st_size, sha256=hashlib.sha256(file.read_bytes()).hexdigest())
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    if len(sys.argv) == 1:
        update_manifest()
    elif len(sys.argv) == 3 and sys.argv[1] == '--pack':
        pack_model(Path(sys.argv[2]))
    else:
        raise SystemExit('Usage: delivery.py [--pack vela-v5.bin]')
