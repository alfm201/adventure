import { dialog, toast } from "./dialogs.js";
import { showVoiceSettings } from "./voice.js";

const icons = {
  assist: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 9h3m4 4h3"/>',
  manual: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  automatic: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const names = { assist: "어시스트", manual: "수동", automatic: "자동" };
const connectionLabels = {
  idle: "화면을 연결해 주세요", requesting: "화면 선택 중", connected: "화면 연결됨",
  paused: "화면 일시 중지", disconnected: "연결 끊김",
};
const issues = {
  insecure: "화면 공유는 HTTPS 주소나 로컬 서버에서 사용할 수 있습니다.",
  unsupported: "이 브라우저에서는 화면 공유를 사용할 수 없습니다. PC의 화면 공유 지원 브라우저에서 열어 주세요.",
  cancelled: "화면을 연결하지 않았습니다. 다시 선택하거나 브라우저의 공유 권한을 확인해 주세요.",
  missing: "공유할 화면이 없습니다. 게임 창을 연 뒤 다시 연결해 주세요.",
  capture: "화면을 가져오지 못했습니다. 게임 창과 브라우저의 화면 공유 권한을 확인해 주세요.",
  "recognition-support": "이 브라우저에서는 화면 인식을 사용할 수 없습니다. 최신 PC 브라우저에서 열어 주세요.",
  preview: "미리보기를 재생하지 못했습니다. 화면을 다시 연결해 주세요.",
};

export function showModes(session, assist, { screen = false, voice = null } = {}) {
  if (document.querySelector("dialog")) return;
  const body = document.createElement("div");
  const node = dialog("모드 선택", body, { className: "mode-dialog" });
  let pane, video, previewIssue = false;
  const heading = node.querySelector("h2");
  const close = node.close.bind(node);
  node.close = () => { assist.cancelPending(); close(); };
  node.addEventListener("cancel", event => { event.preventDefault(); node.close(); });

  function releasePreview() {
    if (!video) return;
    video.pause();
    video.srcObject = null;
    video = null;
    previewIssue = false;
  }

  function choose(mode) {
    if (mode === "assist") { showScreen(); return; }
    session.execute("mode", mode);
    node.close();
    toast(`${names[mode]} 모드로 전환했습니다.`);
  }

  function showChoices() {
    assist.cancelPending();
    releasePreview();
    pane = "choices";
    heading.textContent = "모드 선택";
    body.innerHTML = `
      <p class="mode-intro">어떤 방식으로 플레이할까요?</p>
      <div class="mode-options">
        ${[
          ["assist", "게임 화면을 읽어 상태와 추천을 자동 반영", "실제 게임은 직접 조작합니다."],
          ["manual", "실제 게임의 결과를 직접 입력", ""],
          ["automatic", "실제 게임 규칙으로 직접 플레이", "실제 게임을 대신 조작하지 않습니다."],
        ].map(([mode, description, note]) => `
          <button type="button" class="mode-choice" data-mode="${mode}" ${session.mode === mode ? 'aria-current="true"' : ""}>
            <span class="mode-icon">${icon(mode)}</span>
            <span class="mode-copy"><strong>${names[mode]}${mode === "assist" ? '<span class="mode-beta">BETA</span>' : ""}${session.mode === mode ? '<span class="mode-current">사용 중</span>' : ""}</strong>
            <span>${description}</span>${note ? `<small>${note}</small>` : ""}</span>
            <span class="mode-arrow" aria-hidden="true">›</span>
          </button>`).join("")}
      </div>
      <p class="mode-preserve">모드를 바꿔도 현재 위치·주사위·카드는 유지됩니다.</p>`;
    body.querySelectorAll("[data-mode]").forEach(button => {
      button.onclick = () => choose(button.dataset.mode);
    });
    (body.querySelector('[aria-current="true"]') || body.querySelector("button")).focus({ preventScroll: true });
  }

  function showScreen() {
    releasePreview();
    pane = "screen";
    heading.innerHTML = `어시스트 <span class="mode-beta">BETA</span>`;
    body.innerHTML = `
      <button type="button" class="mode-back">‹ 모드 선택</button>
      <div class="assist-heading"><strong role="status" class="assist-connection"></strong><span>화면 미리보기</span></div>
      <div class="assist-preview">
        <video autoplay muted playsinline disablepictureinpicture aria-label="공유 중인 게임 화면" hidden></video>
        <div class="assist-placeholder">${icon("assist")}<strong></strong><span>게임 창 하나를 선택해 주세요.</span></div>
        <span class="assist-paused" hidden>화면이 일시 중지되었습니다.</span>
      </div>
      <p class="assist-availability">점수·주사위·손패를 읽어 추천에 반영합니다. 확인이 필요하면 화면 위쪽에서 알려드립니다.</p>
      <p class="assist-issue" role="status" hidden></p>
      <details class="assist-guide">
        <summary>화면 연결 안내</summary>
        <ol>
          <li><strong>게임 창 선택</strong><span>‘화면 연결’을 누르고 게임이 열린 창이나 탭을 선택하세요. 게임 창을 원래 크기로 표시하고 최소화하지 마세요. 소리는 공유하지 않습니다.</span></li>
          <li><strong>화면 확인</strong><span>현재 칸·주사위 사용 횟수·보유 카드가 가려지지 않게 해 주세요. 중간부터 시작하면 실제 게임의 카드 획득 이력을 열고 위부터 아래까지 천천히 스크롤하세요.</span></li>
          <li><strong>연결 관리</strong><span>작은 미리보기는 끌어서 옮기거나 접을 수 있습니다. 이 창을 닫아도 공유는 유지됩니다. ‘연결 해제’나 다른 모드로 전환하면 공유가 끝나며, 기존 게임 상태는 유지됩니다.</span></li>
        </ol>
      </details>
      <p class="assist-privacy">선택한 화면은 이 브라우저에서만 확인하며, 녹화·전송하지 않습니다.</p>
      <footer><button type="button" class="primary" data-connect>화면 연결</button><button type="button" data-rescan hidden>덱 다시 확인</button><button type="button" data-disconnect hidden>연결 해제</button><button type="button" data-manual>수동 모드로</button></footer>`;
    video = body.querySelector("video");
    body.querySelector(".mode-back").onclick = showChoices;
    body.querySelector("[data-connect]").onclick = async () => {
      if (await assist.connect()) {
        if (voice && !voice.enabled) node.addEventListener("close", () => showVoiceSettings(voice), { once: true });
        node.close();
      }
    };
    body.querySelector("[data-rescan]").onclick = () => { assist.rescan(); node.close(); };
    body.querySelector("[data-disconnect]").onclick = () => assist.disconnect();
    body.querySelector("[data-manual]").onclick = () => choose("manual");
    updateScreen();
    (body.querySelector("[data-connect]:not(:disabled)") || body.querySelector("[data-manual]")).focus({ preventScroll: true });
  }

  function updateScreen() {
    if (pane !== "screen" || !node.open) return;
    const { status, stream, support } = assist;
    const requesting = status === "requesting";
    const changedSource = video.srcObject !== stream;
    if (changedSource) previewIssue = false;
    body.querySelector(".assist-connection").textContent = support.available ? connectionLabels[status] : "화면 공유 미지원";
    body.querySelector(".assist-heading").dataset.status = status;
    body.querySelector(".assist-preview").hidden = !support.available;
    const connect = body.querySelector("[data-connect]");
    connect.disabled = requesting || !support.available;
    connect.textContent = requesting ? "화면 선택 중…" : stream ? "화면 바꾸기" : session.mode === "assist" ? "다시 연결" : "화면 연결";
    body.querySelector("[data-disconnect]").hidden = !stream;
    body.querySelector("[data-rescan]").hidden = !stream;
    const placeholder = body.querySelector(".assist-placeholder");
    placeholder.hidden = !!stream && !previewIssue;
    placeholder.querySelector("strong").textContent = previewIssue ? "미리보기를 표시할 수 없습니다" : requesting ? "공유할 화면을 선택해 주세요" : status === "disconnected" ? "화면 연결이 끊겼습니다" : !support.available ? "화면 공유를 사용할 수 없습니다" : "함께 볼 화면을 연결하세요";
    placeholder.querySelector("span").hidden = requesting || !support.available || previewIssue;
    body.querySelector(".assist-paused").hidden = status !== "paused";
    const issue = !support.available ? support.issue : assist.issue || (previewIssue ? "preview" : null);
    const message = body.querySelector(".assist-issue");
    message.hidden = !issue;
    message.textContent = issues[issue] || "";
    video.hidden = !stream || previewIssue;
    if (changedSource) {
      const target = video;
      target.srcObject = stream;
      if (stream) target.play().catch(() => {
        if (video !== target || target.srcObject !== stream || !node.open) return;
        previewIssue = true;
        updateScreen();
      });
    }
  }

  assist.addEventListener("change", updateScreen);
  node.addEventListener("close", () => {
    assist.removeEventListener("change", updateScreen);
    releasePreview();
  }, { once: true });
  if (screen) showScreen(); else showChoices();
  return node;
}
