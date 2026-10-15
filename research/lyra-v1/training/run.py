"""Reproduce LYRA's training chain. Default: print commands without executing them."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
from artifacts import complete_stage, valid_torch

ROOT = Path(os.path.abspath(__file__)).parent
TEACHER_SHA256 = '3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9'


def stages():
    yield 'data/g1_teacher/complete.json', ['scripts/gen_teacher.py'], None
    yield 'runs/g1_deck/model.pt', ['src/train_g1.py', '--out', 'runs/g1_deck'], 'runs/g1_deck'
    yield 'data/dagger/meta.json', ['scripts/dagger.py', 'runs/g1_deck/model.pt', '5000'], None
    yield 'runs/g1x_X2/model.pt', [
        'src/train_g1.py', '--data', 'data/g1_teacher/teacher.trec', 'data/dagger/dagger.trec',
        '--d', '256', '--layers', '6', '--heads', '8', '--out', 'runs/g1x_X2'
    ], 'runs/g1x_X2'
    yield 'data/v0/train.npz', ['scripts/build_v0.py'], None
    yield 'runs/v0_value/model.pt', ['src/train_v0.py', '--out', 'runs/v0_value'], 'runs/v0_value'
    for k in range(1, 21):
        # Original V1..V6: 50% stale V0 targets. V7..V20: no mixing, Actor top-2 targets.
        data = ['scripts/value_iter.py', '--value', f'runs/v{k-1}_value/model.pt',
                '--k1', str(k), '--seed_base', str(1190000000 + 10000000 * k),
                '--games', '2000', '--parents', str(100000 if k <= 6 else 150000 if k <= 17 else 225000),
                '--per', '4', '--prec', 'tf32']
        if k >= 7:
            data += ['--no_mix', '--prune_actor', 'runs/g1x_X2/model.pt']
        yield f'data/v{k}/train.npz', data, None
        yield f'runs/v{k}_value/model.pt', [
            'src/train_v0.py', '--data', f'data/v{k}/train.npz',
            '--init', f'runs/v{k-1}_value/model.pt', '--lr', '3e-4',
            '--epochs', '4' if k >= 18 else '2', '--out', f'runs/v{k}_value'
        ], f'runs/v{k}_value'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='actually generate data and train on CUDA')
    parser.add_argument('--teacher', type=Path, help='uncompressed frozen VELA v4.2 hinge_k256_e1.bin')
    args = parser.parse_args()
    env = os.environ.copy()
    if args.execute:
        if not args.teacher:
            parser.error('--execute requires --teacher')
        teacher = Path(os.path.abspath(args.teacher))
        if not teacher.is_file() or hashlib.sha256(teacher.read_bytes()).hexdigest() != TEACHER_SHA256:
            parser.error('teacher must be the frozen VELA v4.2 model (see README)')
        if not (ROOT / 'kernel/dk.dll').is_file():
            parser.error('build kernel/dk.dll first (see README)')
        import torch
        if not torch.cuda.is_available() or not torch.cuda.is_bf16_supported():
            parser.error('a CUDA GPU with BF16 support is required by the original training code')
        env['LYRA_TEACHER_MODEL'] = str(teacher)
        env['FOR_DISABLE_CONSOLE_CTRL_HANDLER'] = '1'
    for marker, command, resume_dir in stages():
        if args.execute and complete_stage(ROOT, marker):
            print('SKIP', marker, flush=True)
            continue
        if args.execute and resume_dir and valid_torch(ROOT / resume_dir / 'ckpt.pt', checkpoint=True):
            command += ['--resume']
        invocation = [sys.executable, '-u', *command]
        print(subprocess.list2cmdline(invocation), flush=True)
        if args.execute:
            subprocess.run(invocation, cwd=ROOT, env=env, check=True)
            if not complete_stage(ROOT, marker):
                raise RuntimeError(f'Incomplete stage output: {marker}')
    if not args.execute:
        print('PLAN ONLY: no data generation or training was started.')


if __name__ == '__main__':
    main()
