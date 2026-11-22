# 실제 규칙의 정확한 값

이 문서는 실제 규칙에서 종료 점수까지 정확한 전이로 끝까지 푼 결과만 정리합니다. 실제 규칙은 비복원 덱, 빈 덱 재충전, 손패 5장 상한, 더블 보너스를 포함합니다. 다음은 넣지 않았습니다.
- 드로우를 IID로 바꾼 FULL100 같은 근사
- 덱을 줄인 축소판 게임
- 상한·하한 구간만 있고 인증되지 않은 결과

정확한 값은 근사 가치표나 신경망을 검증할 때, 그리고 학습의 기준 정답으로 쓸 수 있습니다. [근거 E6](sources.md#환경-연구)

값은 세 종류로 나눕니다.

- **Q\*:** 그 상태의 모든 합법 행동에 대한 정확한 행동가치
- **V\*:** 상태의 정확한 최적값. 행동별 값이 없거나 행동이 하나뿐입니다
- **a\*:** 최적 행동만 인증했습니다. 값은 구간으로만 압니다

## 표기

- **상태:** `p`는 현재 위치(종료 시 점수), `r`은 남은 유료 주사위 수, `b`는 대기 중인 보너스 굴림(0/1)입니다.
- **카드 표기:** `+k`·`−k`는 이동카드, `×k`는 배수카드, `S`는 스테이지카드입니다. 행동 `roll`은 일반 굴림입니다.
- **전체 덱(30장):** +1 +2 +3 +4 +4 +5 +5 +6 +6 +7 +7 +8 +8 +9 +9 +10 +10 +11 +12 −1 −2 −3 ×2 ×3 ×5 ×7 ×8 ×10 S S
- **배수 6장 덱:** ×2 ×3 ×5 ×7 ×8 ×10. 배수카드만 남은 특수 덱이며, 재충전은 실제 규칙대로 30장 전체로 이루어집니다.
- **정밀도:** double입니다. 독립 대조에서 V 차이는 1e-12 수준이었습니다.
- **탐색량:** 솔버마다 정의가 다릅니다(확장 노드, work, 그래프 상태 수). 서로 다른 솔버의 숫자는 비교하지 않습니다. 메모리는 프로세스 최대 작업 집합입니다.

## Q\*: 모든 행동의 정확한 값

### 실제 방문 종반 상태

π₂₀·v4.2의 자가 대국과 M₄₀의 봉인 평가에서 방문한 r ≤ 2 상태 가운데 정확히 푼 4,364개입니다. 대부분은 상태당 노드 상한 500만 안에서 풀었고, 이 상한에서 풀리지 않은 r2 상태 일부는 병렬 솔버로 풀었습니다. 데이터는 [exact-endgame-qstar.csv](../data/exact-endgame-qstar.csv)에 있고, 상태 × 행동마다 1행입니다.

<table>
<thead>
<tr><th nowrap>세트</th><th nowrap align="right">상태</th><th nowrap>r 분포</th><th nowrap>상태당 노드 (memo)<br>중앙값 / p99 / 최대</th><th nowrap align="right">상태당 최대 시간<br>memo / 병렬</th></tr>
</thead>
<tbody>
<tr><td nowrap><code>pi20</code></td><td nowrap align="right">1,158</td><td nowrap>r0 38 · r1 902 · r2 218</td><td nowrap>7,608 / 417만 / 491만</td><td nowrap align="right">48.2초 / 4,236초</td></tr>
<tr><td nowrap><code>m40</code></td><td nowrap align="right">2,308</td><td nowrap>r0 59 · r1 1,795 · r2 454</td><td nowrap>5,416 / 420만 / 499만</td><td nowrap align="right">153.9초 / 5,627초</td></tr>
<tr><td nowrap><code>v42</code></td><td nowrap align="right">898</td><td nowrap>r0 124 · r1 730 · r2 44</td><td nowrap>565 / 417만 / 487만</td><td nowrap align="right">16.7초 / −</td></tr>
</tbody>
</table>

- **계산 조건:** memo 솔버는 8스레드(`m40`은 6–11스레드), 스레드당 memo 최대 400만 항목으로 풀었고, 메모리는 상태별로 기록하지 않았습니다. 병렬 솔버는 상태 하나에 54스레드, 메모리 예산 1,380 GB를 썼고, 저장 상태는 상태당 중앙값 6,314만·최대 278.6억 개, 실제 최대 메모리는 기록한 18개 상태에서 9.7–1,180 GB였습니다.
- **선택 편향:** 풀린 상태만 포함했습니다. 풀림 비율은 π₂₀ 세트 r0 100%, r1 88%, r2 23%, M₄₀ 세트 r0 100%, r1 89%, r2 24%라서 어려운 r2 상태가 많이 빠졌습니다. 병렬 솔버로 추가한 r2 52개도 손패·덱이 작은 상태부터, 이후 b=0 상태를 무작위 순서로 일부만 푼 결과입니다. 이 표는 실제 방문 분포의 대표 표본이 아닙니다.
- **노드 수:** memo 솔버의 노드는 스레드 안에서 memo를 공유한 상태로 센 값이라, 같은 상태를 단독으로 풀 때보다 작게 나왔을 수 있습니다. 병렬 솔버의 `nodes`는 저장 상태 수이므로 두 솔버의 값은 비교하지 않습니다.
- **열:** CSV에서는 카드 기호를 ASCII로 씁니다(`x2`, `-1`).
  - `set`, `state_id`: 상태를 식별합니다.
  - `p`, `r`, `b`, `hand`: 위 표기와 같습니다.
  - `deck_size`, `deck_missing`, `deck_mask`: 남은 덱의 장수, 전체 덱에서 빠진 카드, 물리 카드 비트입니다. 비트 i는 물리 카드 i+1입니다.
  - `action`, `q_star`, `is_opt`: 행동, 그 Q\*, 최적 여부입니다. 동률은 모두 1입니다.
  - `v_star`, `nodes`, `sec`: 상태의 V\*와, 그 값을 계산한 노드 수와 시간입니다.
  - `solver`: 값을 계산한 솔버입니다. `memo`는 노드 상한 500만의 memo 솔버, `parallel`은 병렬 솔버입니다.

### 정확한 값으로 본 정책의 종반 결정

위 표의 `pi20`·`v42` 세트 가운데 memo 솔버로 푼 2,040개 상태에서 가치망 정책의 선택을 Q\*와 비교했습니다. [출처 L5](sources.md#lyra-연구와-후속-방향)

<table>
<thead>
<tr><th nowrap>정책</th><th nowrap align="right">최적 행동을 놓친 상태</th><th nowrap align="right">결정당 평균 regret</th></tr>
</thead>
<tbody>
<tr><td nowrap>π₂₀ (5.5M)</td><td nowrap align="right">75</td><td nowrap align="right">0.096</td></tr>
<tr><td nowrap>M₂₀ (15.4M)</td><td nowrap align="right">64</td><td nowrap align="right">0.058</td></tr>
</tbody>
</table>

- M₂₀ − π₂₀의 대응 차이는 −0.038, 95% 부트스트랩 구간 [−0.070, −0.010]입니다.
- 결정을 직접 좌우하는 것은 가치의 절대 수준이 아니라 같은 상태 안 행동끼리의 상대 오차입니다. 상태별로 중심화한 행동가치 오차의 표준편차는 손패 수와 함께 커집니다.

<table>
<thead>
<tr><th nowrap>손패 수</th><th nowrap align="right">1</th><th nowrap align="right">2</th><th nowrap align="right">3</th><th nowrap align="right">4</th><th nowrap align="right">5</th></tr>
</thead>
<tbody>
<tr><td nowrap>π₂₀</td><td nowrap align="right">0.50</td><td nowrap align="right">1.36</td><td nowrap align="right">2.93</td><td nowrap align="right">5.10</td><td nowrap align="right">6.53</td></tr>
<tr><td nowrap>M₂₀</td><td nowrap align="right">0.45</td><td nowrap align="right">0.95</td><td nowrap align="right">2.52</td><td nowrap align="right">4.50</td><td nowrap align="right">5.25</td></tr>
</tbody>
</table>

- 1장 수준의 오차를 모든 상태에 적용하면, 실제 행동가치 간격과 행동 수를 그대로 두어도 오판율이 1–5%로 거의 평평해집니다. 오판이 손패 수와 함께 늘어나는 것은 행동 수보다 행동별 오차가 커지는 탓으로 보입니다. 다만 손패 수에 따라 위치와 남은 주사위 분포도 달라지므로 인과로 단정하지 않습니다.
- 이 표본은 r ≤ 2 가운데 풀린 상태뿐이라 어려운 r2 상태가 많이 빠져 있습니다.
- π₂₀ 세트 가운데 memo 솔버로 푼 1,142개의 결정당 regret 0.050에 게임당 r ≤ 2 결정 수 4.01을 곱하면, π₂₀이 종반에서 회수할 수 있는 점수는 게임당 약 0.20점([0.08, 0.33])입니다. 각 결정의 손실은 0 이상이므로 이 값은 종반 일부만 센 **하한**이며, 전체 회수 여지가 아닙니다. 결정 시점 2-step 탐색이 실제 게임에서 약 +1.2점을 더 얻은 것이 전체 여지가 이보다 크다는 근거입니다.

### 개별 상태

<table>
<thead>
<tr><th nowrap>상태</th><th nowrap>행동별 Q*</th><th nowrap>a*</th><th nowrap>탐색량</th><th nowrap>메모리</th><th nowrap>시간</th></tr>
</thead>
<tbody>
<tr><td nowrap>p1600 r1 b0, [+10 ×2], 전체 덱</td><td nowrap>roll 1614.443867<br>+10 <b>1639.304193</b><br>×2 1618.741909</td><td nowrap>+10</td><td nowrap>그래프 108,340 상태</td><td nowrap>기록 없음</td><td nowrap>기록 없음</td></tr>
<tr><td nowrap>p2200 r1 b0, [+10 ×2], 전체 덱</td><td nowrap>roll 2214.672502<br>+10 <b>2226.078119</b><br>×2 2218.232347</td><td nowrap>+10</td><td nowrap>그래프 296,181 상태</td><td nowrap>기록 없음</td><td nowrap>기록 없음</td></tr>
<tr><td nowrap>p1300 r1 b0, [+10 ×2], 전체 덱</td><td nowrap>roll 1312.232940<br>+10 <b>1325.601852</b><br>×2 1314.570988</td><td nowrap>+10</td><td nowrap>그래프 19,240 상태</td><td nowrap>기록 없음</td><td nowrap>기록 없음</td></tr>
<tr><td nowrap>p1800 r1 b0, [+10 ×2], 전체 덱</td><td nowrap>roll 1815.561572<br>+10 <b>1824.178451</b><br>×2 1817.953231</td><td nowrap>+10</td><td nowrap>그래프 1,905,347 상태.<br>최적화 솔버로는 V*를<br>work 135,200으로 구함</td><td nowrap>23.5 MiB</td><td nowrap>0.14초</td></tr>
<tr><td nowrap>p1010 r2 b0, [×10], 전체 덱</td><td nowrap>roll <b>1097.394268</b><br>×10 1091.278481</td><td nowrap>roll</td><td nowrap>work 4,180,505</td><td nowrap>231.8 MiB</td><td nowrap>4.90초</td></tr>
<tr><td nowrap>p400 r2 b0, [×10], 전체 덱</td><td nowrap>roll <b>484.441187</b><br>×10 481.319666</td><td nowrap>roll</td><td nowrap>work 8,586,532</td><td nowrap>435.9 MiB</td><td nowrap>10.30초</td></tr>
<tr><td nowrap>p2053 r2 b0, [+10],<br>덱 14장(+2 +3 +4 +5 +6 +9 +9<br>+10 +12 −2 −3 ×10 S S)</td><td nowrap>roll <b>2094.456197</b><br>+10 2085.373664</td><td nowrap>roll</td><td nowrap>저장 상태 194,209</td><td nowrap>기록 없음</td><td nowrap>0.6초</td></tr>
<tr><td nowrap>p1760 r2 b0, [×7],<br>덱 12장(+5 +5 +6 +6 +8 +9<br>−1 −3 ×2 ×3 ×5 S)</td><td nowrap>roll <b>1824.288218</b><br>×7 1823.488532</td><td nowrap>roll</td><td nowrap>저장 상태 137,852</td><td nowrap>기록 없음</td><td nowrap>0.6초</td></tr>
<tr><td nowrap>p1577 r2 b0, [+7 S −3 ×5],<br>덱 10장(+1 +3 +4 +4 +7 +8 +9 ×2 ×10 S)</td><td nowrap>roll 1677.650627<br>+7 1669.976965<br>S 1687.322781<br>−3 1682.379550<br>×5 <b>1689.198938</b></td><td nowrap>×5</td><td nowrap>저장 상태 5,336,852</td><td nowrap>기록 없음</td><td nowrap>12.6초</td></tr>
<tr><td nowrap>p1292 r2 b0, [×8 +7],<br>덱 22장(전체 덱에서<br>+3 +4 +7 +7 +8 +9 −1 ×8 제외)</td><td nowrap>roll 1374.003917<br>×8 1371.667795<br>+7 <b>1386.082521</b></td><td nowrap>+7</td><td nowrap>저장 상태 157,269,707</td><td nowrap>기록 없음</td><td nowrap>181.5초</td></tr>
<tr><td nowrap>p1785 r3 b0, [−3],<br>덱 5장(+5 +9 +10 ×3 ×8)</td><td nowrap>roll <b>1830.574102</b><br>−3 1829.384996</td><td nowrap>roll</td><td nowrap>저장 상태 4,044,826,527</td><td nowrap>기록 없음</td><td nowrap>1,765초</td></tr>
</tbody>
</table>

p1800 행의 메모리와 시간은 최적화 솔버의 값입니다. [근거 E6](sources.md#환경-연구)

## V\*: 값만 아는 상태

<table>
<thead>
<tr><th nowrap>상태</th><th nowrap align="right">V*</th><th nowrap>a*</th><th nowrap align="right">탐색량 (work)</th><th nowrap align="right">메모리</th><th nowrap align="right">시간</th></tr>
</thead>
<tbody>
<tr><td nowrap>p400 r1 b0, [+10 ×2], 전체 덱</td><td nowrap align="right">425.800441</td><td nowrap>+10</td><td nowrap align="right">2,474</td><td nowrap align="right">17.5 MiB</td><td nowrap align="right">0.025초</td></tr>
<tr><td nowrap>p400 r2 b0, 빈 손패, 전체 덱</td><td nowrap align="right">421.580823</td><td nowrap>roll (유일)</td><td nowrap align="right">640,825</td><td nowrap align="right">45.8 MiB</td><td nowrap align="right">0.65초</td></tr>
<tr><td nowrap>p721 r2 b0, 빈 손패, 전체 덱</td><td nowrap align="right">739.866660</td><td nowrap>roll (유일)</td><td nowrap align="right">15,406</td><td nowrap align="right">21.8 MiB</td><td nowrap align="right">0.10초</td></tr>
<tr><td nowrap>p900 r2 b0, 빈 손패, 전체 덱</td><td nowrap align="right">924.360495</td><td nowrap>roll (유일)</td><td nowrap align="right">그래프 605,385 상태</td><td nowrap align="right">기록 없음</td><td nowrap align="right">기록 없음</td></tr>
<tr><td nowrap>p1000 r2 b0, 빈 손패, 전체 덱</td><td nowrap align="right">1020.051876</td><td nowrap>roll (유일)</td><td nowrap align="right">35,601</td><td nowrap align="right">21.8 MiB</td><td nowrap align="right">0.10초</td></tr>
<tr><td nowrap>p1010 r2 b0, 빈 손패, 전체 덱</td><td nowrap align="right">1036.557513</td><td nowrap>roll (유일)</td><td nowrap align="right">1,063,746</td><td nowrap align="right">72.1 MiB</td><td nowrap align="right">1.31초</td></tr>
<tr><td nowrap>p400 r3 b0, 빈 손패, 배수 6장 덱</td><td nowrap align="right">438.820531</td><td nowrap>roll (유일)</td><td nowrap align="right">14,120</td><td nowrap align="right">23.1 MiB</td><td nowrap align="right">0.036초</td></tr>
<tr><td nowrap>p400 r4 b0, 빈 손패, 배수 6장 덱</td><td nowrap align="right">454.363743</td><td nowrap>roll (유일)</td><td nowrap align="right">186,134</td><td nowrap align="right">26.5 MiB</td><td nowrap align="right">0.31초</td></tr>
<tr><td nowrap>p1000 r3 b0, 빈 손패, 배수 6장 덱</td><td nowrap align="right">1039.627164</td><td nowrap>roll (유일)</td><td nowrap align="right">5,975</td><td nowrap align="right">22.9 MiB</td><td nowrap align="right">0.027초</td></tr>
<tr><td nowrap>p1000 r4 b0, 빈 손패, 배수 6장 덱</td><td nowrap align="right">1055.543698</td><td nowrap>roll (유일)</td><td nowrap align="right">85,736</td><td nowrap align="right">23.9 MiB</td><td nowrap align="right">0.13초</td></tr>
<tr><td nowrap>p400 r4 b0, [×10], 배수 6장 덱</td><td nowrap align="right">519.184226</td><td nowrap>roll</td><td nowrap align="right">기록 없음</td><td nowrap align="right">기록 없음</td><td nowrap align="right">기록 없음</td></tr>
</tbody>
</table>

- 이 표의 탐색량은 최적화 솔버 기준입니다.
- 같은 문제를 기존 솔버로 풀면 p400 r2는 1,156만 확장·688.5 MiB·11.9초, p1010 r2는 1,650만 확장·916.0 MiB·18.8초였습니다.

## a\*: 최적 행동만 인증한 상태

상한·하한으로 다른 행동을 모두 배제해 최적 행동을 확정했습니다. 값은 구간으로만 알기 때문에 정확한 점수로 쓰지 않습니다.

<table>
<thead>
<tr><th nowrap>상태</th><th nowrap>a*</th><th nowrap align="right">탐색량 (work)</th><th nowrap align="right">메모리</th><th nowrap align="right">시간</th></tr>
</thead>
<tbody>
<tr><td nowrap>p400 r2 b0, [+10 ×2], 전체 덱</td><td nowrap>roll</td><td nowrap align="right">1,149,361</td><td nowrap align="right">198.5 MiB</td><td nowrap align="right">35.5초</td></tr>
<tr><td nowrap>p1010 r2 b0, [+10 ×2], 전체 덱</td><td nowrap>+10</td><td nowrap align="right">1,414,640</td><td nowrap align="right">980.3 MiB</td><td nowrap align="right">46.4초</td></tr>
<tr><td nowrap>p1010 r3 b0, [×10], 전체 덱</td><td nowrap>roll</td><td nowrap align="right">177,938</td><td nowrap align="right">363.7 MiB</td><td nowrap align="right">2.09초</td></tr>
<tr><td nowrap>p400 r5 b0, [×10], 배수 6장 덱</td><td nowrap>roll</td><td nowrap align="right">322,234</td><td nowrap align="right">135.2 MiB</td><td nowrap align="right">9.75초</td></tr>
<tr><td nowrap>p400 r6 b0, [×10], 배수 6장 덱</td><td nowrap>roll</td><td nowrap align="right">1,974,464</td><td nowrap align="right">968.4 MiB</td><td nowrap align="right">53.2초</td></tr>
<tr><td nowrap>p400 r7 b0, [×10], 배수 6장 덱</td><td nowrap>roll</td><td nowrap align="right">550,606</td><td nowrap align="right">기록 없음</td><td nowrap align="right">29.0초</td></tr>
</tbody>
</table>

## 풀리지 않은 범위

- **전체 덱·빈 손패 r3–r5:** 상태당 노드 상한 1억에서 풀리지 않았습니다(당시 메모리 약 6.9 GB).
- **p1010 r3:** 최적 행동은 인증했지만, 모든 Q를 구하는 계산은 1억 노드·149초·6.6 GB에서 끝나지 않았습니다.
- **병렬 솔버:** 시간 상한 없이 54스레드·메모리 예산 1,380 GB로 실제 대국 r2 상태를 저장 상태 278.6억 개(5,627초)까지 풀었습니다. M₄₀ 세트의 상태 하나는 저장 상태 584.1억 개(5,324초, 메모리 1,304 GB)에서 표가 가득 차 이 예산으로 풀지 못했습니다. 노드 상한 500만에서 풀리지 않은 r2 2,242개 가운데 2,189개는 아직 계산하지 않았습니다.
- **r24 이상의 상태:** 최적 행동을 인증하지 못했습니다.

이 결과는 시험한 솔버와 예산에 대한 것이며, 더 긴 지평의 정확한 값이 불가능하다는 증명은 아닙니다.
