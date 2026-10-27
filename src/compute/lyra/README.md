# LYRA v1 — 실행·연결

- 화면 흐름은 모델 선택 → 실행 장치·사용량 선택 → 모델 준비(저장 선택·다운로드·완료) → 시작/적용이다. 준비 화면은 VELA와 공통 컴포넌트를 사용하며, 실행 설정의 `다음`에서는 모델을 다운로드하지 않는다. 이전 단계로 돌아가면 선택값을 유지한다.

- 제품명 `LYRA v1`, 연구 기준 `V₂₀` 가치망 + `π₂₀` 1-step 정책.
- 모델·특징·CPU/GPU WASM·라이선스 고지는 단일 `lyra-v1.bin.gz`(31,036,272 bytes)로 제공한다. 로컬 호스트에서는 프로젝트 파일을 읽고, 일반 호스팅에서는 Cloudflare에서 받는다. 메타데이터는 `public/models/lyra-v1/`, JavaScript는 `public/runtime/onnxruntime-web/1.30.0/`에 있다. 모델 학습·변환 코드와 설명은 `research/lyra-v1/`에 있다.
- `model.js`에 원본 체크포인트·ONNX·특징·메타데이터·패키지 SHA-256을 고정했다. 모델 로딩 시 패키지 전체와 내부 모델·특징·WASM 파일을 검증한다.
- `package.js`는 다운로드 크기·SHA-256, 압축 해제 크기·해시, 라이선스 고지를 포함한 내부 5개 파일을 검증한다. 브라우저 저장 선택 시 압축 패키지를 Cache Storage에 보관하며 저장 실패는 현재 접속의 사용을 막지 않는다. 패키지는 메모리에서도 재사용하므로 저장하지 않은 경우에도 같은 페이지의 엔진 전환에 추가 모델 요청이 없다.
- ONNX Runtime Web 1.30.0의 CPU는 `ort.wasm.min.mjs`, GPU는 업로드된 JSEP WASM과 맞는 `ort.all.min.mjs`를 사용한다. `wasmBinary`로 검증된 바이트를 전달하며 별도 WASM 네트워크 요청은 하지 않는다. 이전 webgpu-only frontend는 asyncify 바이너리를 요구하므로 이 JSEP 패키지와 섞지 않는다.
- VELA와 같은 로컬 호스트 판별을 사용한다. localhost·127.x·루프백에서는 `public/models/lyra-v1/lyra-v1.bin.gz`를 읽고, 일반 호스팅에서는 Cloudflare를 사용한다. 패키지는 Git 제외 대상이다. 임시 중계 경로와 Origin 헤더 설정은 제거했다.
- 선택 장치: `auto`(기본), `cpu`, `gpu`. CPU는 WASM 1스레드이며 사이트의 공유 메모리 헤더를 변경하지 않는다. WebGPU는 하드웨어 어댑터만 허용한다.
- 모델 선택 → 다음 → 별도 실행 장치/사용량 선택 화면이다. X36과 같은 `showSettings` 함수의 선택 카드·사용량 UI·이전/취소/적용 흐름을 재사용한다.
- 사용량은 `low`/`medium`(기본)/`high`이며 저장하지 않는다. 낮음은 CPU 배치 8개/배치 사이 16ms 양보, GPU 배치 16개/8ms 양보다. 보통은 배치 최대 64개/배치 사이 타이머 양보, 높음은 전체 자식을 한 배치로 추론한다. 모든 합법 행동·자식·확률·FP32 가치망을 그대로 계산한다. CPU 스레드 수나 GPU 점유율의 고정 상한을 뜻하지 않는다.
- GPU 선택 활성화는 별도의 LYRA 어댑터·장치 생성 검사 기준이다. 모델 준비 단계에서 실제 ONNX 실행도 확인한다. X36의 시뮬레이션 셰이더/가용성 검사를 LYRA 추론 성공의 근거로 사용하지 않는다.
- 자동은 GPU 준비·추론 실패 시 CPU로 다시 실행한다. GPU 직접 선택은 오류를 알리며 몰래 CPU로 바꾸지 않는다. 선택값을 저장소에 기록하지 않으며 페이지를 새로 열면 자동이다.
- 같은 실행 장치 선택에서 사용량만 바꾸면 기존 Worker·ORT 세션을 재사용한다. 준비는 사용량 변경을 예약만 하며, 시작/적용 때 직렬 메시지로 반영한다. 취소는 실행 중 설정을 유지한다.
- 디코딩한 패키지는 ORT 초기화 전에 참조를 정리하고, 초기화 뒤 WASM 입력 바이너리 옵션·불필요한 모델 복사본을 해제한다. 자동 GPU 모드는 CPU 전환에 필요한 가중치를 유지한다.
- GPU는 계산 중 버퍼 재사용을 원본대로 유지하고, 추천 완료 후 미사용 버퍼 캐시만 최대 256 MiB로 정리한다. 높은 사용량의 전체 후보 일괄 배치와 FP32 연산은 유지한다. `public/runtime/onnxruntime-web/1.30.0/LYRA-CACHE.md`와 `scripts/lyra-runtime-cache.mjs --check` 참고.
- `policy.js`는 독립 벤치마크에서 256개 상태로 검증한 구현을 그대로 가져왔다. 종료 자식 처리, 동일 입력 중복 제거, 위치 특징 캐시와 마지막 층 최적화 외에 모델·정책 변경이 없다.
- 손패의 물리 ID·실제 잔여 덱을 입력한다. 효과 클래스 순서에 따른 동점 처리와 중복 효과를 유지하면서 반환값을 입력 손패 슬롯으로 변환한다.
- 완료된 가치/Q는 행동 비교용이다. 예상 최종 점수는 `public/models/lyra-v1/predictor.json`과 `src/policies/lyra/predictor.mjs`의 LYRA v1 전용 예측기(`lyra-v1-score-v1`, 300개 트리)로 계산한다. 입력 Q는 FP32 1-step의 최선 행동 값이며 정책·행동 선택에는 사용하지 않는다. 게임 종료 시에는 실제 점수를 표시한다.
- `score.js`는 예측기 파일의 SHA-256, 원본 체크포인트·ONNX·패키지 해시와 카드 클래스 배열을 확인한다. 엔진 준비와 병렬 로딩하며 실패해도 추천은 유지한다. 진단 정보의 `scorePredictor`에 준비 여부와 파일 해시를 기록한다. 예측기만 갱신할 때 LYRA 모델 패키지를 다시 받을 필요는 없다.
- 진단 정보에는 `lyra-v1`, 원본 체크포인트 해시, `V₂₀`/`π₂₀`, FP32, 실행 장치 선호/실제 장치, 전환 사유와 ORT 버전이 들어간다.

## 모델 선택창 연구 평가 점수

표시: **연구 평가 약 1,879점**. 보정 설명은 사용자 화면에 넣지 않는다.

근거는 연구 프로젝트 `deck_actor_20261011/results/vi4eval_v20_p0_games.npz`부터 `p4`까지 총 10,000판이다. 연구 커널의 시작 기준값 1,852.66015625에 `sumd` 평균을 더한 추정값은 **1,879.173486191134**, 표준오차 약 **0.4020점**이다. 같은 표본의 Hinge 추정값은 1,877.6873653037064이며 차이는 연구 보고서의 +1.4861208874283682와 일치한다. 단순 관측 평균 1,876.8228과 구분한다. 계산 기록은 `temp/lyra-v1-score-source.json`.

## 검증

테스트 서버 4174 실행 후:

```powershell
node tests/models/lyra-v1.mjs
node tests/models/lyra-score.mjs
node tests/models/lyra-score-browser.mjs
node tests/models/lyra-download.mjs
node tests/models/lyra-fallback.mjs
node tests/models/lyra-usage.mjs
node tests/ui/lyra-controls.mjs
node tests/ui/estimate-colors.mjs
node tests/assist/display.mjs
node tests/assist/voice.mjs
```

상태별 참조는 원본 PyTorch FP32 결과다. 수치 기준은 Q 절대 오차 0.002점 이하, 추천 효과 클래스 불일치 0이다. 전역적인 비트 동일성이나 모든 가능한 상태의 행동 동일성을 보증하는 시험은 아니다. 결과는 `tests/results/lyra-*.json`에 기록한다.

사용량 검증은 CPU/GPU 각각 낮음·보통·높음의 6개 설정에서 초·중·후반, 추가 굴림 유무, 종료 경계와 분기가 많은 13개 상태를 비교한다.

## 메모리 안내

- 준비 화면은 선택한 장치·사용량에 맞춰 RAM/VRAM 권장 여유를 구분한다. CPU는 RAM 600 MB, GPU 낮음/보통/높음은 RAM 1.2/1.5/3 GB 및 VRAM 150/300/1200 MB를 안내한다. 자동은 GPU 사용 가능 여부에 맞춘다.
- 측정 방법·수치·한계: `temp/lyra-memory-20261016/README.md`. 독립 Chrome PID의 기준 대비 전용 커밋 RAM 및 전용 GPU 메모리 표본에 여유를 더한 값이며, 모든 기기의 최소 요구량이나 절대 피크를 보장하지 않는다.
- 메모리 최적화 전후 비교: `temp/lyra-memory-opt-20261016/README.md`. 세션 재사용·로딩 참조 정리·추론 후 미사용 GPU 캐시 정리를 반영했다. 전체 후보 일괄 배치가 만드는 순간 피크와 기기별 편차를 고려하여 위 권장 여유는 보수적으로 유지한다.
