# LYRA용 JSEP 캐시 정리

`ort.all.min.mjs`는 ONNX Runtime Web 1.30.0 원본에 Worker 내부용 미사용 버퍼 정리 함수를 추가한 파일이다. 원본 라이선스는 유지한다.

- 추론 도중의 버퍼 풀, 버퍼 크기, 셰이더, 모델 및 FP32 연산은 변경하지 않는다.
- 모든 후보의 추론·결과 읽기·텐서 해제가 끝난 뒤, 사용하지 않는 storage buffer만 정리한다. 활성 텐서·가중치·대기 중인 버퍼는 건드리지 않는다.
- 추천 완료 후 미사용 storage buffer 캐시는 최대 256 MiB다. 이는 전체 RAM/VRAM이나 추론 배치에 대한 제한이 아니다. GPU 높음은 모든 후보를 한 번에 처리한다.
- 사용량을 낮출 때는 설정 적용 시 미사용 캐시를 추가로 정리한다. CPU fallback 시에도 남은 미사용 GPU 캐시를 정리한다.

생성·검증: `node scripts/lyra-runtime-cache.mjs` / `node scripts/lyra-runtime-cache.mjs --check`.

스크립트는 패치를 되돌린 소스의 SHA-256이 고정한 원본과 같은지 검증한다. 런타임 업그레이드 시에는 새 원본과 캐시 내부 구조를 검토하고 재검증해야 한다. 압축 모델 패키지와 WASM은 변경하지 않는다.
