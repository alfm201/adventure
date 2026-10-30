# 모델 재현 가이드

[연구 전체 흐름](../README.ko.md) · [English](README.md)

버전별 폴더는 `research/` 아래에 있습니다. 별도 표시가 없으면 명령은 저장소 루트에서 실행합니다.

각 모델이 무엇인지와 평가 결과는 모델 폴더의 보고서(`report-ko.md`)에 있고, 이 문서에는 다시 만드는 절차만 둡니다.

## LYRA v2 — M₄₀ 신경망 가치 모델

[LYRA v2 보고서](../lyra-v2/report-ko.md)의 M₄₀(15.4M, 384/8/8)을 다시 만드는 절차입니다. LYRA v1과 같은 교사·Actor·V₀ 자료를 쓰므로, 아래 LYRA v1 절의 환경과 교사 가중치를 먼저 준비합니다. FP16 혼합정밀도를 지원하는 NVIDIA GPU가 필요합니다.

아래 명령은 **계획 출력만** 합니다.

```sh
python research/lyra-v2/training/run.py
```

실제 학습은 교사 파일 경로와 `--execute`를 지정합니다. LYRA v1 패키지의 교사 데이터·G1·DAgger·X2 Actor·V₀ 자료 단계를 먼저 실행하고(이미 있으면 건너뜀), 이어서 새 384/8/8 가치망의 V₀와 V₁–V₄₀을 만듭니다.

```sh
python research/lyra-v2/training/run.py --execute --teacher "D:/models/hinge_k256_e1.bin"
```

| 단계 | 설정 |
|---|---|
| V₀ | LYRA v1의 V₀ 학습 자료, 384/8/8, batch 2048, lr 1e-3, 2 epoch, seed 1, FP16 혼합정밀도 |
| V₁–V₄₀ | self-play 2,000게임(seed `mix(1800000000 + 1000000*k + i)`, k = 0…39), 부모 150,000개, 행동당 자식 4개, V₀ 정답 혼합 없음, X2 상위 2개 backup, self-play·정답 계산 FP16. 직전 가중치에서 lr 3e-4, 2 epoch |

최종 가중치는 `research/lyra-v2/training/runs/v40/model.pt`에 생성됩니다. 원본 연구는 반복 도중 개발 평가로 연장 여부를 정했지만, 이 절차는 선택된 V₄₀까지의 경로를 고정해 실행하며 평가는 포함하지 않습니다.

브라우저용 FP32 변환은 다음과 같습니다. 포함된 고정 M₄₀을 변환하고 원본 해시를 확인합니다. 새로 학습한 가중치는 `--checkpoint`로 지정합니다.

```sh
python research/lyra-v2/export.py
python research/lyra-v2/export.py --checkpoint research/lyra-v2/training/runs/v40/model.pt --out research/lyra-v2/output/retrained
```

GPU·CUDA·PyTorch·부동소수점 차이로 재학습 결과가 달라질 수 있습니다. 학습부터의 바이트 동일 재현이나 동일 점수를 보증하지 않으며, 전체 재학습 검증은 수행하지 않았습니다.

## LYRA v1 — V₂₀ 신경망 가치 모델

[LYRA v1 보고서](../lyra-v1/report-ko.md)의 V₂₀을 다시 만드는 절차입니다. 기존 LYRA 체크포인트 없이 학습을 시작하거나, 포함된 고정 V₂₀ 체크포인트를 변환할 수 있습니다.

### 체크포인트 없이 학습

Windows, MSYS2 UCRT64 g++(C++20), NumPy와 CUDA 지원 PyTorch가 필요합니다. 원본 Actor 학습은 BF16, 가치망 학습은 FP32, 가치 반복의 self-play·정답 생성은 TF32를 사용하므로 BF16·TF32를 지원하는 NVIDIA GPU를 준비합니다. 원본 학습 코드는 데이터 전체를 GPU에 올리며, CPU 전용 학습 경로는 포함하지 않습니다. 데이터·특징 캐시·중간 체크포인트에 큰 저장 공간이 필요합니다.

LYRA 가중치는 필요 없지만, **초기 교사인 VELA v4.2 Hinge 가중치는 필요합니다.** 배포된 `model.bin.gz`를 별도 작업 폴더에 압축 해제한 `hinge_k256_e1.bin`을 준비하세요. 압축 해제한 파일은 91,179,876 bytes이고 SHA-256은 `3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9`입니다. VELA도 직접 생성하려면 아래 VELA v4.2 절을 따릅니다.

먼저 `C:/msys64/ucrt64/bin`을 PATH에 추가하고 교사 커널을 빌드합니다.

```powershell
g++ -std=c++20 -O3 -march=native -pthread -shared -static-libgcc -static-libstdc++ research/lyra-v1/training/kernel/dk.cpp -o research/lyra-v1/training/kernel/dk.dll
```

아래 명령은 **계획 출력만** 하며 데이터 생성이나 학습을 시작하지 않습니다.

```sh
python research/lyra-v1/training/run.py
```

실제 학습을 시작하려면 교사 파일의 실제 경로와 `--execute`를 지정합니다. 단계별 설정은 [LYRA v1 보고서](../lyra-v1/report-ko.md#2-학습-경로)에 있습니다.

```sh
python research/lyra-v1/training/run.py --execute --teacher "D:/models/hinge_k256_e1.bin"
```

데이터와 중간 가중치는 `training/data/`, `training/runs/`, 최종 가중치는 `training/runs/v20_value/model.pt`에 생성됩니다. 포함된 고정 `model.pt`는 학습 과정에서 읽거나 덮어쓰지 않습니다. 결과·캐시·중간 체크포인트는 같은 폴더의 임시 파일에 저장한 뒤 교체합니다. 재실행 시 NPZ·PyTorch 파일의 무결성과 teacher/DAgger 기록 크기를 확인해 완료된 단계만 건너뛰며, 유효한 `ckpt.pt`가 있을 때만 학습을 재개합니다. 손상된 데이터·캐시는 다시 만들고 손상된 체크포인트는 사용하지 않습니다. 학습을 일시 정지하려면 해당 `training/runs/<단계>/PAUSE` 파일을 만들면 됩니다. 데이터 생성 중 중단된 teacher/DAgger/V₀ 단계는 다시 생성하며, 가치 반복 정답은 저장 지점에서 재개합니다.

학습 중 validation과 진행 로그는 유지하지만, 별도 성능 평가·후보 탐색·봉인 평가 실행기와 기존 실험 산출물은 포함하지 않습니다. 원본 연구의 V₂₀까지 선택된 학습 경로를 고정해 실행하며, 과거 평가에 따른 중단·재개 의사결정은 다시 수행하지 않습니다.

### 브라우저용 모델 변환

Python에 NumPy, PyTorch, ONNX가 설치된 상태에서 실행합니다. 기존 변환 버전은 NumPy 2.4.0, PyTorch 2.11.0, ONNX 1.23.2입니다.

```sh
python research/lyra-v1/export.py
```

위 명령은 포함된 고정 V₂₀을 변환하고 원본 해시도 확인합니다. 새로 학습한 가중치를 변환하려면 명시적으로 지정합니다.

```sh
python research/lyra-v1/export.py --checkpoint research/lyra-v1/training/runs/v20_value/model.pt --out research/lyra-v1/output/retrained
```

기본 생성 위치는 `research/lyra-v1/output/`이며 `--out 경로`로 바꿀 수 있습니다. 생성 파일은 `lyra-v20-fp32.onnx`, `features.bin`, `assets.json`입니다. `assets.json`은 생성 정보이며 기존 벤치마크의 부가 기록은 포함하지 않습니다.

고정 체크포인트의 변환 결과는 현재 브라우저용 모델과 ONNX·특징 데이터 SHA-256 및 배열 정의·게임 규칙이 일치하는 것을 확인했습니다. 포함된 학습 파이프라인의 전체 재학습 검증은 수행하지 않았습니다. GPU·CUDA·PyTorch·부동소수점 연산 차이로 재학습 결과가 달라질 수 있으므로, 학습부터의 바이트 동일 재현이나 동일 점수를 보증하지 않습니다. 새 가중치 변환은 앱이나 배포 모델을 자동 교체하지 않습니다.

## VELA v4.3 — VELA v4.2 Hinge와 판단 시점 탐색

[VELA v4.3 보고서](../vela-v4.3/report-ko.md)의 판단 시점 탐색은 새 모델을 만들지 않습니다. 가치 모델은 아래 VELA v4.2 절의 `hinge_k256_e1.bin`(배포 파일 `model.bin.gz`)을 그대로 씁니다.

- **탐색:** `src/policies/vela/native/dabe.hpp`에 있습니다. 탐색 강도별 노드 예산(빠름 0, 보통 2,400, 높음 47,400, 최고 383,400)은 `src/policies/vela/search.js`에 있습니다.
- **빌드:** `python scripts/vela/build.py`로 `vela.mjs`와 `vela.wasm`을 만듭니다. 준비 사항과 빌드 옵션은 [실행 소스 안내](../../src/policies/vela/native/README.md)를 따릅니다.
- **점수 예측기:** 탐색 강도별 최종 점수 예측기는 별도로 학습한 모델이며, 예측기 학습 자료는 이 패키지에 포함하지 않습니다.

## VELA v4.2 — COMPACT100 Hinge

[VELA v4.2 보고서](../vela-v4.2/report-ko.md)의 동결 Hinge 모델을 다시 만드는 절차입니다. FULL100 원본은 앱 실행에 필요하지 않습니다. 앱의 Hinge 최종 점수 예측기는 별도로 학습한 모델이며, 예측기 학습 자료는 이 패키지에 포함하지 않습니다.

### FULL100 생성

Windows MSYS2 UCRT64 g++(C++17/OpenMP), Python 3 및 NumPy를 준비합니다.

```powershell
New-Item -ItemType Directory -Force research/vela-v4.2/bin | Out-Null
g++ -std=c++17 -O3 -march=native -fopenmp -I research/vela-v4.2/include research/vela-v4.2/full100/solve-hands-full100.cpp -o research/vela-v4.2/bin/solve-hands.exe
./research/vela-v4.2/bin/solve-hands.exe 5 100 research/vela-v4.2/full100/model/full100 6
```

이는 전체 생성 명령입니다. cap5, $`r=0`$부터 100까지 생성하며 FULL48에서 재개하지 않습니다. tier 파일만 약 88 GiB가 필요하고 pair 투영·압축 중간 결과에 추가 공간이 필요합니다. 위 명령의 전체 재실행 검증은 수행하지 않았습니다. `ready.json`은 완료 레이어를 기록합니다. 일반 재실행은 출력을 덮어쓰므로 새 출력 폴더를 사용하세요.

### 선택된 Hinge 생성 경로

아래는 고비용 연구 재현 명령입니다. 실행용 모델을 다운로드해서 사용하는 데 필요하지 않습니다. Windows에서 `C:/msys64/ucrt64/bin`을 PATH에 추가한 뒤 실행합니다.

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

`make_diagnostic_queries.py`는 원본과 같은 고정 20,000개 가치 진단 표본만 생성합니다. 선택된 파일은 `models/hinge_k256_e1.bin`입니다. 생성 경로의 의미와 재생성 모델의 검증 조건은 [보고서](../vela-v4.2/report-ko.md#2-생성-경로)에 있습니다.

## VELA v4.1 — COMPACT48

| 폴더 | 역할 |
|---|---|
| `vela-v4.1/full48/` | 손패 최대 5장, horizon 48의 연속 DP 생성기 |
| `vela-v4.1/include/` | 생성기에 필요한 의존 헤더 |
| `vela-v4.1/compression/src/` | 시간·손패 공유 구조 학습 및 양자화 내보내기 |

최종 파일은 `vela-v4.1/compression/models/quant_q6_k64_t12.bin`(37.68 MiB)입니다. FULL48 테이블은 생성 과정에만 필요하며 실행에는 필요하지 않습니다. WASM 빌드는 [native 안내](../../src/policies/vela/native/README.md)를 참고하세요.

Windows에서 MSYS2 UCRT64 g++, Python, NumPy를 준비한 뒤 프로젝트 루트에서 실행합니다. 아래 명령은 전체 모델 생성용입니다. 명령 전체의 재실행 검증은 수행하지 않았습니다. FULL48 테이블만 약 42.72 GiB이고, 최종 FP32 스냅샷과 압축 중간 결과에 추가 공간이 필요합니다.

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

내보내기 스크립트는 비교용 T8도 생성하며, v4.1은 T12 파일을 사용합니다. 선형대수 환경에 따라 생성 바이트가 달라질 수 있으므로 재생성 후 가치·행동 일치와 정책 점수 검증이 필요합니다.

[최종 연구 보고서](../vela-v4.1/report-ko.md): 독립 게임 90,000쌍을 평가한 결과 후보 1876.5108점, FULL48 1878.0848점이며 원 연구의 비열등성 기준을 충족하지 못했습니다. 이 판정은 FULL48과의 비교이며 서비스 기준 모델인 H24+Four와의 비교는 별개입니다.

패키지에는 FULL48 생성기, 공유 구조 압축 코드와 필요한 헤더가 포함돼 있습니다. 원본 소스에서 변경한 부분은 폴더 구성에 맞춘 `common.py`의 입력 경로입니다. 보고서에서 참조하는 외부 그림과 원본 연구 자료는 이 저장소에 포함돼 있지 않습니다.

기준 모델의 압축 해제 후 SHA-256: `261ed5f731511119391278ae8800597ded67dbb882808e06ba2633ee58a292dc`.

---

## VELA v1~v4 — 이전 버전 생성 과정

VELA-v4 모델을 처음부터 만들 때는 **V1, V3, V4**의 생성기 파일을 사용합니다. V2 생성기는 사용하지 않습니다.

### 필요한 폴더

| 폴더 | 역할 |
|---|---|
| `vela-v1/research/` | DP4 계산으로 `four-projected-24.bin` 생성 |
| `vela-v3/research/` | DP5 계산 및 H24 체크포인트 export |
| `vela-v4/research/` | H24 체크포인트를 `h24.raw`로 변환 |

각 폴더의 헤더와 스크립트를 포함해 총 16개 파일을 함께 사용합니다.

### 생성 순서

1. **V1:** `four-project.cpp`를 빌드하고 지평 인자 `24`로 실행합니다. 출력은 `results/four-projected-24.bin`입니다.
2. **V3:** `build-model.sh`로 DP5 테이블을 생성합니다. 스크립트의 H2 저장값 재시작 조건을 유지합니다.
3. **V3:** `export-checkpoint.cpp`로 지평 `24`를 export합니다. 출력된 `*_part1.qdelta.gz`, `*_part2.qdelta.gz`를 순서대로 압축 해제·결합하여 `h24.qdelta`를 만듭니다.
4. **V4:** `convert-checkpoint.cpp`로 만든 실행파일에 `h24.qdelta h24.raw`를 인자로 전달합니다.

최종적으로 필요한 가치테이블은 **`four-projected-24.bin`과 `h24.raw`**입니다. 두 파일을 기존 VELA-v4 런타임의 모델 경로에 배치합니다. 이 폴더에는 런타임 자체는 포함하지 않았습니다.

### 명령어 예시

**Linux/WSL의 Bash**에서 저장소 루트(`research/`의 상위 디렉터리)를 기준으로 아래 명령을 실행합니다. 출력 디렉터리가 새 상태이고 아래 의존성이 설치되어 있다고 가정합니다. 전체 모델을 계산하는 명령입니다. `build-model.sh`에 전달하는 `4`는 스레드 수입니다.

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

최종 두 파일은 `research/vela-v4/model/`에 모입니다. V3 중간 산출물은 `research/vela-v3/model/`에 남습니다. `build-model.sh`는 비어 있지 않은 `model/dp5/` 덮어쓰기를 거부하며, 임의의 중단 지점에서 복구하는 명령은 아닙니다.

## 환경 및 확인 범위

C++17, OpenMP, Python 3, Bash, gzip이 필요합니다. V3 export는 POSIX mmap과 zlib를 사용하므로 Linux/WSL 환경을 기준으로 합니다.

이 생성 절차의 컴파일·모델 재생성·게임 실행 검증 결과는 제공하지 않습니다. 재생성한 파일과 기준 모델의 해시 일치는 별도로 확인해야 합니다.
