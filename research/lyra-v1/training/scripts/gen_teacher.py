"""Generate Hinge 2-step teacher decisions for Actor and initial value training."""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path(os.path.abspath(__file__)).parents[1]
sys.path.insert(0, str(ROOT / 'kernel'))
sys.path.insert(0, str(ROOT))
from artifacts import atomic_path, save_json
from dk import Kernel


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--games', type=int, default=100000)
    args = parser.parse_args()
    out = ROOT / 'data/g1_teacher'
    out.mkdir(parents=True, exist_ok=True)
    kernel = Kernel(threads=10)
    with atomic_path(out / 'teacher.trec') as temporary:
        games, bad = kernel.teacher_games(960000000, args.games, mode=1,
                                         recpath=str(temporary), chunk=2000)
        if bad:
            raise RuntimeError(f'Teacher label violations: {bad}')
    save_json(out / 'complete.json', dict(
        games=args.games, seed_base=960000000, decisions=int(games[:, 2].sum())
    ))


if __name__ == '__main__':
    main()
