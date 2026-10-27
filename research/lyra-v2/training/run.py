"""Reproduce LYRA v2 (M40): the LYRA v1 teacher/Actor/V0-data stages, then a new 384/8/8 value network trained from V0
for 40 rounds with one fixed recipe. Uses the shared training code in ../../lyra-v1/training. Default: print commands without executing them."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(os.path.abspath(__file__)).parent
V1 = (HERE / '..' / '..' / 'lyra-v1' / 'training').resolve()
sys.path.insert(0, str(V1))
from artifacts import complete_stage, valid_torch  # noqa: E402
import run as v1  # noqa: E402

SIZE = ['--d', '384', '--layers', '8', '--heads', '8', '--amp', 'fp16']


def rel(path):
    return os.path.relpath(HERE / path, V1).replace(os.sep, '/')


def stages():
    for marker, command, resume_dir in v1.stages():   # teacher, G1, DAgger, X2 Actor, V0 data (shared with LYRA v1)
        yield marker, command, resume_dir
        if marker == 'data/v0/train.npz':
            break
    yield rel('runs/v0/model.pt'), ['src/train_v0.py', '--data', 'data/v0/train.npz', '--lr', '1e-3', '--epochs', '2', *SIZE,
                                     '--out', rel('runs/v0')], rel('runs/v0')
    for k in range(40):   # V1..V40: self-play seeds mix(1.8B + 1M*k + i), no V0 mixing, X2 top-2 targets, fp16 self-play and targets
        yield rel(f'data/v{k + 1}/train.npz'), [
            'scripts/value_iter.py', '--value', rel(f'runs/v{k}/model.pt'), '--k1', str(k + 1), '--out', rel(f'data/v{k + 1}'),
            '--seed_base', str(1800000000 + 1000000 * k), '--games', '2000', '--parents', '150000', '--per', '4',
            '--no_mix', '--prune_actor', 'runs/g1x_X2/model.pt', '--prec', 'fp16'], None
        yield rel(f'runs/v{k + 1}/model.pt'), [
            'src/train_v0.py', '--data', rel(f'data/v{k + 1}/train.npz'), '--init', rel(f'runs/v{k}/model.pt'),
            '--lr', '3e-4', '--epochs', '2', *SIZE, '--out', rel(f'runs/v{k + 1}')], rel(f'runs/v{k + 1}')


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
        if not teacher.is_file() or hashlib.sha256(teacher.read_bytes()).hexdigest() != v1.TEACHER_SHA256:
            parser.error('teacher must be the frozen VELA v4.2 model (see the reproduction guide)')
        if not (V1 / 'kernel/dk.dll').is_file():
            parser.error('build ../../lyra-v1/training/kernel/dk.dll first (see the reproduction guide)')
        import torch
        if not torch.cuda.is_available() or not torch.cuda.is_bf16_supported():
            parser.error('a CUDA GPU with BF16 and FP16 support is required by the original training code')
        env['LYRA_TEACHER_MODEL'] = str(teacher)
        env['FOR_DISABLE_CONSOLE_CTRL_HANDLER'] = '1'
    for marker, command, resume_dir in stages():
        if args.execute and complete_stage(V1, marker):
            print('SKIP', marker, flush=True)
            continue
        if args.execute and resume_dir and valid_torch(V1 / resume_dir / 'ckpt.pt', checkpoint=True):
            command += ['--resume']
        invocation = [sys.executable, '-u', *command]
        print(subprocess.list2cmdline(invocation), flush=True)
        if args.execute:
            subprocess.run(invocation, cwd=V1, env=env, check=True)
            if not complete_stage(V1, marker):
                raise RuntimeError(f'Incomplete stage output: {marker}')
    if not args.execute:
        print('PLAN ONLY: no data generation or training was started.')


if __name__ == '__main__':
    main()
