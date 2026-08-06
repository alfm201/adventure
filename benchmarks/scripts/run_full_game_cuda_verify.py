#!/usr/bin/env python3
"""Benchmark-facing wrapper for CUDA/PyTorch full-game verification.

This keeps CUDA benchmark invocations beside the existing browser/WebGPU runner
while delegating implementation to tests/qstar_policy/scripts/cuda_full_game_verify.py.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CUDA_RUNNER = ROOT / "tests/qstar_policy/scripts/cuda_full_game_verify.py"
DEFAULT_PY = ROOT / "tests/qstar_policy/.venv-cuda/bin/python"
RESULTS = ROOT / "tests/qstar_policy/results"
DEFAULT_POLICIES = ",".join([
    "i10k_rollout_chooseAction_v2",
    "i50k_b50_max100_rollout_chooseAction_v2",
    "i100k_b200_max100_rollout_x36_distribution_v1",
])


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--episodes", type=int, default=int(os.environ.get("FULL_GAME_EPISODES", "30")))
    p.add_argument("--seed-base", type=int, default=int(os.environ.get("FULL_GAME_SEED", "30")))
    p.add_argument("--replicate", type=int, default=int(os.environ.get("FULL_GAME_REPLICATE", "0")))
    p.add_argument("--policies", default=os.environ.get("FULL_GAME_POLICIES", DEFAULT_POLICIES))
    p.add_argument("--rollouts", type=int, default=int(os.environ["FULL_GAME_ROLLOUTS"]) if os.environ.get("FULL_GAME_ROLLOUTS") else None)
    p.add_argument("--rollouts-scale", type=float, default=float(os.environ.get("FULL_GAME_ROLLOUTS_SCALE", "1.0")))
    p.add_argument("--max-rollout-steps", type=int, default=int(os.environ.get("FULL_GAME_MAX_STEPS", "513")))
    p.add_argument("--max-decisions", type=int, default=int(os.environ.get("FULL_GAME_MAX_DECISIONS", "700")))
    p.add_argument("--decision-strategy", choices=["rollout", "continuation_only"], default=os.environ.get("FULL_GAME_DECISION_STRATEGY", "rollout"))
    p.add_argument("--decision-progress-interval", type=int, default=int(os.environ.get("FULL_GAME_DECISION_PROGRESS_INTERVAL", "25")))
    p.add_argument("--device", default=os.environ.get("FULL_GAME_CUDA_DEVICE", "cuda"))
    p.add_argument("--run-id", default=os.environ.get("FULL_GAME_RUN_ID") or time.strftime("cuda_verify_%Y%m%d_%H%M%S"))
    p.add_argument("--out", type=Path, default=None)
    p.add_argument("--python", default=str(DEFAULT_PY if DEFAULT_PY.exists() else Path(sys.executable)))
    return p.parse_args()


def main() -> int:
    args = parse_args()
    RESULTS.mkdir(parents=True, exist_ok=True)
    out = args.out or RESULTS / f"cuda_full_game_verify_{args.episodes}ep_{args.run_id}.json"
    cmd = [
        args.python, "-u", str(CUDA_RUNNER),
        "--episodes", str(args.episodes),
        "--seed-base", str(args.seed_base),
        "--replicate", str(args.replicate),
        "--policies", args.policies,
        "--rollouts-scale", str(args.rollouts_scale),
        "--max-rollout-steps", str(args.max_rollout_steps),
        "--max-decisions", str(args.max_decisions),
        "--decision-strategy", args.decision_strategy,
        "--decision-progress-interval", str(args.decision_progress_interval),
        "--device", args.device,
        "--out", str(out),
    ]
    if args.rollouts is not None:
        cmd.extend(["--rollouts", str(args.rollouts)])
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=str(ROOT))


if __name__ == "__main__":
    raise SystemExit(main())
