# Model Reproduction Guide

[Research overview](../README.md) · [한국어](README.ko.md)

Version folders are under `research/`. Run commands from the repository root unless a section specifies otherwise.

What each model is and how it was evaluated is in the report in its folder (`report-ko.md`, Korean). This guide keeps only the procedures for rebuilding them.

## LYRA v2 — M₄₀ neural value model

Rebuilds M₄₀ (15.4M parameters, 384/8/8) from the [LYRA v2 report](../lyra-v2/report-ko.md). It reuses the LYRA v1 teacher, Actor and V₀ data, so first prepare the environment and teacher weights described in the LYRA v1 section below. An NVIDIA GPU with FP16 mixed precision is required.

The following command **prints the plan only**:

```sh
python research/lyra-v2/training/run.py
```

To train, pass the teacher file and `--execute`. The script first runs the LYRA v1 package stages for teacher data, G1, DAgger, the X2 Actor and the V₀ data (skipping completed stages), then trains a new 384/8/8 V₀ and V₁–V₄₀.

```sh
python research/lyra-v2/training/run.py --execute --teacher "D:/models/hinge_k256_e1.bin"
```

| Stage | Settings |
|---|---|
| V₀ | LYRA v1 V₀ data, 384/8/8, batch 2048, lr 1e-3, 2 epochs, seed 1, FP16 mixed precision |
| V₁–V₄₀ | 2,000 self-play games (seed `mix(1800000000 + 1000000*k + i)`, k = 0…39), 150,000 parents, 4 children per action, no V₀ target mixing, X2 top-2 backup, FP16 self-play and targets; 2 epochs at lr 3e-4 from the previous weights |

The final weights are written to `research/lyra-v2/training/runs/v40/model.pt`. The original study decided the extension with development evaluations during training; this procedure runs the selected path to V₄₀ and includes no evaluation.

Browser FP32 conversion converts the included fixed M₄₀ and checks its source hash. Use `--checkpoint` for retrained weights.

```sh
python research/lyra-v2/export.py
python research/lyra-v2/export.py --checkpoint research/lyra-v2/training/runs/v40/model.pt --out research/lyra-v2/output/retrained
```

GPU, CUDA, PyTorch and floating-point differences can change retraining results. Byte-identical retraining or identical scores are not guaranteed, and a full retraining run has not been verified.

## LYRA v1 — V₂₀ neural value model

Rebuilds V₂₀ from the [LYRA v1 report](../lyra-v1/report-ko.md). You can train without any existing LYRA checkpoint, or convert the included fixed V₂₀ checkpoint.

### Training without a checkpoint

Windows, MSYS2 UCRT64 g++ (C++20), NumPy and CUDA-enabled PyTorch are required. The original Actor training uses BF16, value-network training FP32, and value-iteration self-play and targets TF32, so use an NVIDIA GPU with BF16 and TF32 support. The original training code keeps whole datasets on the GPU and has no CPU-only path. Data, feature caches and intermediate checkpoints need substantial disk space.

No LYRA weights are needed, but **the initial VELA v4.2 Hinge teacher weights are.** Extract `hinge_k256_e1.bin` from the released `model.bin.gz` into a separate working directory. The extracted file is 91,179,876 bytes with SHA-256 `3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9`. To build VELA as well, follow the VELA v4.2 section below.

Add `C:/msys64/ucrt64/bin` to PATH and build the teacher kernel:

```powershell
g++ -std=c++20 -O3 -march=native -pthread -shared -static-libgcc -static-libstdc++ research/lyra-v1/training/kernel/dk.cpp -o research/lyra-v1/training/kernel/dk.dll
```

The following command **prints the plan only** and starts no data generation or training:

```sh
python research/lyra-v1/training/run.py
```

To train, pass the actual teacher path and `--execute`. Stage settings are in the [LYRA v1 report](../lyra-v1/report-ko.md#2-학습-경로).

```sh
python research/lyra-v1/training/run.py --execute --teacher "D:/models/hinge_k256_e1.bin"
```

Data and intermediate weights go to `training/data/` and `training/runs/`; the final weights are `training/runs/v20_value/model.pt`. The included fixed `model.pt` is never read or overwritten by training. Results, caches and intermediate checkpoints are written to temporary files and then replaced. On rerun, completed stages are skipped after checking NPZ/PyTorch integrity and teacher/DAgger record sizes, and training resumes only from a valid `ckpt.pt`. Damaged data or caches are regenerated; damaged checkpoints are not used. Create `training/runs/<stage>/PAUSE` to pause training. Interrupted teacher/DAgger/V₀ generation restarts; value-iteration targets resume from their save point.

Validation and progress logs are kept, but separate evaluation, candidate search and sealed-evaluation runners and the original experiment outputs are not included. The script runs the selected path to V₂₀ and does not repeat the original stop/continue decisions.

### Browser model conversion

Run with NumPy, PyTorch and ONNX installed. The original conversion used NumPy 2.4.0, PyTorch 2.11.0 and ONNX 1.23.2.

```sh
python research/lyra-v1/export.py
```

This converts the included fixed V₂₀ and checks its source hash. To convert retrained weights, pass them explicitly:

```sh
python research/lyra-v1/export.py --checkpoint research/lyra-v1/training/runs/v20_value/model.pt --out research/lyra-v1/output/retrained
```

The default output directory is `research/lyra-v1/output/`; change it with `--out`. The outputs are `lyra-v20-fp32.onnx`, `features.bin` and `assets.json`. `assets.json` records generation metadata only.

Converting the fixed checkpoint reproduces the current browser model's ONNX and feature SHA-256, array definitions and game rules. A full retraining run of the included pipeline has not been verified. GPU, CUDA, PyTorch and floating-point differences can change retraining results, so byte-identical retraining or identical scores are not guaranteed. Converting new weights does not replace the application or deployed model.

## VELA v4.2 — COMPACT100 Hinge

Rebuilds the frozen Hinge model from the [VELA v4.2 report](../vela-v4.2/report-ko.md). The original FULL100 table is not needed at runtime. The application's Hinge final-score predictor is a separately trained model; its training data is not in this package.

### FULL100 generation

Prepare Windows MSYS2 UCRT64 g++ (C++17/OpenMP), Python 3 and NumPy.

```powershell
New-Item -ItemType Directory -Force research/vela-v4.2/bin | Out-Null
g++ -std=c++17 -O3 -march=native -fopenmp -I research/vela-v4.2/include research/vela-v4.2/full100/solve-hands-full100.cpp -o research/vela-v4.2/bin/solve-hands.exe
./research/vela-v4.2/bin/solve-hands.exe 5 100 research/vela-v4.2/full100/model/full100 6
```

This is the full generation command: cap 5, $`r=0`$ through 100, not resumed from FULL48. The tier files alone need about 88 GiB, plus space for pair projection and compression intermediates. A complete rerun of this command has not been verified. `ready.json` records completed layers. A plain rerun overwrites the output, so use a new output directory.

### Selected Hinge generation path

These are expensive research reproduction commands and are not needed to use the downloadable runtime model. On Windows, add `C:/msys64/ucrt64/bin` to PATH first.

```powershell
g++ -std=c++20 -O3 -ffp-contract=off research/vela-v4.2/compression/src/action_train/study.cpp -o research/vela-v4.2/compression/src/action_train/study.exe
Copy-Item research/vela-v4.2/compression/src/action_train/study.exe research/vela-v4.2/compression/src/action_train/study_student.exe
Push-Location research/vela-v4.2/compression
try {
    python -c "from build_models import *; fit(False, {'unified_k192_t24': (192,24), 'unified_k256_t16': (256,16)}, 'unified')"
    python make_diagnostic_queries.py
    python quant_balance.py unified_k256_t16
    python collect_q.py
    python refine_actions.py
} finally { Pop-Location }
```

`make_diagnostic_queries.py` generates only the same fixed 20,000 value-diagnostic samples as the original. The selected file is `models/hinge_k256_e1.bin`. The meaning of each step and the validation conditions for regenerated models are in the [report](../vela-v4.2/report-ko.md#2-생성-경로).

## VELA v4.1 — COMPACT48

| Directory | Purpose |
|---|---|
| `vela-v4.1/full48/` | One-shot cap-5, horizon-48 table generator |
| `vela-v4.1/include/` | Required generator headers |
| `vela-v4.1/compression/src/` | Shared time/hand structure fitting and quantized export |

The selected output is `vela-v4.1/compression/models/quant_q6_k64_t12.bin` (37.68 MiB). Generation requires the FULL48 tables; the runtime uses only the compressed model. See the [native build guide](../../src/policies/vela/native/README.md) for WASM.

Run the following from the project root on Windows with MSYS2 UCRT64 g++, Python and NumPy. These commands generate the full model. The full generation commands have not been verified by a complete rerun. FULL48 tables alone occupy about 42.72 GiB, with additional space required for the final FP32 snapshot and compression intermediates.

```powershell
Push-Location research/vela-v4.1
try {
    New-Item -ItemType Directory -Force bin, compression/results | Out-Null
    g++ -std=c++17 -O3 -march=native -fopenmp -I include full48/solve-hands-full48.cpp -o bin/solve-hands.exe
    ./bin/solve-hands.exe 5 48 full48/model/full48 12
    python compression/src/analyze_low.py
    python compression/src/fit_shared.py 6
    '[]' | Set-Content -Encoding ascii compression/results/models.json
    python compression/src/export_quantized.py
} finally {
    Pop-Location
}
```

The original exporter also writes a T8 comparison candidate. The selected v4.1 file is T12. Linear algebra implementations can produce different bytes; regenerated models require value/action and policy-score validation.

See the [final research report](../vela-v4.1/report-ko.md). In 90,000 independent episode pairs, the candidate scored 1876.5108 versus FULL48's 1878.0848; the original noninferiority gate was not met. The noninferiority result applies to FULL48; H24+Four was the separate service baseline.

The package includes the FULL48 generator, shared-structure compression code and required headers. Only the input path in `common.py` was changed for this layout. The external figures and original research evidence cited in the report are not included in this repository.

Reference decoded model SHA-256: `261ed5f731511119391278ae8800597ded67dbb882808e06ba2633ee58a292dc`.

---

## VELA v1–v4 — Previous generation workflow

To generate the VELA-v4 models from scratch, use the generators from **V1, V3, and V4**. Do not use the V2 generator for this workflow.

### Required directories

| Directory | Purpose |
|---|---|
| `vela-v1/research/` | Compute DP4 values and generate `four-projected-24.bin` |
| `vela-v3/research/` | Compute DP5 values and export the H24 checkpoint |
| `vela-v4/research/` | Convert the H24 checkpoint to `h24.raw` |

Use all 16 files across these directories, including the headers and scripts.

### Generation steps

1. **V1:** Compile `four-project.cpp` and run it with horizon argument `24`. The output is `results/four-projected-24.bin`.
2. **V3:** Generate the DP5 tables with `build-model.sh`. Preserve the script's restart from the saved H2 values.
3. **V3:** Use `export-checkpoint.cpp` to export horizon `24`. Decompress and concatenate the resulting `*_part1.qdelta.gz` and `*_part2.qdelta.gz`, in that order, to create `h24.qdelta`.
4. **V4:** Run the executable compiled from `convert-checkpoint.cpp` with arguments `h24.qdelta h24.raw`.

The required final value tables are **`four-projected-24.bin` and `h24.raw`**. Place both files in the model location expected by the existing VELA-v4 runtime. The runtime itself is not included in this directory.

### Command example

Run the following in **Linux/WSL Bash**, starting from the repository root (the parent of `research/`). This example assumes a fresh output directory and the dependencies listed below are installed. It computes the full model. The `4` passed to `build-model.sh` selects four threads.

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

Compilation, model regeneration and game execution have not been verified for this generation procedure. Verify regenerated files against the reference models separately.
