#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
THREADS="${1:-4}"
MODEL="${2:-model/dp5}"
if [[ -d "$MODEL" && -n "$(ls -A "$MODEL")" ]]; then
  echo "Refusing to overwrite a non-empty model directory: $MODEL" >&2; exit 2
fi
mkdir -p "$MODEL" bin results
"${CXX:-g++}" -std=c++17 -O3 -fopenmp -ffp-contract=off research/solve-hands.cpp -o bin/solve-hands
# Reproduce the research run's single quantized restart at resource horizon 2.
./bin/solve-hands 5 2 "$MODEL" "$THREADS"
python3 research/set-horizon.py "$MODEL" 24
./bin/solve-hands 5 24 "$MODEL" "$THREADS" 2
