"""Generate the fixed LYRA v2 (M40) FP32 model and browser feature assets on CPU.
Same conversion as ../lyra-v1/export.py (shared model.py and board.npz); only the network size and the source checkpoint differ."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import onnx
import torch

HERE = Path(__file__).resolve().parent
V1 = HERE.parent / 'lyra-v1'
sys.path.insert(0, str(V1))
from model import Board, Encoder, ValueNet  # noqa: E402

SOURCE_SHA256 = 'a1423ac38c60ee5a59d48b212880e402ede9f048d5920e26217395049d902f00'
D, LAYERS, HEADS = 384, 8, 8


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=HERE / 'output')
    parser.add_argument('--checkpoint', type=Path, help='convert an explicitly selected newly trained checkpoint')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    checkpoint = args.checkpoint if args.checkpoint is not None else HERE / 'model.pt'
    checkpoint_sha256 = sha(checkpoint)
    if args.checkpoint is None and checkpoint_sha256 != SOURCE_SHA256:
        raise ValueError('The checkpoint is not the fixed M40 model.')
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    with np.load(V1 / 'board.npz') as z:
        keys = ['N', 'LAND', 'ROLL', 'NEXT', 'ctype', 'cval', 'cap', 'idmap']
        board = Board(int(z['N']), *(z[key] for key in keys[1:])).to('cpu')
        rules = {key: z[key].tolist() for key in keys}
    value = ValueNet(board, d=D, layers=LAYERS, heads=HEADS).eval()
    state = torch.load(checkpoint, map_location='cpu', weights_only=True)
    value.load_state_dict(state['model'] if 'model' in state else state)
    encoder = Encoder(value).eval()
    target = args.out / 'lyra-m40-fp32.onnx'
    with torch.inference_mode():
        torch.backends.mha.set_fastpath_enabled(False)
        try:
            torch.onnx.export(
                encoder, (torch.zeros(3, 24, D), torch.zeros(3)), str(target),
                input_names=['tokens', 'base'], output_names=['value'],
                dynamic_axes={'tokens': {0: 'batch'}, 'base': {0: 'batch'}, 'value': {0: 'batch'}},
                opset_version=17, dynamo=False, do_constant_folding=True,
            )
        finally:
            torch.backends.mha.set_fastpath_enabled(True)
        onnx.checker.check_model(str(target))
        arrays = {
            'pos': value.pos.weight.numpy(), 'r': value.r_emb.weight.numpy(),
            'b': value.b_emb.weight.numpy(), 'act': value.act_emb.weight.numpy(),
            'gW': value.g_lin.weight.numpy(), 'gB': value.g_lin.bias.numpy(),
            'aW': value.a_lin.weight.numpy(), 'aB': value.a_lin.bias.numpy(),
            'g': value.g.weight.numpy(), 'land': board.land.astype(np.uint16),
            'weights': board.w[0].astype(np.float32), 'scal': board.scal,
            'cap': np.maximum(board.cap[1:], 1).astype(np.float32),
        }
        metadata, blob = {}, bytearray()
        for name, array in arrays.items():
            array = np.ascontiguousarray(array)
            while len(blob) % 8:
                blob.append(0)
            metadata[name] = dict(offset=len(blob), dtype=str(array.dtype), shape=list(array.shape), bytes=array.nbytes)
            blob.extend(array.tobytes())
    (args.out / 'features.bin').write_bytes(blob)
    assets = dict(arrays=metadata, rules=rules, model_sha256=checkpoint_sha256, d=D, layers=LAYERS, heads=HEADS,
                  onnx_sha256=sha(target), features_sha256=sha(args.out / 'features.bin'))
    (args.out / 'assets.json').write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps(dict(output=str(args.out), onnx_sha256=assets['onnx_sha256'],
                          features_sha256=assets['features_sha256'])))


if __name__ == '__main__':
    main()
