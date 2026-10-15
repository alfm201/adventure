# Model Reproduction Guide

English | [한국어](README.ko.md)

## LYRA v1 — V₂₀ neural value model

The [LYRA package](lyra-v1/README.md) contains the V₂₀ training chain, board data, frozen checkpoint and browser FP32 conversion code. Training can start without LYRA checkpoints; the frozen VELA v4.2 teacher weights are a separate prerequisite. The application uses the π₂₀ 1-step policy.

## VELA v4.2 — COMPACT100 Hinge

The current model uses frozen Hinge epoch 1, horizon 100, 2-step expectimax and actual remaining deck with DeckPotential beta=0.6. The minimal FULL100 generator (one C++ file and three headers), compression/training dependencies, commands and final result summaries are in [the v4.2 package](vela-v4.2/README.md). The original FULL100 table is not needed at runtime. The separate Hinge score predictor is connected in the application runtime; predictor training data is not part of this value-model research package.

## VELA v4.1 — COMPACT48

| Directory | Purpose |
|---|---|
| `vela-v4.1/full48/` | One-shot cap-5, horizon-48 table generator |
| `vela-v4.1/include/` | Required generator headers |
| `vela-v4.1/compression/src/` | Shared time/hand structure fitting and quantized export |

The selected output is `vela-v4.1/compression/models/quant_q6_k64_t12.bin` (37.68 MiB). FULL48 tables are required for generation, not runtime. The WASM build guide is in [native](../src/policies/vela/native/README.md).

Run the following from the project root on Windows with MSYS2 UCRT64 g++, Python and NumPy. These commands perform full model generation; they were not rerun when packaging these sources. FULL48 tables alone occupy about 42.72 GiB, with additional space required for the final FP32 snapshot and compression intermediates.

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

See the [final research report](vela-v4.1/report-ko.md). In 90,000 independent paired games, the candidate scored 1876.5108 versus FULL48's 1878.0848; the original noninferiority gate was not met. This comparison is against FULL48, not the deployed H24+Four model.

Sources: `adventure_vela/research/full_hand_dp/oneshot_full48_20260927/` (generator), `adventure_vela/research/value_compression/full48_shared_structure_v1_20260927/` (compression/report), and `adventure_vela/bak/legacy_20260926/S2_20260919_RDC/vendor/research/` (headers). Only the input path in `common.py` was adjusted for this layout. Report figure embeds and machine-local links are represented as text; original evidence remains in the source research directory.

Reference decoded model SHA-256: `261ed5f731511119391278ae8800597ded67dbb882808e06ba2633ee58a292dc`.

---

## VELA v1–v4 — Previous generation workflow

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
