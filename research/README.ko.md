# 모델 재현 가이드

[English](README.md) | 한국어

## LYRA v1 — V₂₀ 신경망 가치 모델

[LYRA 학습·변환 자료](lyra-v1/README.md)에는 V₂₀ 학습 경로, 보드 데이터, 고정 체크포인트와 브라우저용 FP32 모델 변환 코드가 있습니다. 기존 LYRA 체크포인트 없이 학습할 수 있으며, 초기 교사인 VELA v4.2 가중치는 별도로 준비합니다. 앱에서는 π₂₀ 1-step 정책을 사용합니다.

## VELA v4.2 — COMPACT100 Hinge

현재 모델은 동결된 Hinge epoch 1, horizon 100, 2-step expectimax와 실제 잔여 덱 및 DeckPotential β=0.6을 사용합니다. FULL100 최소 생성기(C++ 1개·헤더 3개), 압축·학습 의존 소스, 실행 명령과 최종 결과 요약은 [v4.2 패키지](vela-v4.2/README.md)에 있습니다. FULL100 원본은 앱 실행에 필요하지 않습니다. 별도로 학습한 Hinge 최종 점수 예측기는 앱에 연결돼 있으며, 예측기 학습 자료는 이 가치 모델 연구 패키지에 포함하지 않습니다.

## VELA v4.1 — COMPACT48

| 폴더 | 역할 |
|---|---|
| `vela-v4.1/full48/` | 손패 최대 5장, horizon 48의 연속 DP 생성기 |
| `vela-v4.1/include/` | 생성기에 필요한 의존 헤더 |
| `vela-v4.1/compression/src/` | 시간·손패 공유 구조 학습 및 양자화 내보내기 |

최종 파일은 `vela-v4.1/compression/models/quant_q6_k64_t12.bin`(37.68 MiB)입니다. FULL48 테이블은 생성 과정에만 필요하며 실행에는 필요하지 않습니다. WASM 빌드는 [native 안내](../src/policies/vela/native/README.md)를 참고하세요.

Windows에서 MSYS2 UCRT64 g++, Python, NumPy를 준비한 뒤 프로젝트 루트에서 실행합니다. 아래 명령은 전체 모델 생성 작업이며 이번 소스 정리 과정에서는 다시 실행하지 않았습니다. FULL48 테이블만 약 42.72 GiB이고, 최종 FP32 스냅샷과 압축 중간 결과에 추가 공간이 필요합니다.

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

원본 내보내기 스크립트는 비교용 T8 파일도 생성합니다. v4.1에 사용하는 파일은 T12입니다. 선형대수 환경에 따라 생성 바이트가 달라질 수 있으므로 재생성 후 가치·행동 일치와 정책 점수 검증이 필요합니다.

[최종 연구 보고서](vela-v4.1/report-ko.md): 독립 90,000 paired 게임에서 후보 1876.5108점, FULL48 1878.0848점이며 원 연구의 비열등성 기준은 미충족입니다. 운영 H24+Four와 비교한 수치는 아닙니다.

출처는 `adventure_vela/research/full_hand_dp/oneshot_full48_20260927/`(생성기), `adventure_vela/research/value_compression/full48_shared_structure_v1_20260927/`(압축·보고서), `adventure_vela/bak/legacy_20260926/S2_20260919_RDC/vendor/research/`(헤더)입니다. 소스 변경은 현재 폴더 구성에 맞춘 `common.py`의 입력 경로뿐입니다. 보고서의 외부 그림과 PC 전용 링크는 텍스트로 표시하며 원본 증거 자료는 원 연구 경로에 남아 있습니다.

기준 모델의 압축 해제 후 SHA-256: `261ed5f731511119391278ae8800597ded67dbb882808e06ba2633ee58a292dc`.

---

## VELA v1~v4 — 이전 버전 생성 과정

VELA-v4 모델을 처음부터 만들 때는 **V1, V3, V4**의 생성기 파일을 사용합니다. V2 생성기는 사용하지 않습니다.

## 필요한 폴더

| 폴더 | 역할 |
|---|---|
| `vela-v1/research/` | DP4 계산으로 `four-projected-24.bin` 생성 |
| `vela-v3/research/` | DP5 계산 및 H24 체크포인트 export |
| `vela-v4/research/` | H24 체크포인트를 `h24.raw`로 변환 |

각 폴더의 헤더와 스크립트를 포함해 총 16개 파일을 함께 사용합니다.

## 생성 순서

1. **V1:** `four-project.cpp`를 빌드하고 지평 인자 `24`로 실행합니다. 출력은 `results/four-projected-24.bin`입니다.
2. **V3:** `build-model.sh`로 DP5 테이블을 생성합니다. 스크립트의 H2 저장값 재시작 조건을 유지합니다.
3. **V3:** `export-checkpoint.cpp`로 지평 `24`를 export합니다. 출력된 `*_part1.qdelta.gz`, `*_part2.qdelta.gz`를 순서대로 압축 해제·결합하여 `h24.qdelta`를 만듭니다.
4. **V4:** `convert-checkpoint.cpp`로 만든 실행파일에 `h24.qdelta h24.raw`를 인자로 전달합니다.

최종적으로 필요한 가치테이블은 **`four-projected-24.bin`과 `h24.raw`**입니다. 두 파일을 기존 VELA-v4 런타임의 모델 경로에 배치합니다. 이 폴더에는 런타임 자체는 포함하지 않았습니다.

## 실제 명령어 예시

**Linux/WSL의 Bash**에서 저장소 루트(`research/`의 상위 디렉터리)를 기준으로 아래 명령을 실행합니다. 출력 디렉터리가 새 상태이고 아래 의존성이 설치되어 있다고 가정합니다. 전체 모델 계산을 수행하는 명령이며 짧은 동작 확인용이 아닙니다. `build-model.sh`에 전달하는 `4`는 스레드 수입니다.

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

이번 정리에서는 빌드·재계산·실행을 하지 않았습니다. 기존 모델과 재생성 결과의 해시 일치는 별도 확인이 필요합니다.
