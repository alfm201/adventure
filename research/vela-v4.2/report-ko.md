# VELA v4.2 — COMPACT100 Hinge

[연구 전체 흐름](../README.ko.md) · [재현 가이드](../reproduction/README.ko.md#vela-v42--compact100-hinge)

## 1. 모델

- 배포 모델은 동결된 `hinge_k256_e1.bin`입니다. SHA-256은 `3b25cacd47d1de76ef0a6d6ba60d0cf3e4ce6fcc946c3bfa305cdd3a04a879e9`, 크기는 91,179,876 bytes(86.96 MiB)입니다.
- 정책은 `base`, `gamma=0`, `OPT=4228`, 2-step expectimax와 실제 잔여 덱, DeckPotential $`\beta=0.6`$입니다. H24/Four 보정을 추가하지 않습니다.
- 배포 파일 설치와 WASM 빌드는 [실행 소스 안내](../../src/policies/vela/native/README.md)를 참고하세요. 앱의 최종 점수 예측기는 별도로 학습한 모델이며, 그 학습 자료는 이 패키지에 포함하지 않습니다.

## 2. 생성 경로

1. **FULL100 생성:** cap5, horizon 100의 가치 테이블을 $`r=0`$부터 100까지 생성합니다. FULL48에서 재개하지 않습니다. tier 파일만 약 88 GiB가 필요합니다.
2. **공유 구조 압축:** FULL100의 손패·시간 공유 구조를 학습해 int16으로 내보내고, 함수 보존 채널 배율 후 양자화합니다. K192를 함께 계산하는 것은 원본 K256 학습의 난수 소비와 공유 구조를 유지하기 위해서입니다.
3. **Hinge 학습과 선택:** 고정 teacher/student 행동 표본을 혼합해 3 epoch를 학습하고, 별도 validation의 teacher Q2 regret으로 epoch를 고릅니다. 선택된 파일이 `hinge_k256_e1.bin`입니다.
   - 원본은 512 train / 128 validation seed를 사용하며, 두 행동 정책의 같은 seed 궤적을 독립 게임으로 중복 계산하지 않습니다.
   - 가치 진단 표본은 원본과 같은 고정 20,000개입니다.
   - 최종 100,000게임 은행은 모델 선택 후 동결했습니다.

BLAS·컴파일러·부동소수점 차이로 재생성 결과가 달라질 수 있습니다. 소스 패키지는 바이트 동일 재생성을 보증하지 않습니다. 모델 SHA와 native/WASM 가치·행동, 게임 점수를 검증한 뒤에만 재생성 모델을 사용할 수 있습니다.

## 3. 평가 결과

아래는 원 연구의 평가 결과이며, 이 소스 패키지로 새로 평가한 결과는 아닙니다.

| 정책 | 게임 수 | 평균 점수 | 평균의 95% CI |
|---|---:|---:|---|
| 선택된 Hinge / VELA v4.2 | 100,000 | 1878.13502 | [1876.88763, 1879.38241] |
| 운영 VELA v4.1 / COMPACT48 | 1,000,000 | 1876.371112 | [1875.97794, 1876.76429] |
| 원본 FULL100 | 100,000 | 1878.03718 | [1876.79073, 1879.28363] |

- v4.2와 v4.1은 독립 표본입니다. 기존 결과를 이용한 독립 두 표본 평균 차이는 **+1.76391점**, 95% CI **[+0.45600, +3.07182]**이며 통계적으로 양수입니다. 서로 다른 평가 시점·실행기를 사용한 비교이고 대응 seed 재평가는 아닙니다.
- 원본 FULL100과의 대응 차이는 +0.09784점, 95% CI [-1.04640, +1.24208]이므로 개선은 확인되지 않았습니다. 원본 FULL48과의 독립 비교는 +0.03860점, 95% CI [-1.72693, +1.80413]입니다. 0.1% 비열등성 기준은 통과했으나 FULL48보다 높은 점수라는 별도 연구 목표 달성은 확인되지 않았습니다.
- 기존 웹 이식은 5,460상태에서 native와 행동 불일치 0, 최대 Q 오차 0입니다. 관측 WASM heap은 약 304.44 MiB이며 전체 브라우저 메모리가 아닙니다. 실기기 지연·최대 메모리는 기기별로 추가 확인해야 합니다.

## 4. 포함 자료

| 경로 | 역할 |
|---|---|
| `full100/solve-hands-full100.cpp` | cap5, horizon100 가치 테이블 생성기 |
| `include/{value-model,core,tables}.hpp` | 생성기의 의존 헤더 3개 |
| `compression/build_models.py`, `compression/src/common.py` | FULL100 공유 손패·시간 구조 학습 및 int16 내보내기 |
| `compression/quant_balance.py` | 함수 보존 채널 배율 후 양자화 |
| `compression/collect_q.py`, `refine_actions.py`, `src/action_train/` | 고정 teacher/student 행동 표본과 Hinge 학습·선별 |
| `compression/include/` | Hinge 학습과 FULL100 teacher의 의존 헤더 |

- FULL100 생성에 필요한 소스는 위의 **4개 파일뿐**입니다. 압축·Hinge 학습에는 별도의 의존 파일이 필요합니다.
- 원본 FULL100, 학습 중간 데이터, 다른 후보 모델, 실행 파일은 포함하지 않습니다. 생성 산출물은 Git 제외 대상입니다.
- 실행 명령은 [재현 가이드](../reproduction/README.ko.md#vela-v42--compact100-hinge)에 있습니다.

## 5. 원본 출처

다음 외부 보관 연구에서 소스를 가져왔습니다. 식별자는 원본 연구를 구분하기 위한 것이며 저장소 내부 경로가 아닙니다.

- FULL100 생성: `oneshot_full100_20260928`
- 가치 압축: `rethink100_20260929`
- FULL100 참조 구현: `joint_search_v2_20260929`의 `full100_reference.hpp`
- 이전 연구 의존 소스: `S2_20260919_RDC`
- 웹 이식: `compact100_hinge_20261003`

폴더 구조에 맞춘 include·입력 경로만 변경했습니다. 알고리즘·학습 하이퍼파라미터·seed는 유지합니다.
