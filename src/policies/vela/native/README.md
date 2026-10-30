# VELA v4.3 WASM 빌드

동결된 COMPACT100 Hinge `hinge_k256_e1.bin`(VELA v4.2와 같은 모델 파일)의 브라우저 이식 소스입니다. 연구 원본의 계산 순서와 동점 선택을 유지하며 `OPT=4228`, `base`, `gamma=0`, 2-step expectimax, 실제 비복원 덱과 DeckPotential β=0.6을 사용합니다. 탐색 강도 빠름은 v4.2와 같은 2-step 추천이고, 보통·높음·최고는 판단 시점 탐색(`dabe.hpp`)을 노드 예산 2,400·47,400·383,400으로 실행합니다.

## 빌드

Python 3와 Emscripten **4.0.23**을 준비합니다. SDK는 `.tools/emsdk-main/`에 설치합니다.

```powershell
git clone https://github.com/emscripten-core/emsdk.git .tools/emsdk-main
python .tools/emsdk-main/emsdk.py install 4.0.23
python .tools/emsdk-main/emsdk.py activate 4.0.23
```

SDK가 준비됐다면 설치를 생략합니다. Release의 `model.bin.gz`를 압축을 풀지 않고 `public/models/vela-v4.2/`에 넣은 뒤 프로젝트 루트에서 실행합니다.

```powershell
python scripts/vela/build.py
```

빌드는 `vela.mjs`, `vela.wasm`을 생성하고 `public/models/vela-v4.3/manifest.json`의 실행 파일 해시를 갱신합니다. C++20, `-ffp-contract=off`, SIMD·LTO, 최대 WASM 메모리 512 MiB, 스택 2 MiB를 사용합니다. fast-math는 사용하지 않습니다. 탐색은 약 12 ms마다 Asyncify로 양보해 계산 중 취소를 받습니다. 기댓값 합산은 `double`입니다(WASM의 `long double`은 소프트웨어 128비트 연산이라 느림).

## 모델·상태 계약

- 모델: 91,179,876 bytes, SHA-256 `3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9`.
- gzip 배포 파일: 68,320,365 bytes. FULL100 원본은 런타임에 필요하지 않습니다.
- 입력: `[position, paidDiceUsed, bonusRoll, handCount, h0, h1, h2, h3, h4, deckMask]`. 카드 ID는 물리 ID 1~30, 덱은 실제 잔여 30비트 마스크입니다.
- 반환: `0=주사위`, `1..handCount=입력 손패 슬롯`. 지평 제한은 원래 planner가 담당합니다.
- `_values_ptr()`의 값은 행동 평가값이며 최종 점수 예측으로 표시하지 않습니다.
- manifest의 `scorePredictor:true`로 탐색 강도별 `public/models/vela-v4.3/predictor-<강도>.json`을 읽습니다. 예측기의 모델 SHA와 강도별 정책 ID를 확인한 뒤 선택된 행동의 최종 탐색 Q로 점수를 예측합니다. 예측기를 읽지 못하거나 호환되지 않으면 추천은 유지하고 점수 예측만 생략합니다.

## 출처·검증

연구 원본 `adventure_vela/research/value_compression/rethink100_20260929/src/runtime/`을 메모리 입력 및 WASM 환경에 맞춰 이식한 기존 검증 소스를 승격했습니다. 압축·planner의 산술은 변경하지 않았습니다. 가치 모델 생성 명령과 연구 결과 요약은 [연구 패키지](../../../../research/vela-v4.2/report-ko.md)에 있습니다.

기존 native 대비 WASM 검증은 5,460상태에서 행동 불일치 0, 최대 Q 오차 0입니다. 승격한 실행 파일도 별도로 다시 검증합니다. 관측 WASM heap은 319,225,856 bytes이며 브라우저 전체 메모리나 모든 상태의 최대 사용량은 아닙니다.
