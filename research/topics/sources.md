# 출처와 확인 범위

[연구 전체 흐름](../README.ko.md) · [Research overview](../README.md)

계보와 성능 수치는 저장소의 재현 코드·보고서와 외부 보관 연구 기록을 바탕으로 정리했습니다. 보관 보고서의 결과를 대조했으며, 원시 실험을 모두 재실행한 검증은 아닙니다. 아래 표는 각 설명에 사용한 자료와 확인 범위를 보여줍니다.

## 저장소에서 바로 읽을 자료

| 자료 | 역할 |
|---|---|
| [VELA v1 보고서](../vela-v1/report-ko.md) | 초기 규칙·가치표·2-step 기준선 |
| [VELA v2 보고서](../vela-v2/report-ko.md) | 덱 잔차와 대응 평가 |
| [VELA v3 보고서](../vela-v3/report-ko.md) | 다섯 장 직접 가치와 1-step 전환 |
| [VELA v4 보고서](../vela-v4/report-ko.md) | H24 체크포인트·시간 보정·별도 정확해 연구 |
| [VELA v4.1 보고서](../vela-v4.1/report-ko.md) | FULL48 압축·비열등성 판정과 한계 |
| [VELA v4.2 보고서](../vela-v4.2/report-ko.md) | FULL100·Hinge·고정 평가와 모델 식별 |
| [LYRA v1 보고서](../lyra-v1/report-ko.md) | Hinge에서 V₂₀까지의 학습 경로 |
| [LYRA v2 보고서](../lyra-v2/report-ko.md) | V₀부터 고정 처방으로 반복한 M₄₀, 봉인·FP32 평가, 예측기 |
| [전체 재현 가이드](../reproduction/README.ko.md) | 생성·학습·변환 명령 |

서비스 선택창의 반올림 점수는 [모델 표시 설정](../../src/content/models.js)에 있습니다. 성능 비교에는 각 연구 보고서의 평가 조건과 결과를 사용합니다.

## X36 과거 자료

다음은 외부 보관 보고서입니다. 주요 결과와 비교 조건은 [가치·탐색](value-and-planning.md), [학습·정체](learning-and-plateaus.md)에 요약했습니다. 원시 데이터와 체크포인트 전체는 이 저장소에 포함돼 있지 않습니다.

| ID | 자료 | 반영한 내용 |
|---|---|---|
| X1 | Historical Continuation → R100K Transfer Audit의 `POLICY_LINEAGE.md`, `BENCHMARK_PROVENANCE.md`, `FINAL_REPORT.md` | 복원된 정책의 이름·공통 10M 직접 평가·별도 root 512판의 조건 |
| X2 | Continuation vs rollout policy offline census | 직접 선택과 root 선택의 차이. 불일치율과 최종 점수 개선량의 구분 |
| X3 | G3 지식 감사의 정책 계보·정정 기록, G4 Research Lab v3.4 보고서, Adventure G4 연구 결론 | G3.1의 버전별 직접 정책 성과와 불확실한 root 전이 |
| X4 | 초기 Neural/MCTS·QStar 설계, Previous Research Warnings | 학습 경로와 교사·환경·오프라인 지표의 한계 |
| X5 | Structured Remaining-Value·CAA 보고서, RIPD-G1 Standalone Model Comparison, Targeted Current-G3 Sparse Correction | 실제 점수 개선 사례와 G3에 맞춘 학습 타깃 |
| X6 | Full-Q State Coverage, FQ1 Coverage·U8K Gap, DPI AWR·Iterative AWR 최종 보고서 | 상태 일반화·희소 행동 오차·반복 개선의 정체 |
| X7 | ULC·FQ1 U8K Feasibility 최종 보고서, V27 Batched Top-Up 진행·판정 기록 | 정책 품질과 반복 추론 비용 |
| X8 | Bounded Causal Compute–Quality Frontier, RPI·Clairvoyant Ceiling Probe 설계·결과 | 제한된 추가 탐색·별도 점수 목표·미래정보 평가의 범위 |

초기 휴리스틱은 [보존 코드](../../old/v1/js/board.js)와 [함수 분리 이력](https://github.com/alfm201/adventure/commit/a399496430eb41d012692537dc0c1ac4cb13eed4)으로 확인했습니다. `chooseActionFast()`는 기존 `chooseAction()`을 분리하며 임계값도 조정한 구현입니다.

과거 보고서의 배포·실행 상태는 당시 기록입니다. 미완료 평가는 미완료로, 출처가 확인되지 않은 결과는 미확인으로 다뤘습니다. 후속 정정이 있는 결과에는 정정된 조건을 적용했습니다.

## VELA와 공통 허브

공통 연구 허브는 여러 연구의 정의·평가 조건과 결과 요약을 모은 자료입니다. 이 문서에서는 다음 내용을 참조했습니다.

| ID | 자료 | 반영한 내용 |
|---|---|---|
| V1 | 저장소의 VELA 버전별 보고서·README | 모델별 전환과 대표 평가 |
| V2 | `MODELS_BENCHMARKS.md`, 덱 DP·FULL 압축·TT·정확해 연구 요약 | 압축과 추가 탐색의 성과, 실제 덱 표현과 정확성의 한계 |
| C1 | `CONTRACTS.md`, `SOURCES.md`와 허브 안내 | 상태·난수·평가 조건과 출처 정정 |

TT의 제한된 생성 실험은 `TT_GLOBAL_PREFLIGHT_20260930.md`, 정확한 행동 보증의 결과는 `EXACT_RESEARCH_SUMMARY_20261003.md`를 확인했습니다. 주요 결론은 [가치·탐색](value-and-planning.md), 공통 기준은 [평가 기준](evaluation.md)에 정리했습니다.

## LYRA 연구와 후속 방향

| ID | 자료 | 반영한 내용 |
|---|---|---|
| L1 | LYRA 연구 요약, `DESIGN.md`, `FINAL_REPORT_KO.md` | 반복 자기 개선이라는 목표, Actor에서 가치망으로의 전환, π₂₀ 성능 |
| L2 | `SWA_PROTOCOL.md`, `Q20_PROTOCOL.md`, `SIGNAL_PROTOCOL.md`, `RES_PROTOCOL.md`와 허브의 교차 요약 | 증류 오차에 관한 초기 해석, 교사 신호·새 상태 일반화·결정 churn |
| L3 | `S2G_PROTOCOL.md`, `COST_PROTOCOL.md`, `DIST_PROTOCOL.md` | 추가 탐색의 이득과 비용, π₂₀ 배포 정책과의 차이 |
| L4 | `SCALE_PROTOCOL.md`의 M2 비교 기준 정정 | 고정 교사 학습에서 규모·학습 이력의 효과 |
| L5 | `VMU_PROTOCOL.md` | 강한 정책의 가치 학습 파일럿과 한계 |
| L6 | `SCALE_VI_PLAN.md`, `results/svi/` | 같은 처방으로 V₀부터 각자 반복한 규모 비교의 사전 선별·봉인 평가, M의 V₄₀ 연장과 연장 봉인 평가, 평가 대상 망을 운 측정기로 쓰는 추정기 |
| L7 | `ENDGAME_PROTOCOL.md`, `scripts/endgame_policy_check.py`, `results/endgame_policy_{pi20,M20}.json` | 종반 정확해 상태에서 π₂₀·M₂₀의 regret, 손패 수별 행동가치 상대 오차, 회수 가능 점수의 하한 |
| L8 | `SCALE_VI_PLAN.md`의 FP32 확인 평가·예측기 절, `scripts/svi_eval.py`, `scripts/score_ref.py`, `scripts/score_predictor.py`, `results/score_m40/` | LYRA v2의 FP32 확인 평가, 예상 최종 점수 예측기의 라벨·초기 상태 보정·정확도 |
| L9 | `SCALE_VI_PLAN.md`의 L군·S2·수평선 점검·SCV·완화 게임 사전 검사 절, `results/svi/`, `results/relaxed_pretest_*.json` | 규모의 한계, 행동 간 값 차이가 정체의 위치라는 근거 |

LYRA의 학습 단계는 [포함된 재현 코드](../reproduction/README.ko.md#lyra-v1--v₂₀-신경망-가치-모델)와 대조했습니다. 후속 연구는 인용한 프로토콜에서 보고한 범위까지만 설명합니다. 고정 교사 학습의 정체, 정책 평가 파일럿의 판정 기준 불합격, 독립 가치 반복의 결과는 서로 다른 결과로 구분했습니다.

## 환경 연구

| ID | 자료 | 반영한 내용 |
|---|---|---|
| E1 | [환경·클래스 인코딩](../lyra-v1/training/kernel/native/core.hpp), [전이·카드 표](../lyra-v1/training/kernel/native/tables.hpp), [FULL100 생성기](../vela-v4.2/full100/solve-hands-full100.cpp) | 상태·종료·비복원 덱 규칙과 손패·덱 조합 수 |
| E2 | 전체 상태 기호적 DP의 `PROOF.md`, `POTENTIAL_BOUND.json`, `INITIAL_STATE_SCOPE_CORRECTION_20261003.md`, `EXACT_RESEARCH_SUMMARY_20261003.md` | 1,078행동 종료 상한, 도달 가능 상태와 필드 범위의 구분, 정확해 연구의 미해결 범위 |
| E3 | Clairvoyant ceiling probe의 `README.md`, `RESULTS.md`, `limited_preview_probe.js`와 아래 결과 JSON | 행동별 미래 난수 공개 범위, 제한 미리보기·전체 미래 공개 점수와 해석 |
| E4 | [VELA v1의 수학적 정의](../vela-v1/report-ko.md#3-문제의-수학적-정의), 일반굴리기 seed 연구의 `PROOF.md`, `DECK_DP.md`의 Bellman 잔차 분석 | 최종 점수 목적함수, 합법 정책에서 시작하는 하한 반복, 고정 정책의 잔차 항등식 |
| E5 | 환경 구조 측정의 `README.md`(보드 전수 계산, v4.2 1만 판 드로우·재충전, 잠재량 감소량 2×2,000판), 손패×덱 랭크 연구의 `REPORT_KO.md`와 엇갈린 순서 TT 판정 `PROTOCOL.md`, 공통 허브 `ENV_STRUCTURE_20261026.md` | 잠재량의 행동별 감소량, 보드 동치·굴림 분기, 재충전 빈도, 손패×덱 정확 표현의 크기 |
| E6 | 종반 정확해 연구(`l0_exact.cpp`, ENDGAME-1)의 상태별 결과, 정확 DP 최적화·근 행동 인증·FULL100 대 정확 DP 비교 연구의 `REPORT.md`와 결과 JSON, 공통 허브 `common/exact_oracle/README.md` | 정확해 카탈로그의 Q\*·V\*·a\*, 탐색량·메모리·시간, 풀리지 않은 범위 |

E3의 수치는 `limited_preview_1000ep_seed1000_h1_w4096.json`, `limited_preview_1000ep_seed1000_h2_h3_h4_w4096.json`, `limited_preview_1000ep_seed1000_h5_w4096.json`, `oracle_1000ep_seed1000_w64.json`의 집계와 대조했습니다. 이 결과 파일은 외부 보관 자료이며 저장소에는 포함하지 않습니다.

과거 연구 대화 기록도 실험 범위와 해석이 바뀐 경위를 확인하는 데 참고했습니다. 대화에서만 제시된 수치를 새 검증 결과로 옮기지는 않았습니다. [환경과 계산량](environment.md)의 수치 근거는 위 코드·증명·저장된 실험 결과입니다.
