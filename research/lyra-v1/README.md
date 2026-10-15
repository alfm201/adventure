# LYRA v1 — V₂₀ 모델 학습·변환

LYRA의 학습과 브라우저용 FP32 모델 변환 코드입니다. 기존 LYRA 체크포인트 없이 학습을 시작하거나, 포함된 고정 V₂₀ 체크포인트를 변환할 수 있습니다. 연구 기준은 V₂₀ 가치망과 π₂₀ 1-step 정책입니다.

| 파일 | 용도 |
|---|---|
| `model.pt` | 원본 V₂₀ 체크포인트 |
| `board.npz` | 특징 생성에 필요한 보드 데이터 |
| `model.py` | 원본에서 추린 모델 구조·특징 계산 및 기존 변환용 encoder |
| `export.py` | ONNX·특징 배열·메타데이터 생성 |
| `training/run.py` | 교사 데이터 생성부터 V₂₀까지의 학습 순서·설정 |
| `training/artifacts.py` | 학습 파일의 원자적 저장과 재사용 전 무결성 확인 |
| `training/scripts/` | 교사·DAgger 데이터, 초기 가치 정답, 가치 반복 정답 생성 |
| `training/src/` | Actor·ValueNet 정의, Actor·가치망 학습, self-play·backup 함수 |
| `training/kernel/` | 실제 덱 전이와 Hinge 교사 레이블 생성용 C++·Python 코드 및 의존 헤더 |

출처는 `claude/research/neural/deck_actor_20261011`의 `runs/v20_value/model.pt`, `data/board.npz`, `src/actor.py`입니다. 원본 체크포인트 SHA-256은 `b4edb84d4c64cd4b7d0d16bcc8db0eab6f521d5090b13426f797b50ac363d09a`입니다. 변환은 기존 LYRA FP32 방식(마지막 층의 global 토큰 계산)을 유지합니다.

## 체크포인트 없이 학습

Windows, MSYS2 UCRT64 g++(C++20), NumPy와 CUDA 지원 PyTorch가 필요합니다. 원본 Actor 학습은 BF16, 가치망 학습은 FP32, 가치 반복의 self-play·정답 생성은 TF32를 사용하므로 BF16·TF32를 지원하는 NVIDIA GPU를 준비합니다. 원본 학습 코드는 데이터 전체를 GPU에 올리며, CPU 전용 학습 경로는 포함하지 않습니다. 데이터·특징 캐시·중간 체크포인트에 큰 저장 공간이 필요합니다.

LYRA 가중치는 필요 없지만, **초기 교사인 VELA v4.2 Hinge 가중치는 필요합니다.** 배포된 `model.bin.gz`를 별도 작업 폴더에 압축 해제한 `hinge_k256_e1.bin`을 준비하세요. 압축 해제한 파일은 91,179,876 bytes이고 SHA-256은 `3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9`입니다. VELA도 직접 생성하려면 [VELA 학습·생성 안내](../vela-v4.2/README.md)를 따릅니다.

프로젝트 루트에서 실행할 명령입니다. 먼저 `C:/msys64/ucrt64/bin`을 PATH에 추가하고 교사 커널을 빌드합니다.

```powershell
g++ -std=c++20 -O3 -march=native -pthread -shared -static-libgcc -static-libstdc++ research/lyra-v1/training/kernel/dk.cpp -o research/lyra-v1/training/kernel/dk.dll
```

아래 명령은 **계획 출력만** 하며 데이터 생성이나 학습을 시작하지 않습니다.

```sh
python research/lyra-v1/training/run.py
```

실제 학습을 시작하려면 교사 파일의 실제 경로와 `--execute`를 지정합니다.

```sh
python research/lyra-v1/training/run.py --execute --teacher "D:/models/hinge_k256_e1.bin"
```

| 단계 | 데이터·학습 설정 |
|---|---|
| 교사 데이터 | Hinge 2-step 100,000게임, seed `mix(960000000+i)` |
| G1 Actor → DAgger → X2 Actor | G1: 128/3/4, 4 epoch → G1로 5,000게임 수집(`mix(964000000+i)`) → 교사+DAgger로 X2: 256/6/8, 4 epoch. 공통 batch 4096, AdamW lr 1e-3, seed 1 |
| V₀ | 교사 게임 ID < 95,000에서 부모 800,000개, 합법 행동당 자식 8개, Hinge 1-step backup 정답. 256/6/8, batch 2048, lr 1e-3, 2 epoch, seed 1 |
| V₁–V₆ | 직전 가치망의 2,000게임에서 부모 100,000개, 행동당 자식 4개. 새 정답과 V₀ 정답을 1:1 혼합, 직전 가중치에서 lr 3e-4로 2 epoch |
| V₇–V₁₇ | 부모 150,000개, V₀ 혼합 제거, 정답 backup만 X2 Actor 상위 2개 합법 행동 사용. 나머지 설정 유지 |
| V₁₈–V₂₀ | 부모 225,000개, 4 epoch로 변경. 나머지 설정 유지 |

V₁–V₂₀의 게임 seed는 `mix(1190000000 + 10000000*k + i)`, 자식 표본 RNG는 20261013입니다. V₀ 표본 RNG는 20261012입니다. 가치망 학습은 AdamW, wd 0.01, warmup·cosine, gradient clip 1.0이며 매 단계 마지막 가중치를 사용합니다. **Actor 가지치기는 정답 생성에만 적용하며 self-play와 π₂₀ 실행은 모든 합법 행동을 평가합니다.**

데이터와 중간 가중치는 `training/data/`, `training/runs/`, 최종 가중치는 `training/runs/v20_value/model.pt`에 생성됩니다. 포함된 고정 `model.pt`는 학습 과정에서 읽거나 덮어쓰지 않습니다. 결과·캐시·중간 체크포인트는 같은 폴더의 임시 파일에 저장한 뒤 교체합니다. 재실행 시 NPZ·PyTorch 파일의 무결성과 teacher/DAgger 기록 크기를 확인해 완료된 단계만 건너뛰며, 유효한 `ckpt.pt`가 있을 때만 학습을 재개합니다. 손상된 데이터·캐시는 다시 만들고 손상된 체크포인트는 사용하지 않습니다. 학습을 일시 정지하려면 해당 `training/runs/<단계>/PAUSE` 파일을 만들면 됩니다. 데이터 생성 중 중단된 teacher/DAgger/V₀ 단계는 다시 생성하며, 가치 반복 정답은 저장 지점에서 재개합니다.

학습 중 validation과 진행 로그는 유지하지만, 별도 성능 평가·후보 탐색·봉인 평가 실행기와 기존 실험 산출물은 포함하지 않습니다. 원본 연구의 V₂₀까지 선택된 학습 경로를 고정해 실행하며, 과거 평가에 따른 중단·재개 의사결정은 다시 수행하지 않습니다.

## 브라우저용 모델 변환

Python에 NumPy, PyTorch, ONNX가 설치된 상태에서 프로젝트 루트에서 실행합니다. 기존 변환 버전은 NumPy 2.4.0, PyTorch 2.11.0, ONNX 1.23.2입니다.

```sh
python research/lyra-v1/export.py
```

위 명령은 포함된 고정 V₂₀을 변환하고 원본 해시도 확인합니다. 새로 학습한 가중치를 변환하려면 명시적으로 지정합니다.

```sh
python research/lyra-v1/export.py --checkpoint research/lyra-v1/training/runs/v20_value/model.pt --out research/lyra-v1/output/retrained
```

기본 생성 위치는 `research/lyra-v1/output/`이며 `--out 경로`로 바꿀 수 있습니다. 생성 파일은 `lyra-v20-fp32.onnx`, `features.bin`, `assets.json`입니다. `assets.json`은 생성 정보이며 기존 벤치마크의 부가 기록은 포함하지 않습니다.

고정 체크포인트의 변환 결과는 현재 브라우저용 모델과 ONNX·특징 데이터 SHA-256 및 배열 정의·게임 규칙이 일치하는 것을 확인했습니다. 학습 전체는 이번 패키징에서 실행하지 않았습니다. GPU·CUDA·PyTorch·부동소수점 연산 차이로 재학습 결과가 달라질 수 있으므로, 학습부터의 바이트 동일 재현이나 동일 점수를 보증하지 않습니다. 새 가중치 변환은 앱이나 배포 모델을 자동 교체하지 않습니다.
