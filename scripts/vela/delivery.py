import hashlib
import json
from pathlib import Path


def update_manifest():
    root = Path(__file__).resolve().parents[2]
    path = root / 'public/models/vela-v4/manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    manifest.update(schemaVersion=1, name='VELA v4', version='v4-20260909')
    manifest['runtime'] = {}
    for key, extension in [('module', 'mjs'), ('wasm', 'wasm')]:
        file = root / f'src/policies/vela/vela.{extension}'
        manifest['runtime'][key] = {'file': f'../../../src/policies/vela/vela.{extension}',
                                   'bytes': file.stat().st_size,
                                   'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
    path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    update_manifest()
