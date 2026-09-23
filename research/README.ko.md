# VELA-v4 가치테이블 생성 가이드

[English](README.md) | 한국어

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
