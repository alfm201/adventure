// 화면과 계산 worker가 같은 배포에서 왔는지 확인한다.
//
// 이 서비스는 빌드 없이 정적 파일을 그대로 제공한다. 열려 있던 화면이 worker를 새로 만들면
// 그 사이에 배포된 worker 파일을 읽을 수 있고, 그러면 두 쪽의 메시지 형식이나 모델이 서로 맞지 않는다.
// 화면은 worker에 일을 맡길 때 자기 식별자를 함께 보내고, worker는 자기 것과 다르면
// VERSION_MISMATCH 코드로 답한다. 화면은 이 코드를 받으면 어디서든 새로고침을 안내한다
// (presentation/components/support.js, presentation/overlays/model-preparation.js, application/coordinator.js).
//
// 식별자는 화면과 worker 사이의 약속이 바뀔 때 반드시 함께 바뀌는 값으로 정한다.
// VELA·LYRA는 모델 ID에 메시지 형식 번호를 붙인 WORKER_VERSION, X36은 규칙·프로토콜·정책 버전이다.
//
// 같은 이유로, 저장해 둔 모델을 정리할 때는 자기보다 과거의 것임을 확인할 수 있는 것만 지운다
// (vela/storage.js, lyra/package.js). 더 새로운 것이나 순서를 모르는 것은 새 버전의 화면이 저장한 것일 수 있다.
export const VERSION_MISMATCH = "version-mismatch";
// 새로고침한 직후에도 불일치가 이어질 때 화면이 쓰는 안내의 코드(platform/reload.js).
export const VERSION_STALE = "version-stale";

export function versionMismatch() {
  return Object.assign(Error("화면과 계산 코드의 버전이 다릅니다."), { code: VERSION_MISMATCH });
}

// 받은 식별자가 자기 것과 다르면 던진다. 식별자가 없는 메시지는 이 확인이 생기기 전의 화면이 보낸 것이다.
export function assertSameVersion(received, own) {
  if (received !== own) throw versionMismatch();
}
