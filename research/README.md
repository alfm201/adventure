# VELA-v4 Value Table Generation Guide

English | [한국어](README.ko.md)

To generate the VELA-v4 models from scratch, use the generators from **V1, V3, and V4**. Do not use the V2 generator for this workflow.

## Required directories

| Directory | Purpose |
|---|---|
| `vela-v1/research/` | Compute DP4 values and generate `four-projected-24.bin` |
| `vela-v3/research/` | Compute DP5 values and export the H24 checkpoint |
| `vela-v4/research/` | Convert the H24 checkpoint to `h24.raw` |

Use all 16 files across these directories, including the headers and scripts.

## Generation steps

1. **V1:** Compile `four-project.cpp` and run it with horizon argument `24`. The output is `results/four-projected-24.bin`.
2. **V3:** Generate the DP5 tables with `build-model.sh`. Preserve the script's restart from the saved H2 values.
3. **V3:** Use `export-checkpoint.cpp` to export horizon `24`. Decompress and concatenate the resulting `*_part1.qdelta.gz` and `*_part2.qdelta.gz`, in that order, to create `h24.qdelta`.
4. **V4:** Run the executable compiled from `convert-checkpoint.cpp` with arguments `h24.qdelta h24.raw`.

The required final value tables are **`four-projected-24.bin` and `h24.raw`**. Place both files in the model location expected by the existing VELA-v4 runtime. The runtime itself is not included in this directory.

## Command example

Run the following in **Linux/WSL Bash**, starting from the repository root (the parent of `research/`). This example assumes a fresh output directory and the dependencies listed below are installed. It performs the full model computation; it is not a quick smoke test. The `4` passed to `build-model.sh` selects four threads.

```bash
(
  set -euo pipefail
  cd research

  # V1: DP4, horizon 24
  (
    cd vela-v1
    mkdir -p bin results
    g++ -std=c++17 -O3 -ffp-contract=off -fopenmp \
      research/four-project.cpp -o bin/four-project
    ./bin/four-project 24
  )

  # V3: DP5 with the H2 restart, then export H24
  (
    cd vela-v3
    bash research/build-model.sh 4
    g++ -std=c++17 -O3 -ffp-contract=off \
      research/export-checkpoint.cpp -o bin/export-checkpoint -lz
    ./bin/export-checkpoint model/dp5 24 model/checkpoint
    gzip -dc model/checkpoint_part1.qdelta.gz \
      model/checkpoint_part2.qdelta.gz > model/h24.qdelta
  )

  # V4: convert H24 and collect both runtime tables
  (
    cd vela-v4
    mkdir -p bin model
    g++ -std=c++17 -O3 -ffp-contract=off \
      research/convert-checkpoint.cpp -o bin/convert-checkpoint
    ./bin/convert-checkpoint ../vela-v3/model/h24.qdelta model/h24.raw
    cp ../vela-v1/results/four-projected-24.bin model/four-projected-24.bin
  )
)
```

Both final files will be in `research/vela-v4/model/`. V3 intermediates remain in `research/vela-v3/model/`. `build-model.sh` refuses to overwrite a non-empty `model/dp5/` directory; it is not a general interrupted-run recovery command.

## Environment and verification status

C++17, OpenMP, Python 3, Bash, and gzip are required. The V3 exporter uses POSIX mmap and zlib, so this workflow targets Linux/WSL.

No compilation, model recomputation, or execution was performed while assembling this package. Hash equality between regenerated and existing models still requires separate verification.
