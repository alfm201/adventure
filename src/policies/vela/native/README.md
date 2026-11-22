# VELA v5 WASM 빌드

VELA v5 실행 엔진의 브라우저 이식 소스입니다. 가치 함수는 COMPACT100 Hinge `hinge_k256_e1.bin`(VELA v4.2와 같은 가치표)에 실제 남은 덱을 보는 잔차를 더한 것이고, 판단마다 플래너 노드 8,000개의 예산으로 탐색합니다. 2-step expectimax, 실제 비복원 덱, DeckPotential β=0.6, 간극 기준 1.5, 깊이 상한 6을 사용합니다. 구조와 평가는 [VELA v5 보고서](../../../../research/vela-v5/report-ko.md)에 있습니다.

- `v5/`: v5의 소스입니다. `bridge.cpp`(내보내는 함수), `policy.hpp`(가치 함수와 탐색), `tables-build.hpp`(모델을 불러올 때 표 두 개를 만드는 코드), `package.hpp`(모델 파일 읽기), `yield.hpp`(계산 중 양보와 취소).
- `branches.hpp`, `core.hpp`, `tables.hpp`와 그 의존 헤더: v5와 v4.3이 함께 씁니다.
- `bridge.cpp`, `dabe.hpp`: VELA v4.3의 소스입니다. 재현과 회귀 검사를 위해 남겨 두었고, v4.3의 실행 파일 `vela.mjs`·`vela.wasm`도 저장소에 그대로 있습니다.

## 빌드

Python 3와 Emscripten **4.0.23**을 준비합니다. SDK는 `.tools/emsdk-main/`에 설치합니다.

```powershell
git clone https://github.com/emscripten-core/emsdk.git .tools/emsdk-main
python .tools/emsdk-main/emsdk.py install 4.0.23
python .tools/emsdk-main/emsdk.py activate 4.0.23
```

SDK가 준비됐다면 설치를 생략합니다. Release의 `vela-v5.bin.gz`를 압축을 풀지 않고 `public/models/vela-v5/`에 넣은 뒤 프로젝트 루트에서 실행합니다.

```powershell
python scripts/vela/build.py
```

빌드는 `vela-v5.mjs`, `vela-v5.wasm`을 생성하고 `public/models/vela-v5/manifest.json`의 실행 파일 해시를 갱신합니다. C++20, `-ffp-contract=off`, SIMD·LTO, 스택 2 MiB를 사용하고 fast-math는 사용하지 않습니다.

- **`-fopenmp-simd`가 필요합니다.** 빼면 판단이 약 2.4배 느려집니다.
- 최대 WASM 메모리는 1 GiB이고, 필요한 만큼 8 MiB씩 늘립니다.
- 탐색은 약 12 ms마다 Asyncify로 양보해 계산 중에도 취소를 받습니다.

모델 파일을 다시 만드는 절차는 [재현 가이드](../../../../research/reproduction/README.ko.md)에 있습니다.

## 모델·상태 계약

- 모델: 91,641,720 bytes, SHA-256 `0b2b176f93b58f5f3496cd679897058723887d4fd6f8d2e571532e51d7afc581`. Hinge 가치표(91,179,876 bytes, v4.2 배포 모델과 같은 바이트)와 잔차 가중치(461,752 bytes)를 한 파일에 담았습니다. 배치는 `v5/package.hpp`에 있습니다.
- gzip 배포 파일: 70,156,799 bytes.
- 모델을 불러올 때 보드 인자 표(684,662,268 bytes)와 잔차 표(62,366,720 bytes)를 만듭니다. 그동안 `Module.onTableProgress(percent)`로 진행률을 알립니다. 불러온 뒤 WASM heap은 888,078,336 bytes입니다.
- 입력: `[position, paidDiceUsed, bonusRoll, handCount, h0, h1, h2, h3, h4, deckMask]`. 카드 ID는 물리 ID 1~30, 덱은 실제 잔여 30비트 마스크입니다.
- 반환: `0=주사위`, `1..handCount=입력 손패 슬롯`. 계산이 취소되면 `-2`를 돌려줍니다.
- `_values_ptr()`의 값은 행동 평가값이며 최종 점수 예측으로 표시하지 않습니다. 손패가 없는 상태에서는 굴림의 2-step 값 하나만 채웁니다.
- manifest의 `scorePredictor:true`로 `public/models/vela-v5/predictor.json`을 읽습니다. 예측기의 모델 SHA와 정책 ID를 확인한 뒤 선택된 행동의 최종 탐색 Q로 점수를 예측합니다. 예측기를 읽지 못하거나 호환되지 않으면 추천은 유지하고 예상 최종 점수만 표시하지 않습니다.

## 출처·검증

가치 함수와 탐색은 연구용 구현의 산술과 계산 순서를 그대로 옮겼습니다. 표 두 개는 순서가 정해진 float32 누적으로 만들어, 네이티브와 WASM에서 바이트까지 같은 표가 나옵니다.

- 상태 10,000개에서 추천 행동, 사용 노드 수, 예산 도달 여부, 모든 행동의 Q가 연구용 WASM과 같았습니다(최대 오차 0). 순서를 바꿔 다시 넣어도 같았습니다.
- 앱의 게임 엔진으로 둔 200판(판단 33,283개)의 점수·행동 수·궤적이 연구용 WASM과 같았습니다.
- 판단당 평균 / P99 / P99.9는 Node에서 12 ms / 52 ms / 66 ms, Chrome의 Worker에서 18 ms / 88 ms / 117 ms였습니다(한 대의 PC).

브라우저 전체 메모리나 모든 상태의 최대 사용량은 따로 재지 않았습니다.
