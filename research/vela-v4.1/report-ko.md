# FULL48 공통 구조 압축·손패·덱 상호작용 연구 결과

2026-09-27 · 실제 실행 완료 · 원본/운영 파일 변경 없음

## 1. 결론

**37.68 MiB 최종 후보 `quant_q6_k64_t12`의 비열등성 판정: 미충족.** 독립 원시 점수 평가에서 0.1% 비열등성 기준을 충족하지 못했다. 따라서 원본 FULL48의 대체 모델로 승격하지 않는다. 최종 90,000 paired 게임에서 원본 1878.0848점, 후보 1876.5108점, 차이 -1.5740점, 95% CI [-2.917, -0.231]이다. 허용 손실은 1.8781점이고, 관측 차이의 CI는 0보다 작다. 판정의 의미는 **허용 손실 경계와 CI가 겹쳐 비열등성 확인 불가**이다.

저차 시간 구조와 공유 고차 손패 패턴으로 큰 테이블을 줄이는 방향은 뒷받침된다. 그러나 낮은 행렬 오차, 적은 행동 불일치, 양의 시너지의 희소성만으로 정책 점수 보존을 확정할 수는 없다. 다음 설계에서는 양자화로 구조를 보존하면서 행동 차이에 민감한 고차 잔차를 더 잘 맞추는 쪽을 우선한다.

[원본 연구의 그림: 독립 최종 게임의 원시 점수 및 CV 신뢰구간]

## 2. 비교 조건과 독립성

기존 interaction spectrum 연구 (원본 연구 자료)의 H24 5장 손패 복원오차(pair 13.0639 → triple 5.1577 → 4차 2.5144)를 출발점으로 삼았다. 그 결과는 고차 정보가 필요하다는 근거이며, 고차 계수를 개별 저장해야 한다는 결론은 아니다. 기존 $`r=1`$로 변경한 1,024개 상태는 이번 최종 평가에 재사용하지 않았다.

기준은 원본 저장 FULL48 cap5 + v4 2-step expectimax + DeckPotential 0.6이다. 기존 온라인 구간의 실제 비복원 덱 전이를 유지했다. 저장 테이블은 tier0 FP32와 tier1~5 int16 delta/32, 합계 45,871,677,316 bytes (42.721 GiB)이다. FULL48의 각 r,b,p와 모든 80,730 멀티셋 손패를 대상으로 압축했고, 작은 cap2 게임이나 W±를 학습 목표로 삼지 않았다.

<table>
<thead>
<tr><th nowrap>자료</th><th nowrap>게임/정책</th><th nowrap>seed base</th><th nowrap>용도</th></tr>
</thead>
<tbody>
<tr><td nowrap>학습용 방문 상태</td><td nowrap>512</td><td nowrap>3110000000</td><td nowrap>희소 예외 학습·개발</td></tr>
<tr><td nowrap>별도 진단 상태</td><td nowrap>128</td><td nowrap>3111000000</td><td nowrap>2,533개 비어 있지 않은 손패 root;<br>후보 선택에도 사용</td></tr>
<tr><td nowrap>1차 선별 평가</td><td nowrap>10,000 × 26개 정책</td><td nowrap>3112000000</td><td nowrap>19 FULL48 압축 + 5 온라인(추가 예산 대조 포함)<br>+ 1 FULL100 + 기준</td></tr>
<tr><td nowrap>독립 최종</td><td nowrap>90,000 × 2개 정책</td><td nowrap>3120000000</td><td nowrap>동결 후보 하나와 기준, 9개 고정 shard</td></tr>
<tr><td nowrap>계산량</td><td nowrap>32 + 256 / 대상</td><td nowrap>3130000000</td><td nowrap>단일 thread 결정 지연 + 12-thread 처리량;<br>점수 증거로 미사용</td></tr>
</tbody>
</table>

최종 후보의 비교 게임은 10,000 + 90,000 = 100,000이다. 최종 성공 판정에 1차 선별 평가를 합치지 않았고, 중간 신뢰구간으로 중단하거나 최종 데이터로 모델을 수정하지 않았다. 같은 seed를 짝지었으나 기존 단일 RNG stream에서는 행동 분기 후 주사위/드로우 난수가 사건별로 계속 정렬되는 것은 아니다. 95% CI는 게임별 점수 차이의 표본 표준편차를 이용한 정규 근사이며, 개별 결정을 독립 표본으로 세지 않았다.

전체 실제 정책-게임 실행수는 **449,008**이다. 여러 정책의 합계이며 정책별 비교 수와 다르다. 유형별 합계 (원본 연구 자료)와 실행 장부 (원본 연구 자료)에 개발·진단·parity·pilot·계산량을 별도로 기록했다.

## 3. 구현한 압축 구조

$`\widehat F=B+\mathrm{low}_q+G+S`$이다. $`B`$는 모든 위치·bonus·시간에서 원본 FP32 값을 직접 저장한다. $`\mathrm{low}_q`$는 anchored singleton/pair 계수의 시간축만 분해한다. 반복 카드는 복사본 쌍을 정확히 세므로 같은 class의 pair는 $`\binom{m}{2}`$가 된다. 위치를 버킷으로 합치지 않았다.

$`G`$는 $`\mathbf a(r,b,p)^{\mathsf T}\boldsymbol\phi(H)`$인 공유 손패 embedding 모델이다. 전체 80,730 멀티셋을 입력으로 쓰므로 넓은 고차·비선형 손패 효과를 표현한다. 저차 복원 후 남는 최종 손패 잔차를 대상으로 학습했다. 작은 MLP나 semantic HOFM 자체를 구현한 것은 아니다. q4/q8/q6 저차 모델별로 $`G`$를 별도 학습했다. 784개 층/위치 행으로 basis를 구하고 1,024개 손패로 모든 위치·시간의 계수를 맞췄다. 일부 작은 K 모델은 64차원 공동 회귀 후 절단한 것으로, 해당 K의 최적 회귀를 보장하지 않는다.

$`S`$는 학습용 게임의 근접 행동 관련 leaf 466,521회 조회, 452,619개 고유 key에서 $`G`$ 이후 잔차를 저장한다. 우선순위는 잔차·조회 횟수·root action gap의 대리 지표이며 정확한 행동 민감도 최적화는 아니다. 개별 interaction 계수를 다시 더하지 않는다. 패턴 규칙으로 묶는 예외 모델은 이번 구현에 포함되지 않았다.

양자화 모델은 A/phi/G를 각각 대칭 int16 + scale로 저장하고 실행 중에도 int16 배열을 유지한다. 전체 FP32 모델을 RAM에 풀어 놓는 방식이 아니다. 공격형은 A에 추가 pair 축 rank $`J=16`$을 적용한다. 이름의 q는 저차 시간 rank, k는 손패 basis 수, t는 G의 시간 rank, s는 예외 MiB이다.

동결 후보 `quant_q6_k64_t12`의 실제 저장량 구성은 다음과 같다. 제안 당시의 예산표가 아니라 생성된 파일의 byte 수이며, 모든 모델의 합계와 파일 크기 일치를 검증했다.

<table>
<thead>
<tr><th nowrap>구성</th><th nowrap>bytes</th><th nowrap>MiB</th></tr>
</thead>
<tbody>
<tr><td nowrap>B</td><td nowrap>1,136,408</td><td nowrap>1.0838</td></tr>
<tr><td nowrap>low_time_basis</td><td nowrap>1,176</td><td nowrap>0.0011</td></tr>
<tr><td nowrap>low_position_coefficients</td><td nowrap>19,133,400</td><td nowrap>18.2470</td></tr>
<tr><td nowrap>pair_shared_basis</td><td nowrap>0</td><td nowrap>0.0000</td></tr>
<tr><td nowrap>hand_embedding</td><td nowrap>10,333,440</td><td nowrap>9.8547</td></tr>
<tr><td nowrap>G_time_basis</td><td nowrap>2,352</td><td nowrap>0.0022</td></tr>
<tr><td nowrap>G_position_coefficients</td><td nowrap>8,905,728</td><td nowrap>8.4932</td></tr>
<tr><td nowrap>sparse_keys_and_values</td><td nowrap>0</td><td nowrap>0.0000</td></tr>
<tr><td nowrap>header_and_scales</td><td nowrap>44</td><td nowrap>0.0000</td></tr>
<tr><td nowrap>합계</td><td nowrap>39,512,548</td><td nowrap>37.6821</td></tr>
</tbody>
</table>

진단으로 중복 카드의 저차 다항식은 80,730개 손패 전부에서 오차 0, C++/Python 값 비교는 19개 FULL48 모델 모두 허용오차 0.003 이내를 확인했다. 원본 실행 파일과 신규 reference 및 CV reference는 100게임의 점수·steps·action hash가 동일했다. 수치 검증 (원본 연구 자료), CV 전이 검증 (원본 연구 자료).

## 4. 가설 A: 시간축은 압축되지만 q=4의 국소 오차는 작지 않다

<table>
<thead>
<tr><th nowrap>q</th><th nowrap>FULL48 계수 MAE</th><th nowrap>FULL48 최대오차</th><th nowrap>FULL48 보존 에너지</th><th nowrap>FULL100 MAE</th><th nowrap>FULL100 최대오차</th></tr>
</thead>
<tbody>
<tr><td nowrap>2</td><td nowrap>0.9792</td><td nowrap>93.566</td><td nowrap>97.3586%</td><td nowrap>1.2904</td><td nowrap>78.269</td></tr>
<tr><td nowrap>4</td><td nowrap>0.6638</td><td nowrap>52.107</td><td nowrap>99.0786%</td><td nowrap>0.7322</td><td nowrap>75.936</td></tr>
<tr><td nowrap>6</td><td nowrap>0.3780</td><td nowrap>40.576</td><td nowrap>99.6998%</td><td nowrap>0.5226</td><td nowrap>51.470</td></tr>
<tr><td nowrap>8</td><td nowrap>0.2252</td><td nowrap>30.975</td><td nowrap>99.8829%</td><td nowrap>0.3053</td><td nowrap>47.372</td></tr>
<tr><td nowrap>12</td><td nowrap>0.0734</td><td nowrap>19.831</td><td nowrap>99.9772%</td><td nowrap>0.1311</td><td nowrap>24.408</td></tr>
<tr><td nowrap>16</td><td nowrap>0.0301</td><td nowrap>12.214</td><td nowrap>99.9931%</td><td nowrap>0.0583</td><td nowrap>18.522</td></tr>
</tbody>
</table>

에너지는 저차 계수 행렬의 제곱 크기 비율이다. 유한차분 interaction의 직교 ANOVA 분산 설명률이 아니다. q4가 평균 구조를 많이 설명해도 특정 시간·위치·pair의 큰 오차가 남는다. 따라서 $`q=4`$가 충분하다는 가정은 그대로 채택하지 않고, int16으로 q6~8 및 더 넓은 고차 구조를 예산 안에 넣는 후보를 추가했다.

위 계수 표는 factor 자체의 전수 복원 진단이다. 실제 정책과 최종 전수 가치 검사는 $`r=0,b=0`$에서 정확한 terminal 값을 직접 사용한다. 아래 국소 곡선에도 이 terminal 조건을 반영했다.

<table>
<thead>
<tr><th nowrap>q</th><th nowrap>최대오차의 r,b,p</th><th nowrap>실제 효과 조합</th><th nowrap>부호 있는 오차</th></tr>
</thead>
<tbody>
<tr><td nowrap>4</td><td nowrap>1,0,2827</td><td nowrap>NEXT_STAGE 1 + NEXT_STAGE 1</td><td nowrap>+52.1071</td></tr>
<tr><td nowrap>6</td><td nowrap>8,1,2827</td><td nowrap>NEXT_STAGE 1 + NEXT_STAGE 1</td><td nowrap>-40.5760</td></tr>
<tr><td nowrap>8</td><td nowrap>8,1,2827</td><td nowrap>NEXT_STAGE 1 + NEXT_STAGE 1</td><td nowrap>-30.9750</td></tr>
</tbody>
</table>

각 위치의 시간·계수 전체 최대오차는 위치별 최대오차 CSV (원본 연구 자료)에 보존했다. class 번호를 카드 가치 순위로 해석하지 않고 실제 이동/배수/스테이지 효과로 표시했다.

[원본 연구의 그림: 시간축 특이값 및 복원오차]

[원본 연구의 그림: 같은 스테이지 카드 두 장 계수의 국소 시간 변화]

q4/q6/q8 모두 큰 국소 오차가 $`p=2827`$의 스테이지 카드 중복 pair에 남았다. 전체 평균을 더 작게 만드는 것과 이런 위치의 시간 변화를 보존하는 것은 다르다. 후속안으로 특정 시간/위치의 저차 잔차 또는 국소 rank를 추가하는 가설을 세울 수 있지만, 이번 모델에서 검증한 개선으로 표시하지 않는다.

## 5. 가설 B: 고차 공유 구조·양자화·예외의 실제 1만 게임 비교

기준 평균은 이번 seed에서 **1878.5862점**이다. 아래 CI는 각 압축 모델과 기준의 nominal paired 95% CI이며 다수 후보 중 최고값을 선택한 최종 증거가 아니다.

<table>
<thead>
<tr><th nowrap>모델</th><th nowrap>MiB</th><th nowrap>평균 점수</th><th nowrap>기준 대비 Δ</th><th nowrap>95% CI</th><th nowrap>진단 Q 손실</th></tr>
</thead>
<tbody>
<tr><td nowrap>aggressive_j16_k8</td><td nowrap>5.69</td><td nowrap>1864.5615</td><td nowrap>-14.0247</td><td nowrap>[-18.757, -9.292]</td><td nowrap>0.08316</td></tr>
<tr><td nowrap>aggressive_j16_k8_s1</td><td nowrap>6.69</td><td nowrap>1865.2224</td><td nowrap>-13.3638</td><td nowrap>[-18.110, -8.617]</td><td nowrap>0.08316</td></tr>
<tr><td nowrap>pair_q2</td><td nowrap>13.25</td><td nowrap>1851.7029</td><td nowrap>-26.8833</td><td nowrap>[-31.605, -22.161]</td><td nowrap>0.11077</td></tr>
<tr><td nowrap>quant_q4_k32_t4</td><td nowrap>19.59</td><td nowrap>1872.9146</td><td nowrap>-5.6716</td><td nowrap>[-10.176, -1.167]</td><td nowrap>0.01932</td></tr>
<tr><td nowrap>pair_q4</td><td nowrap>25.41</td><td nowrap>1852.7852</td><td nowrap>-25.8010</td><td nowrap>[-30.427, -21.175]</td><td nowrap>0.10128</td></tr>
<tr><td nowrap>quant_q8_k0_t0</td><td nowrap>25.41</td><td nowrap>1854.4209</td><td nowrap>-24.1653</td><td nowrap>[-28.669, -19.662]</td><td nowrap>0.08750</td></tr>
<tr><td nowrap>quant_q8_k16_t8</td><td nowrap>29.30</td><td nowrap>1875.5833</td><td nowrap>-3.0029</td><td nowrap>[-7.210, +1.204]</td><td nowrap>0.01631</td></tr>
<tr><td nowrap>shared_q4_k16</td><td nowrap>31.76</td><td nowrap>1875.3300</td><td nowrap>-3.2562</td><td nowrap>[-7.808, +1.295]</td><td nowrap>0.01868</td></tr>
<tr><td nowrap>quant_q8_k32_t8</td><td nowrap>33.17</td><td nowrap>1875.7425</td><td nowrap>-2.8437</td><td nowrap>[-6.973, +1.285]</td><td nowrap>0.01463</td></tr>
<tr><td nowrap>quant_q6_k64_t8</td><td nowrap>34.85</td><td nowrap>1873.4446</td><td nowrap>-5.1416</td><td nowrap>[-9.180, -1.104]</td><td nowrap>0.01168</td></tr>
<tr><td nowrap>shared_q4_k16_s4</td><td nowrap>35.76</td><td nowrap>1875.3811</td><td nowrap>-3.2051</td><td nowrap>[-7.769, +1.359]</td><td nowrap>0.01909</td></tr>
<tr><td nowrap>quant_q8_k32_t16</td><td nowrap>36.01</td><td nowrap>1875.3152</td><td nowrap>-3.2710</td><td nowrap>[-7.351, +0.809]</td><td nowrap>0.01527</td></tr>
<tr><td nowrap>quant_q8_k48_t8</td><td nowrap>37.05</td><td nowrap>1872.0552</td><td nowrap>-6.5310</td><td nowrap>[-10.541, -2.521]</td><td nowrap>0.01537</td></tr>
<tr><td nowrap>quant_q6_k64_t12</td><td nowrap>37.68</td><td nowrap>1873.6424</td><td nowrap>-4.9438</td><td nowrap>[-8.946, -0.942]</td><td nowrap>0.01073</td></tr>
<tr><td nowrap>shared_q4_k32</td><td nowrap>38.10</td><td nowrap>1873.0121</td><td nowrap>-5.5741</td><td nowrap>[-10.080, -1.068]</td><td nowrap>0.01906</td></tr>
<tr><td nowrap>quant_q8_k40_t16</td><td nowrap>38.65</td><td nowrap>1872.6973</td><td nowrap>-5.8889</td><td nowrap>[-9.936, -1.842]</td><td nowrap>0.01407</td></tr>
<tr><td nowrap>shared_q4_k32_s1</td><td nowrap>39.10</td><td nowrap>1872.2694</td><td nowrap>-6.3168</td><td nowrap>[-10.810, -1.824]</td><td nowrap>0.01917</td></tr>
<tr><td nowrap>pair_q8</td><td nowrap>49.74</td><td nowrap>1854.5117</td><td nowrap>-24.0745</td><td nowrap>[-28.579, -19.570]</td><td nowrap>0.08744</td></tr>
<tr><td nowrap>shared_q8_k32</td><td nowrap>65.26</td><td nowrap>1866.8360</td><td nowrap>-11.7502</td><td nowrap>[-16.380, -7.121]</td><td nowrap>0.04847</td></tr>
</tbody>
</table>

`shared_q8_k32`는 q4에서 학습한 G를 q8 저차에 붙인 교차 basis 대조군이다. q8에 맞게 다시 학습한 고용량 상한으로 해석해서는 안 된다. 나머지 quant_q8/quant_q6 모델은 해당 저차 잔차에 맞춰 G를 학습했다. 참고 Q 손실은 $`Q_{\mathrm{ref}}(a_{\mathrm{ref}})-Q_{\mathrm{ref}}(a_{\mathrm{candidate}})`$이며 실제 최적 정책 $`V^{\ast}`$에 대한 regret은 아니다.

공격형 J16 역시 q4의 G를 추가 pair 분해 후 다시 학습하지 않고 절단해 옮겼다. S1은 그 최종 잔차에서 새로 만들었다. J16 도입과 K8 축소를 함께 적용했으므로 관측 손실을 pair 축 분해 하나의 효과로 분리할 수는 없다. 따라서 공격형 실패는 이번 두 단계 압축 표현에 대한 결과이며, 6~10 MiB의 모든 가능한 공동 학습 모델이 불가능하다는 결론은 아니다.

[원본 연구의 그림: 모든 순수 압축 모델의 1차 선별 평가]

저차만 남긴 q2/q4/q8은 약 24~27점 손실을 보였다. 공유 고차 G가 큰 부분을 회복한다. 다만 G 차원 증가가 게임 점수의 단조 개선을 보장하지 않는다. 제곱오차 회귀·시간 분해·절단 방식과 정책의 행동 선택은 서로 다른 목적이다.

동일 구조의 양자화·예외 효과는 별도 matched 비교로 분리했다. 직접 짝비교 원자료 (원본 연구 자료). q4K16에 4 MiB 예외를 추가한 점수 차이는 +0.0511점, 95% CI [-1.6858, +1.7880]으로 명확하지 않았다. q4K32의 FP32→int16 변화는 -0.0975점, CI [-0.3649, +0.1698]이었다. 용량을 줄일 때 먼저 계수 정밀도를 낮추고 상호작용 구조를 보존하는 선택을 지지한다. 5.69/6.69 MiB 공격형은 약 13~14점 손실로, 이번 표현에서 점수 보존을 확인하지 못했다.

별도 진단 게임을 원본 정책으로 재생하며 근접 행동의 leaf를 116,100회 표본 수집했다. 4 MiB 예외의 이 조회 분포상 적중률은 2.733%였다. 이는 학습한 개별 key 예외의 적용 범위를 보여주며, 모든 중요한 오류가 희소하다는 증거는 아니다. 예외 적용 범위 (원본 연구 자료).

## 6. 최종 동결 및 독립 9만 게임

40 MiB 이하이고 1차 선별 평가 평균 손실이 5점 이하인 모델 가운데 진단 Q 손실이 가장 작은 후보 하나를 골랐다. 선택 규칙과 모델/실행 파일 SHA256을 최종 데이터 열기 전에 동결했다. 후보는 `quant_q6_k64_t12`, 실제 모델 39,512,548 bytes = 37.6821 MiB이다. 동결 기록 (원본 연구 자료).

<table>
<thead>
<tr><th nowrap>지표</th><th nowrap>원시 점수: 주 판정</th><th nowrap>Martingale CV:<br>보조 판정</th></tr>
</thead>
<tbody>
<tr><td nowrap>원본 평균</td><td nowrap>1878.0848</td><td nowrap>1878.3545</td></tr>
<tr><td nowrap>압축 평균</td><td nowrap>1876.5108</td><td nowrap>1876.5089</td></tr>
<tr><td nowrap>차이</td><td nowrap>-1.5740</td><td nowrap>-1.8456</td></tr>
<tr><td nowrap>paired SD</td><td nowrap>205.5132</td><td nowrap>38.4289</td></tr>
<tr><td nowrap>95% CI</td><td nowrap>[-2.917, -0.231]</td><td nowrap>[-2.097, -1.595]</td></tr>
<tr><td nowrap>0.1% 판정</td><td nowrap>미충족</td><td nowrap>CI 기준 미충족</td></tr>
</tbody>
</table>

CV는 실제 다음 상태의 Phi와 실제 전이 전체의 기대 Phi 차이를 누적해 점수에서 빼는 조건부 평균 0 보정이다. Phi는 고정된 원본 FULL48와 기존 deck potential이고 계수는 1이다. 최종 seed로 Phi나 계수를 학습하지 않았다. 정책 선택과 RNG에 관여하지 않으며 추가 rollout도 없다. 원시 점수 주 판정이 실패하면 보조 CV가 좋아도 성공으로 바꾸지 않는다. 최종 CV 평가에만 원본 테이블을 읽는 것은 평가 도구의 비용이며 압축 정책의 배포 요구사항이 아니다.

## 7. 가설 C·D: 온라인 연쇄와 덱을 분리해서 비교

공통 leaf는 `quant_q8_k32_t16`(36.01 MiB)이다. free_gap은 root 1·2위 차이가 1점 미만일 때 draw 없는 무료 연쇄를 최대 512노드 보충한다. free_hand5는 root 손패가 5장인 경우도 켠다. true3/ iid3는 같은 gap 조건과 같은 상태 우선순위로 최대 24개 첫 후속 상태에 한 단계를 더 계산한다. 모든 chance 결과는 평균에 포함하고, 선택되지 않은 결과는 원래 2-step 값으로 평가한다.

기존 free 두 경우는 전역 512노드 예산을 행동 순서대로 사용해 앞 행동에 계산이 몰릴 수 있다. 코드 검토 후 별도 `online_free_balanced` 대조를 추가했다. 같은 gap 조건에서 고유 행동별 floor(512/행동수) 예산과 별도 cache를 사용한다. 각 행동 안의 분기 순서 효과까지 제거한 최적 예산 배분은 아니다. 추가 대조는 동결된 압축 후보와 최종 seed를 변경하지 않는 탐색적 1만 게임으로, ONLINE_BUDGET_CONTROL_ADDENDUM.md에 별도로 기록했다.

true3와 iid3는 추가 마지막 draw의 손패 가치 분포만 실제 덱/IID로 바꾼다. 기존 첫 2단계는 실제 덱이며 기존 scalar DeckPotential은 공통이다. 따라서 기존에 계산한 draw 보정을 다시 더하지 않는다. 이 대조는 전 구간의 완전한 비복원 Bellman 차이도, 학습한 장기 hand×deck tail 모델도 아니다.

두 경우의 같은 예산은 추가 상태 최대 24개와 같은 깊이 한도를 뜻한다. IID는 마지막 드로우에서 항상 22개 class를 평가하고 실제 덱은 남은 class만 평가하므로 실제 leaf 조회수와 실행시간까지 같지는 않다. 이 차이는 비용 표에 그대로 기록한다.

<table>
<thead>
<tr><th nowrap>탐색 선택 조건:<br>공통 q8 leaf 진단</th><th nowrap>선택 root 수</th><th nowrap>선택 비율</th><th nowrap>포함된 reference-Q<br>손실 비율</th></tr>
</thead>
<tbody>
<tr><td nowrap>gap_lt_1</td><td nowrap>146</td><td nowrap>5.76%</td><td nowrap>51.78%</td></tr>
<tr><td nowrap>gap_lt_1_or_hand5</td><td nowrap>352</td><td nowrap>13.90%</td><td nowrap>93.95%</td></tr>
<tr><td nowrap>gap_ge_1</td><td nowrap>2387</td><td nowrap>94.24%</td><td nowrap>48.22%</td></tr>
</tbody>
</table>

$`\mathrm{gap}\lt 1`$만 쓰면 진단 Q 손실의 약 48.2%가 선택 밖에 남았다. 손패5 조건을 더하면 약 93.9%를 포함하지만, 무료 연쇄 보충의 실제 개선은 확인되지 않았다. 잘못 판단한 상태를 고르는 문제와 그 상태의 값을 충분히 재계산하는 문제를 분리해야 한다. 이 비율은 원본 정책의 작은 진단 상태 집합에 대한 것으로 실제 게임 regret 비율이 아니다.

<table>
<thead>
<tr><th nowrap>경우</th><th nowrap>평균</th><th nowrap>원본 대비 Δ</th><th nowrap>nominal 95% CI</th><th nowrap>진단 Q 손실</th></tr>
</thead>
<tbody>
<tr><td nowrap>online_free_gap</td><td nowrap>1875.1976</td><td nowrap>-3.3886</td><td nowrap>[-7.471, +0.694]</td><td nowrap>0.01527</td></tr>
<tr><td nowrap>online_free_hand5</td><td nowrap>1875.1363</td><td nowrap>-3.4499</td><td nowrap>[-7.532, +0.632]</td><td nowrap>0.01527</td></tr>
<tr><td nowrap>online_true3_select24</td><td nowrap>1874.3311</td><td nowrap>-4.2551</td><td nowrap>[-8.153, -0.358]</td><td nowrap>0.01145</td></tr>
<tr><td nowrap>online_iid3_select24</td><td nowrap>1874.7187</td><td nowrap>-3.8675</td><td nowrap>[-7.706, -0.029]</td><td nowrap>0.01051</td></tr>
<tr><td nowrap>full100_screen</td><td nowrap>1873.4233</td><td nowrap>-5.1629</td><td nowrap>[-9.329, -0.997]</td><td nowrap>별도 horizon</td></tr>
<tr><td nowrap>online_free_balanced</td><td nowrap>1875.1801</td><td nowrap>-3.4061</td><td nowrap>[-7.487, +0.675]</td><td nowrap>0.01527</td></tr>
</tbody>
</table>

<table>
<thead>
<tr><th nowrap>같은 leaf/seed 짝비교</th><th nowrap>Δ</th><th nowrap>nominal 95% CI</th><th nowrap>4비교 family 95% CI</th></tr>
</thead>
<tbody>
<tr><td nowrap>free_gap_vs_same_leaf</td><td nowrap>-0.1176</td><td nowrap>[-0.576, +0.341]</td><td nowrap>[-0.702, +0.466]</td></tr>
<tr><td nowrap>free_hand5_vs_same_leaf</td><td nowrap>-0.1789</td><td nowrap>[-0.645, +0.287]</td><td nowrap>[-0.773, +0.415]</td></tr>
<tr><td nowrap>true_vs_iid_extra_draw</td><td nowrap>-0.3876</td><td nowrap>[-3.355, +2.579]</td><td nowrap>[-4.169, +3.393]</td></tr>
<tr><td nowrap>true_extra_vs_same_leaf</td><td nowrap>-0.9841</td><td nowrap>[-4.516, +2.548]</td><td nowrap>[-5.485, +3.517]</td></tr>
</tbody>
</table>

<table>
<thead>
<tr><th nowrap>사후 추가 예산 배분 대조</th><th nowrap>Δ</th><th nowrap>nominal 95% CI</th></tr>
</thead>
<tbody>
<tr><td nowrap>balanced_vs_same_leaf</td><td nowrap>-0.1351</td><td nowrap>[-0.462, +0.192]</td></tr>
<tr><td nowrap>balanced_vs_free_gap</td><td nowrap>-0.0175</td><td nowrap>[-0.483, +0.448]</td></tr>
</tbody>
</table>

[원본 연구의 그림: 온라인 탐색 및 덱 marginal 비교]

실제 방문한 $`n\lt 5`$ 진단 상태 2,310개에서, 같은 FULL48 후속 가치를 사용한 한 번의 draw 분포 변경량은 평균 절댓값 1.944점이었다. 이 중 $`\Delta_{\mathrm{deck}}(H)-\Delta_{\mathrm{deck}}(\varnothing)`$로 분리한 손패×덱 효과는 평균 절댓값 0.903점, 최대 12.627점이다. 압축 모델의 $`\Delta_{\mathrm{deck}}`$ 추정 오차는 평균 절댓값 0.353점이다. 손패를 무시한 scalar 하나가 놓치는 구조는 확인되지만, 이 숫자를 실제 게임 점수 이득으로 더하지 않는다.

[원본 연구의 그림: 손패 수에 따른 덱 상호작용]

## 8. FULL100 확장

r48의 원본 FP32 cap5 snapshot에서 같은 solver로 r49~100을 이어 계산했다. quantized 층을 재시작 입력으로 쓰지 않았으며, 원래 Bellman 반복 종료 조건 $`\mathrm{residual}\lt 0.001`$을 유지했다. 각 층의 모든 80,730 손패를 solver RAM에서 계산하고, 저차 전체와 1,536개 손패를 스트리밍 저장했다. r64/80/96/100 전체 FP32 checkpoint를 보존했다. 생성 시간은 1,372.74초(6 threads, 다른 연구 작업과 일부 경합)였다. 원본 FULL100 전체 파일과 원본 FULL100 정책 평가는 생성하지 않았으므로 FULL100 자체에 대한 압축 비열등성은 검증하지 않았다.

네 checkpoint마다 256개 위치/bonus 행의 저차 276개 값과 표본 1,536개 delta가 저장 스트림과 일치했다. FULL100 압축 모델의 별도 10,000개 C++/Python 조회 최대 차이는 0.000271점이었다. 원본 snapshot 이어 계산의 저장 정합성과 실행 구현 검증이며, 이 결과 자체가 FULL100 정책 점수 보존을 입증하지는 않는다.

FULL100 모델은 34.33 MiB이고, FULL48 q8에서 얻은 손패 basis를 옮기되 위치·시간 계수는 0~100의 목표값에 다시 맞췄다. 높은 horizon에서도 저장량 증가는 작았지만, 같은 q에서 FULL100의 계수 오차는 더 컸다. FULL48 기준과의 1만 게임 차이에는 horizon 변경과 압축이 함께 들어간다. 이 실험을 순수 압축 효과로 해석하지 않는다.

같은 q8/K32/t8 차원의 FULL48 압축 모델과 FULL100 압축 모델을 직접 짝비교한 차이는 -2.3192점, nominal 95% CI [-6.141, +1.502]이다. 이 비교도 시간 범위와 factor 재학습을 함께 바꾸므로 어느 한쪽 효과로 단정하지 않는다.

## 9. 원본 값에 대한 전수 오차와 작은 메타데이터

동결 후보에 대해 **22,935,554,460개 값**($`49\times5{,}798\times80{,}730`$)을 전수 비교했다. TF32를 끄고 GPU에서 계산했다. 이것은 방문 상태 분포가 아니라 저장 테이블 전체의 균등 격자 진단이다.

실제 진단 게임의 root 분포에서는 동결 후보의 가치 MAE가 1.3274점, 최대오차가 25.6673점이었다. 행동 불일치는 1.382%, 평균 reference-Q 손실은 0.01073점이다. 이를 아래 전수 격자의 최대오차와 혼동하지 않는다.

<table>
<thead>
<tr><th nowrap>손패 장수</th><th nowrap>전체 MAE</th><th nowrap>전체 RMSE</th><th nowrap>최대 절대오차</th></tr>
</thead>
<tbody>
<tr><td nowrap>0</td><td nowrap>0.0000</td><td nowrap>0.0000</td><td nowrap>0.0000</td></tr>
<tr><td nowrap>1</td><td nowrap>0.5846</td><td nowrap>0.8812</td><td nowrap>21.7300</td></tr>
<tr><td nowrap>2</td><td nowrap>1.0122</td><td nowrap>1.4765</td><td nowrap>25.4747</td></tr>
<tr><td nowrap>3</td><td nowrap>0.9214</td><td nowrap>1.6087</td><td nowrap>77.2436</td></tr>
<tr><td nowrap>4</td><td nowrap>1.6225</td><td nowrap>2.7460</td><td nowrap>134.2241</td></tr>
<tr><td nowrap>5</td><td nowrap>2.8730</td><td nowrap>4.4403</td><td nowrap>235.1652</td></tr>
</tbody>
</table>

<table>
<thead>
<tr><th nowrap>손패 수</th><th nowrap>r,b,p</th><th nowrap>최악 행에서의 손패 효과</th><th nowrap>C++ 확인 오차</th></tr>
</thead>
<tbody>
<tr><td nowrap>1</td><td nowrap>8,1,2707</td><td nowrap>NEXT_STAGE 1</td><td nowrap>+21.7300</td></tr>
<tr><td nowrap>2</td><td nowrap>2,1,2775</td><td nowrap>NEXT_STAGE 1 + NEXT_STAGE 1</td><td nowrap>+25.4748</td></tr>
<tr><td nowrap>3</td><td nowrap>0,1,2838</td><td nowrap>MOVE 1 + NEXT_STAGE 1 + NEXT_STAGE 1</td><td nowrap>+77.2436</td></tr>
<tr><td nowrap>4</td><td nowrap>0,1,1988</td><td nowrap>MOVE 6 + MOVE 6 + MOVE 6 + MOVE 6</td><td nowrap>-134.2241</td></tr>
<tr><td nowrap>5</td><td nowrap>1,0,1143</td><td nowrap>MOVE 11 + MOVE 11 + MOVE 11 + MOVE 11 + MOVE 11</td><td nowrap>+235.1652</td></tr>
</tbody>
</table>

위 극단 상태의 실제 게임 도달 가능성과 빈도는 입증하지 않았다. 특히 같은 카드 5장 패턴은 전체 basis를 구할 때는 포함됐지만, 위치별 계수를 맞추는 1,024개 손패 표본에는 없었다. 이 차이는 극단적인 중복 손패 오차의 가능한 설명이다. 모든 중복 카드를 학습에서 제외했다는 뜻도, 이런 극단 오차가 실제 게임 손실의 원인으로 확인됐다는 뜻도 아니다.

<table>
<thead>
<tr><th nowrap>5장 손패 중복 형태</th><th nowrap>테이블 손패 수</th><th nowrap>계수 fit 표본</th><th nowrap>진단 root 수</th><th nowrap>평균 진단 Q 손실</th></tr>
</thead>
<tbody>
<tr><td nowrap>1+1+1+1+1</td><td nowrap>26334</td><td nowrap>269</td><td nowrap>182</td><td nowrap>0.02311</td></tr>
<tr><td nowrap>2+1+1+1</td><td nowrap>29260</td><td nowrap>296</td><td nowrap>38</td><td nowrap>0.16815</td></tr>
<tr><td nowrap>2+2+1</td><td nowrap>4620</td><td nowrap>41</td><td nowrap>3</td><td nowrap>0.00000</td></tr>
<tr><td nowrap>3+1+1</td><td nowrap>4620</td><td nowrap>52</td><td nowrap>0</td><td nowrap>—</td></tr>
<tr><td nowrap>3+2</td><td nowrap>462</td><td nowrap>9</td><td nowrap>0</td><td nowrap>—</td></tr>
<tr><td nowrap>4+1</td><td nowrap>462</td><td nowrap>5</td><td nowrap>0</td><td nowrap>—</td></tr>
<tr><td nowrap>5</td><td nowrap>22</td><td nowrap>0</td><td nowrap>0</td><td nowrap>—</td></tr>
</tbody>
</table>

시간·bonus·손패 장수별, 위치 16개 묶음 최대오차에 부동소수점 여유를 더한 메타데이터는 428,064 bytes (0.4082 MiB)이다. C++ 무작위 20,000점에서 경계 위반 0건이었다. 2-step 행동 구간을 전파했을 때 진단 root 2,533개 중 686개(27.08%)에서 1위 행동 구간이 다른 행동과 분리됐고, 그 상태의 원본 행동 불일치는 0건이었다.

이는 저장 FULL48 대비의 전수 수치 오차 + 보수적 반올림 여유이다. 기계 검증된 부동소수점 증명이나 실제 $`V^{\ast}`$에 대한 bound는 아니다. 메타데이터는 후속 진단에서 생성했으며 동결 정책의 행동/최종 점수를 바꾸는 데 사용하지 않았다. 구간이 넓어 행동을 구분하지 못하는 비율도 함께 보고한다.

<table>
<thead>
<tr><th nowrap>손패 수</th><th nowrap>진단 root 수</th><th nowrap>행동 구간 분리 비율</th></tr>
</thead>
<tbody>
<tr><td nowrap>1</td><td nowrap>164</td><td nowrap>90.24%</td></tr>
<tr><td nowrap>2</td><td nowrap>425</td><td nowrap>70.35%</td></tr>
<tr><td nowrap>3</td><td nowrap>832</td><td nowrap>27.52%</td></tr>
<tr><td nowrap>4</td><td nowrap>889</td><td nowrap>1.12%</td></tr>
<tr><td nowrap>5</td><td nowrap>223</td><td nowrap>0.00%</td></tr>
</tbody>
</table>

이번 메타데이터는 큰 손패에서 특히 보수적이었다. 손패가 많은 구간에서 더 세밀한 조건부 오차 묶음이 필요하다는 진단이며, 작은 메타데이터만으로 모든 결정을 확정할 수 있다는 주장을 지지하지 않는다.

추가로 4/5장 손패를 서로 다른 카드·한 쌍·두 쌍·3장 이상 중복의 네 패턴으로 나눠 같은 전수 검사를 했다. 가치 함수 자체는 바꾸지 않고 오차 메타데이터만 세분화했다. 크기는 856,128 bytes (0.8165 MiB), 행동 구간 분리율은 30.36%였으며 C++ 표본 경계/분리 행동 위반은 0건이었다. 세분화 비교 (원본 연구 자료). 이 진단은 동결 이후 수행했으며 최종 정책에 적용하지 않았다.

[원본 연구의 그림: 동결 모델의 5장 손패 전수 복원오차]

## 10. 실제 계산량·캐시·배포 크기

이 연구의 생성/학습/성능 비교가 종료된 뒤 별도 비용 실행을 했다. 각 모델은 단일 thread 32게임의 모든 비어 있지 않은 손패 결정 지연과 12-thread 256게임의 전체 처리량을 기록했다. 원본을 앞뒤로 반복해 환경 변화도 볼 수 있게 했다. 작은 비용 실행의 점수는 성능 증거로 쓰지 않는다. OS·컴파일·CPU 정보는 runtime_environment.json에 있다. 초기 1차 선별 평가의 일부는 다른 기기 작업과 낮은 우선순위 때문에 긴 대기가 발생했다. 최종 게임 및 별도 비용 실행은 일반 우선순위이며 각 실행 시작 전 host CPU 사용률도 기록했다. 사용 중인 Windows 기기 전체를 전용 벤치마크 환경으로 통제한 것은 아니다.

<table>
<thead>
<tr><th nowrap>경우</th><th nowrap>모델 MiB</th><th nowrap>평균 ms</th><th nowrap>P95 ms</th><th nowrap>P99 ms</th><th nowrap>평균<br>/원본</th><th nowrap>12T<br>게임/s</th><th nowrap>leaf<br>조회/게임</th><th nowrap>1T RSS<br>MiB</th><th nowrap>12T RSS<br>MiB</th></tr>
</thead>
<tbody>
<tr><td nowrap>reference</td><td nowrap>43746.64</td><td nowrap>0.343</td><td nowrap>1.155</td><td nowrap>1.938</td><td nowrap>1.00</td><td nowrap>189.58</td><td nowrap>890031</td><td nowrap>1921.3</td><td nowrap>5001.4</td></tr>
<tr><td nowrap>pair_q2</td><td nowrap>13.25</td><td nowrap>0.246</td><td nowrap>0.646</td><td nowrap>0.974</td><td nowrap>0.72</td><td nowrap>149.70</td><td nowrap>805690</td><td nowrap>26.1</td><td nowrap>56.1</td></tr>
<tr><td nowrap>pair_q4</td><td nowrap>25.41</td><td nowrap>0.277</td><td nowrap>0.747</td><td nowrap>1.178</td><td nowrap>0.81</td><td nowrap>142.27</td><td nowrap>829362</td><td nowrap>38.2</td><td nowrap>68.3</td></tr>
<tr><td nowrap>pair_q8</td><td nowrap>49.74</td><td nowrap>0.302</td><td nowrap>0.783</td><td nowrap>1.182</td><td nowrap>0.88</td><td nowrap>119.56</td><td nowrap>882886</td><td nowrap>62.6</td><td nowrap>92.6</td></tr>
<tr><td nowrap>shared_q4_k16</td><td nowrap>31.76</td><td nowrap>0.347</td><td nowrap>0.961</td><td nowrap>1.536</td><td nowrap>1.01</td><td nowrap>102.09</td><td nowrap>882448</td><td nowrap>44.6</td><td nowrap>74.6</td></tr>
<tr><td nowrap>shared_q4_k32</td><td nowrap>38.10</td><td nowrap>0.467</td><td nowrap>1.290</td><td nowrap>2.066</td><td nowrap>1.36</td><td nowrap>82.95</td><td nowrap>889877</td><td nowrap>51.0</td><td nowrap>81.0</td></tr>
<tr><td nowrap>shared_q8_k32</td><td nowrap>65.26</td><td nowrap>0.497</td><td nowrap>1.354</td><td nowrap>2.276</td><td nowrap>1.45</td><td nowrap>71.11</td><td nowrap>928070</td><td nowrap>78.1</td><td nowrap>108.1</td></tr>
<tr><td nowrap>aggressive_j16_k8</td><td nowrap>5.69</td><td nowrap>0.455</td><td nowrap>1.155</td><td nowrap>1.700</td><td nowrap>1.33</td><td nowrap>98.48</td><td nowrap>878154</td><td nowrap>18.6</td><td nowrap>48.6</td></tr>
<tr><td nowrap>shared_q4_k16_s4</td><td nowrap>35.76</td><td nowrap>0.552</td><td nowrap>1.552</td><td nowrap>2.515</td><td nowrap>1.61</td><td nowrap>69.41</td><td nowrap>877324</td><td nowrap>48.6</td><td nowrap>78.6</td></tr>
<tr><td nowrap>shared_q4_k32_s1</td><td nowrap>39.10</td><td nowrap>0.608</td><td nowrap>1.695</td><td nowrap>2.808</td><td nowrap>1.77</td><td nowrap>60.63</td><td nowrap>886843</td><td nowrap>52.0</td><td nowrap>82.0</td></tr>
<tr><td nowrap>aggressive_j16_k8_s1</td><td nowrap>6.69</td><td nowrap>0.639</td><td nowrap>1.652</td><td nowrap>2.653</td><td nowrap>1.86</td><td nowrap>69.51</td><td nowrap>882192</td><td nowrap>19.6</td><td nowrap>49.6</td></tr>
<tr><td nowrap>quant_q4_k32_t4</td><td nowrap>19.59</td><td nowrap>0.533</td><td nowrap>1.421</td><td nowrap>2.259</td><td nowrap>1.55</td><td nowrap>69.62</td><td nowrap>887912</td><td nowrap>32.4</td><td nowrap>62.5</td></tr>
<tr><td nowrap>quant_q8_k0_t0</td><td nowrap>25.41</td><td nowrap>0.360</td><td nowrap>0.926</td><td nowrap>1.330</td><td nowrap>1.05</td><td nowrap>109.09</td><td nowrap>881724</td><td nowrap>38.2</td><td nowrap>68.3</td></tr>
<tr><td nowrap>quant_q8_k16_t8</td><td nowrap>29.30</td><td nowrap>0.439</td><td nowrap>1.171</td><td nowrap>1.737</td><td nowrap>1.28</td><td nowrap>88.64</td><td nowrap>871384</td><td nowrap>42.2</td><td nowrap>72.2</td></tr>
<tr><td nowrap>quant_q8_k32_t8</td><td nowrap>33.17</td><td nowrap>0.550</td><td nowrap>1.484</td><td nowrap>2.339</td><td nowrap>1.61</td><td nowrap>70.82</td><td nowrap>872076</td><td nowrap>46.0</td><td nowrap>76.0</td></tr>
<tr><td nowrap>quant_q8_k32_t16</td><td nowrap>36.01</td><td nowrap>0.545</td><td nowrap>1.449</td><td nowrap>2.084</td><td nowrap>1.59</td><td nowrap>67.38</td><td nowrap>869732</td><td nowrap>48.8</td><td nowrap>78.9</td></tr>
<tr><td nowrap>quant_q8_k48_t8</td><td nowrap>37.05</td><td nowrap>0.679</td><td nowrap>1.916</td><td nowrap>3.201</td><td nowrap>1.98</td><td nowrap>59.69</td><td nowrap>869294</td><td nowrap>49.9</td><td nowrap>80.0</td></tr>
<tr><td nowrap>quant_q8_k40_t16</td><td nowrap>38.65</td><td nowrap>0.656</td><td nowrap>1.727</td><td nowrap>3.135</td><td nowrap>1.91</td><td nowrap>64.67</td><td nowrap>867890</td><td nowrap>51.5</td><td nowrap>81.5</td></tr>
<tr><td nowrap>quant_q6_k64_t8</td><td nowrap>34.85</td><td nowrap>0.897</td><td nowrap>2.443</td><td nowrap>4.020</td><td nowrap>2.62</td><td nowrap>48.81</td><td nowrap>878210</td><td nowrap>47.7</td><td nowrap>77.7</td></tr>
<tr><td nowrap>quant_q6_k64_t12</td><td nowrap>37.68</td><td nowrap>1.015</td><td nowrap>2.777</td><td nowrap>4.167</td><td nowrap>2.96</td><td nowrap>45.89</td><td nowrap>876018</td><td nowrap>50.5</td><td nowrap>80.6</td></tr>
<tr><td nowrap>online_free_gap</td><td nowrap>36.01</td><td nowrap>0.605</td><td nowrap>1.660</td><td nowrap>2.800</td><td nowrap>1.76</td><td nowrap>57.08</td><td nowrap>951423</td><td nowrap>50.4</td><td nowrap>80.9</td></tr>
<tr><td nowrap>online_free_hand5</td><td nowrap>36.01</td><td nowrap>0.700</td><td nowrap>1.983</td><td nowrap>3.264</td><td nowrap>2.04</td><td nowrap>58.06</td><td nowrap>1013647</td><td nowrap>50.5</td><td nowrap>80.9</td></tr>
<tr><td nowrap>online_true3_select24</td><td nowrap>36.01</td><td nowrap>1.062</td><td nowrap>3.389</td><td nowrap>13.938</td><td nowrap>3.10</td><td nowrap>41.33</td><td nowrap>1701647</td><td nowrap>49.1</td><td nowrap>80.2</td></tr>
<tr><td nowrap>online_iid3_select24</td><td nowrap>36.01</td><td nowrap>1.210</td><td nowrap>4.470</td><td nowrap>16.388</td><td nowrap>3.53</td><td nowrap>35.12</td><td nowrap>2026230</td><td nowrap>49.1</td><td nowrap>80.6</td></tr>
<tr><td nowrap>reference_repeat</td><td nowrap>43746.64</td><td nowrap>0.348</td><td nowrap>1.167</td><td nowrap>1.896</td><td nowrap>1.01</td><td nowrap>196.26</td><td nowrap>890031</td><td nowrap>1897.2</td><td nowrap>4882.4</td></tr>
<tr><td nowrap>online_free_balanced</td><td nowrap>36.01</td><td nowrap>0.616</td><td nowrap>1.700</td><td nowrap>2.788</td><td nowrap>1.80</td><td nowrap>63.29</td><td nowrap>945916</td><td nowrap>50.4</td><td nowrap>80.7</td></tr>
<tr><td nowrap>full100_quant_q8_k32_t8</td><td nowrap>34.33</td><td nowrap>0.639</td><td nowrap>1.628</td><td nowrap>2.680</td><td nowrap>1.86</td><td nowrap>60.01</td><td nowrap>895984</td><td nowrap>47.2</td><td nowrap>77.2</td></tr>
</tbody>
</table>

[원본 연구의 그림: 단일 결정 지연 및 병렬 게임 처리량]

압축 모델은 파일의 학습 파라미터 외에 약 1.31 MiB의 add index와 2.46 MiB의 subhand index를 만든다. 행 계수 cache는 thread별 2,048행 × 339 floats와 tag로 약 2.66 MiB이다. 원래 검색 cache는 true/IID 각각 최대 16,384개 상태, 무료 추가는 최대 512개 계산 노드, 선택적 깊은 탐색은 24개 추가 상태로 제한했다. unordered_map의 allocator와 thread stack은 실제 RSS에 포함된다. 온라인 cache를 모델 파일 크기에 숨기지 않았다.

전체 FULL48는 mmap이므로 파일 크기·가상 주소 공간·현재 RSS가 다르다. RSS는 해당 비용 실행의 관측 peak이고, OS file cache 정책이나 다른 프로세스까지 포함한 전체 RAM 사용량 보장이 아니다. 단일 결정 지연과 병렬 처리량은 서로 대체 지표가 아니다. 대략 10배 계산 예산은 표의 평균 비율 및 P95/P99와 함께 판단해야 한다.

동결 후보의 단일 결정 평균은 원본 첫 비용 실행의 2.96배로, 관측 평균 기준 10배 이내 조건을 만족했다. Windows native C++ 연구 구현에서 측정한 결과이며 웹/WASM·모바일 이식과 실측은 수행하지 않았다.

## 11. 최종적으로 보강한 가설과 다음 연구의 경계

1. **시간 공유 구조는 실제로 존재하지만 작은 q의 국소 정확도는 별도 문제다.** q4의 큰 최대오차를 평균 에너지로 덮지 않는다. 위치 해상도 유지 + int16 q6~8을 우선 비교 대상으로 둔다.
2. **공유 고차 잔차는 필수적이다.** pair만 남긴 손실을 G가 크게 줄였다. 다음 학습 목표는 값의 전역 MSE뿐 아니라 가까운 행동들의 Q 차이이며, 큰 손패에서 남은 오류를 집중적으로 다룬다.
3. **예외의 희소성은 아직 성립을 확인하지 못했다.** 이번 dev leaf 기반 S4는 명확한 이득이 없었다. 원래 interaction 크기순 저장으로 돌아갈 근거가 없다.
4. **무료 연쇄·추가 확률 전개는 실제 whole-game 결과와 비용을 함께 봐야 한다.** 테이블이 이미 반영한 무료 사용을 다시 max하는 계산이 항상 이득이라는 가정은 하지 않는다.
5. **손패×덱 조건부 효과는 존재한다.** 기존 탐색 경계 이후에 남는 효과를 정확히 구분하고, 방문 확률·행동 gap·잔차 신호를 추가 계산 선택에 사용한다. variance/top-card mass를 기대점수에 직접 더하지 않는다.
6. **6~10 MiB는 아직 성공한 목표가 아니다.** 추가 pair 축 factorization의 손실을 줄일 새 학습/국소 보완 없이는 주력안으로 채택하지 않는다.
7. **FULL100 용량 확장은 가능했으나 성능 보존 증명은 남아 있다.** 같은 rank가 충분하다고 일반화하지 않으며, FULL100 자체 원본 정책 기준이 필요하다.

미구현 범위는 semantic 그룹 특성의 별도 ablation, 별도 작은 MLP/HOFM, 구간 규칙 기반 S, 학습한 hand×deck tail residual, FULL100 전체 원본 정책, 독립 최종 게임을 통한 여러 온라인 후보의 동시 확인이다. 이들을 수행했다고 표시하지 않는다. 현재 결과를 바탕으로 다음 연구를 설계할 수 있지만 이번 동결 후보를 최종 게임에 맞춰 재튜닝하지 않았다.

후속 학습의 구체적인 우선순위는 (a) 위치별 회귀 표본을 중복 장수 패턴별로 층화하고 드문 순수 반복 손패도 anchor로 포함하기, (b) 전역 가치 MSE와 함께 경쟁 행동의 상대 $`Q`$ 차이를 학습하기, (c) $`p=2827`$ 같은 국소 시간 곡선에 작은 저차 잔차 또는 추가 시간 basis를 배분하기다. 이는 추가 검증할 가설이며, 이번 최종 모델의 측정된 개선으로 세지 않는다.

## 12. 논문·자료와 재현

아래 자료는 설계 방향의 근거이며, VELA에서 특정 MiB의 점수 보존을 입증한 자료는 아니다.

- [Higher-Order Factorization Machines](https://papers.nips.cc/paper/6144-higher-order-factorization-machines.pdf): 고차 상호작용의 공유 표현. 원래 distinct-feature kernel을 중복 카드에 그대로 대입하지 않았다.
- [Tensor Low-rank Approximation of Finite-horizon Value Functions](https://arxiv.org/abs/2405.17628): 시간축을 포함한 가치 텐서 분해. 실제 필요한 rank는 이번 전수 분석으로 측정했다.
- [The Value Equivalence Principle](https://arxiv.org/abs/2011.03506): 계획에 유용한 가치 정보를 보존하는 방향. 이번 근사가 논문의 정확한 동치 조건을 만족한다고 주장하지 않는다.
- [Value-Aware Loss Function](https://proceedings.mlr.press/v54/farahmand17a.html): 계획 가치에 민감한 학습 목적의 근거. 후속 연구에서 행동 Q 차이의 가중을 검토한다.
- [Finding Structure with Randomness](https://authors.library.caltech.edu/records/hy0mc-xmn26): 큰 행렬의 공유 subspace 추출. 저차는 전수 시간 Gram, 고차는 표본 행으로 구분했다.
- [AIVAT](https://arxiv.org/abs/1612.06915): 고정된 가치 휴리스틱의 평균 0 보정에 의한 평가 분산 감소. 여기서는 chance martingale CV만 사용했다.

원자료는 전체 비교 CSV (원본 연구 자료), 최종 판정 JSON (원본 연구 자료), 모델 크기·해시 (원본 연구 자료), 최종 무결성 확인 (원본 연구 자료), 재현 절차 (원본 연구 자료)에 있다. 실험 protocol의 사전 변경은 PROTOCOL_AMENDMENTS.md와 CV_PROTOCOL_ADDENDUM.md에 남겼다.
