import { dialog } from "./dialogs.js";

export const NOTICE_VERSION = "2026.09.25.1";
const STORAGE_KEY = "adventure.notice.dismissed_version";

export function isNoticeDismissed(version = NOTICE_VERSION) {
  try {
    return localStorage.getItem(STORAGE_KEY) === version;
  } catch {
    return false;
  }
}

export function dismissNotice(version = NOTICE_VERSION) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch (error) {
    console.warn("Failed to save notice dismissal status:", error);
  }
}

export function showNotice({ onClose } = {}) {
  const existing = document.querySelector(".notice-dialog");
  if (existing) {
    existing.close();
    existing.remove();
  }

  const body = document.createElement("div");
  body.className = "notice-content";
  body.innerHTML = `
    <div class="notice-meta">
      <span class="notice-badge">v2 업데이트 안내</span>
      <span class="notice-version">버전 ${NOTICE_VERSION}</span>
    </div>
    <div class="notice-body">
      <section class="notice-section">
        <div class="notice-section-header">
          <strong class="notice-title">어시스트 모드 (BETA)</strong>
        </div>
        <p class="notice-desc">
          화면 공유를 통해 실제 인게임 화면(보유 카드, 캐릭터 위치, 진행도)을 실시간으로 자동 인식하고, 최적의 카드 사용 및 주사위 행동을 추천합니다.
        </p>
      </section>

      <section class="notice-section">
        <div class="notice-section-header">
          <strong class="notice-title">Gemini AI 실시간 음성 가이드</strong>
        </div>
        <p class="notice-desc">
          추천 행동, 카드 사용 및 주사위 굴리기를 4개 국어(한국어, 영어, 일본어, 중국어) 남/여성 AI 보이스로 생생하게 안내합니다. 상단 <strong>[음성]</strong> 메뉴에서 보이스 및 볼륨을 설정할 수 있습니다.
        </p>
      </section>

      <section class="notice-section">
        <div class="notice-section-header">
          <strong class="notice-title">자유로운 모드 전환 & 도움말</strong>
        </div>
        <p class="notice-desc">
          하단 <strong>[모드변경]</strong> 버튼을 통해 <strong>수동 / 자동 / 어시스트</strong> 모드를 언제든 손쉽게 전환할 수 있습니다. 좌상단 확성기 아이콘을 누르면 언제든지 이 공지를 다시 볼 수 있습니다.
        </p>
      </section>
    </div>
    <div class="notice-footer">
      <button type="button" class="notice-dismiss-button">다시 보지 않기</button>
      <button type="button" class="notice-confirm-button primary">확인</button>
    </div>
  `;

  const node = dialog("새로운 기능 안내", body, { className: "notice-dialog" });

  let closedHandled = false;
  const handleClose = () => {
    if (closedHandled) return;
    closedHandled = true;
    if (typeof onClose === "function") onClose();
  };

  body.querySelector(".notice-dismiss-button").onclick = () => {
    dismissNotice(NOTICE_VERSION);
    node.close();
  };

  body.querySelector(".notice-confirm-button").onclick = () => {
    node.close();
  };

  node.addEventListener("close", handleClose, { once: true });

  return node;
}
