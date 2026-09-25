import { dialog, toast } from "./dialogs.js";
import { showModes } from "./modes.js";
import { cardLabels } from "../../content/cards.js";
import { cards } from "../../rules/index.js";
import { cardClass } from "../../application/assist-tracker.js";
import { showVoiceSettings } from "./voice.js";

const fields = { score: "현재 칸", dice: "주사위 사용 횟수", hand: "보유 카드", bonus: "주사위 버튼" };
function guidance(assist, duration) {
  const r = assist.reading;
  if (!assist.stream) return ["화면 연결이 끊겼습니다", "다시 연결하면 현재 상태부터 확인합니다."];
  if (assist.status === "paused" || r.issue === "stale") return ["게임 화면이 멈춰 있습니다", "공유 중인 창을 다시 표시해 주세요."];
  if (r.ready) return ["플레이를 이어가세요", r.deckOpen ? "카드 이력을 확인했습니다. 이력 창을 닫아도 됩니다." : "화면의 변화를 읽어 상태와 추천에 반영합니다."];
  if (r.issue === "reader") return ["화면 인식을 시작하지 못했습니다", "연결 관리에서 화면을 다시 연결해 주세요."];
  if (r.issue === "window") return ["게임 창 전체를 보여주세요", "현재 칸과 화면 아래의 주사위 사용 횟수·카드가 보여야 합니다."];
  if (r.issue === "small") return ["게임 창을 조금 더 크게 보여주세요", "작은 글자를 읽기 어렵습니다. 게임 창을 원래 크기로 표시해 주세요."];
  if (r.issue === "covered") return ["게임 화면을 확인하고 있습니다", duration > 6000 ? "팝업이 열려 있다면 닫은 뒤 계속해 주세요." : "동작이 끝나면 자동으로 이어집니다."];
  if (r.issue === "deck-open" || r.issue === "deck-reopen") return [r.issue === "deck-reopen" ? "카드 획득 이력을 다시 열어주세요" : "카드 획득 이력을 열어주세요",
    r.verification === "reset" ? "덱이 초기화되었는지 한 번 확인하겠습니다." : r.verification === "gap" ? "놓친 변화가 있어 남은 카드를 다시 확인하겠습니다." : "실제 게임의 ? 버튼을 누른 뒤 목록을 천천히 스크롤해 주세요."];
  if (r.issue === "deck-up" || r.issue === "deck-down") return [`카드 이력을 ${r.issue === "deck-up" ? "위" : "아래"}로 스크롤해 주세요`, "일부 카드가 아직 보이지 않습니다. 스크롤 후 잠시 멈춰 주세요."];
  if (r.issue === "deck-scan") return ["카드 이력을 천천히 스크롤해 주세요", "목록의 위치를 확인하고 있습니다. 조금 움직인 뒤 잠시 멈춰 주세요."];
  if (r.issue === "deck-adjust" || r.issue === "deck-hold" && duration > 1800) return ["카드 이력을 조금 위아래로 움직여 주세요", "아직 읽지 못한 항목이 있습니다. 체크 표시가 보이면 잠시 멈춰 주세요."];
  if (r.issue === "deck-hold") return ["스크롤을 잠시 멈춰 주세요", "현재 보이는 카드 이력을 확인하고 있습니다."];
  if (fields[r.issue] && duration > 2500) return [`${fields[r.issue]} 확인이 필요합니다`, "가리는 창이나 커서를 옮겨주세요. 계속 어려우면 직접 입력할 수 있습니다."];
  return ["화면을 확인하고 있습니다", "행동이 끝나면 상태와 추천이 갱신됩니다."];
}

function showCorrection(assist) {
  if (document.querySelector("dialog")) return;
  const original = assist.tracker.lastObservation;
  if (!original?.visible) return;
  const stream = assist.stream, state = assist.session.state, body = document.createElement("form");
  body.className = "assist-correction";
  body.innerHTML = `<p>실제 게임에 보이는 값으로 맞춰주세요.</p>
    <div class="assist-fields"><label>현재 칸<input name="position" type="number" min="1" max="2898" required></label>
    <label>주사위 사용 횟수<input name="diceUsed" type="number" min="0" max="100" required></label></div>
    <label class="assist-double"><input type="checkbox" name="bonusRoll"> 더블 상태 <small>주사위 버튼이 파란색</small></label>
    <fieldset><legend>보유 카드 <small>왼쪽부터 순서대로</small></legend><div class="assist-hand-inputs"></div></fieldset>
    <p class="assist-form-error" role="alert" hidden></p><footer><button class="primary" type="submit">적용</button><button type="button" data-cancel>취소</button></footer>`;
  const values = { ...state, ...original };
  for (const name of ["position", "diceUsed"]) body.elements[name].value = values[name] ?? "";
  body.elements.bonusRoll.checked = values.bonusRoll ?? state.bonusRoll;
  for (let slot = 0; slot < 5; slot++) {
    const label = document.createElement("label"), select = document.createElement("select");
    label.textContent = `${slot + 1}번`; select.name = "slot" + slot;
    select.add(new Option("없음", "0"));
    for (const card of cards.slice(1)) if (cardClass(card.id) === card.id) select.add(new Option(cardLabels[card.id - 1], String(card.id)));
    select.value = String(original.hand?.[slot] ?? 0);
    label.append(select); body.querySelector(".assist-hand-inputs").append(label);
  }
  const node = dialog("읽은 값 수정", body, { className: "mode-dialog" });
  body.querySelector("[data-cancel]").onclick = () => node.close();
  body.onsubmit = event => {
    event.preventDefault();
    const error = body.querySelector(".assist-form-error");
    const slots = Array.from({ length: 5 }, (_, i) => Number(body.elements["slot" + i].value));
    const gap = slots.indexOf(0);
    if (gap !== -1 && slots.slice(gap).some(Boolean)) { error.hidden = false; error.textContent = "보유 카드는 빈칸 없이 왼쪽부터 선택해 주세요."; return; }
    if (assist.stream !== stream || !assist.tracker.lastObservation?.visible) {
      error.hidden = false; error.textContent = "현재 게임 화면을 다시 보여준 뒤 적용해 주세요."; return;
    }
    const current = assist.tracker.lastObservation;
    const changed = ["position", "diceUsed", "bonusRoll", "hand"].some(key => JSON.stringify(current[key]) !== JSON.stringify(original[key]));
    if (changed) { error.hidden = false; error.textContent = "입력 중 화면이 바뀌었습니다. 닫은 뒤 최신 값으로 다시 확인해 주세요."; return; }
    const correction = { position: Number(body.elements.position.value), diceUsed: Number(body.elements.diceUsed.value), bonusRoll: body.elements.bonusRoll.checked, hand: slots.filter(Boolean) };
    if (!Number.isInteger(correction.position) || !Number.isInteger(correction.diceUsed)) return;
    if (assist.correct(correction)) { node.close(); toast("입력한 값으로 상태를 확인합니다."); }
  };
  body.elements[assist.reading.issue === "dice" ? "diceUsed" : "position"].focus({ preventScroll: true });
  body.elements[assist.reading.issue === "dice" ? "diceUsed" : "position"].select();
}

function monitor(assist, bar, watch) {
  const node = document.createElement("aside");
  node.id = "assist-monitor";
  node.className = "assist-monitor"; node.hidden = true;
  node.setAttribute("aria-label", "공유 화면 미리보기");
  node.innerHTML = `<header><span aria-hidden="true" class="assist-grip">⠿</span><strong>공유 화면</strong><button type="button" data-fold aria-label="미리보기 접기">−</button><button type="button" data-hide aria-label="미리보기 숨기기">×</button></header><div class="assist-monitor-screen"><video autoplay muted playsinline disablepictureinpicture></video><span hidden>미리보기를 표시할 수 없습니다</span></div>`;
  document.body.append(node);
  const video = node.querySelector("video"), screen = node.querySelector(".assist-monitor-screen"), header = node.querySelector("header");
  let hidden = false, collapsed = false, moved = false, position, drag, lastStream;
  function place() {
    if (node.hidden) return;
    const top = 8;
    const size = node.getBoundingClientRect();
    const maxX = Math.max(8, innerWidth - size.width - 12), maxY = Math.max(top, innerHeight - size.height - 12);
    if (!moved) position = { x: maxX, y: bar.getBoundingClientRect().bottom + 8 };
    position.x = Math.max(8, Math.min(maxX, position.x));
    position.y = Math.max(top, Math.min(maxY, position.y));
    node.style.transform = `translate(${position.x}px, ${position.y}px)`;
  }
  const update = () => {
    const stream = assist.stream;
    if (stream !== lastStream) {
      lastStream = stream; hidden = false;
      video.srcObject = stream;
      node.querySelector(".assist-monitor-screen > span").hidden = true;
      if (stream) video.play().catch(() => { if (video.srcObject === stream) node.querySelector(".assist-monitor-screen > span").hidden = false; });
      else video.pause();
    }
    node.hidden = hidden || !stream || assist.session.mode !== "assist";
    watch.hidden = !stream;
    watch.disabled = !stream;
    watch.setAttribute("aria-pressed", String(!node.hidden));
    watch.title = node.hidden ? "공유 화면 미리보기 열기" : "공유 화면 미리보기 숨기기";
    screen.hidden = collapsed;
    const region = assist.region, size = assist.sourceSize;
    video.style.cssText = region && size ? `width:${size.width / region.width * 100}%;height:${size.height / region.height * 100}%;left:${-region.x / region.width * 100}%;top:${-region.y / region.height * 100}%` : "";
    place();
  };
  node.querySelector("[data-hide]").onclick = () => { hidden = true; update(); };
  node.querySelector("[data-fold]").onclick = event => {
    collapsed = !collapsed;
    event.currentTarget.textContent = collapsed ? "+" : "−";
    event.currentTarget.setAttribute("aria-label", collapsed ? "미리보기 펼치기" : "미리보기 접기");
    update();
  };
  header.onpointerdown = event => {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault(); header.setPointerCapture(event.pointerId);
    drag = { x: event.clientX - position.x, y: event.clientY - position.y };
    node.classList.add("is-dragging");
  };
  header.onpointermove = event => {
    if (!drag) return;
    moved = true;
    position = { x: event.clientX - drag.x, y: event.clientY - drag.y }; place();
  };
  const stopDrag = () => { drag = null; node.classList.remove("is-dragging"); };
  header.onpointerup = header.onpointercancel = header.onlostpointercapture = stopDrag;
  addEventListener("resize", place);
  return { toggle() { hidden = !node.hidden; update(); }, update };
}

export function bindAssistBar(session, assist, prediction, voice) {
  const bar = document.createElement("aside");
  bar.id = "assist-bar"; bar.className = "assist-bar"; bar.hidden = true;
  bar.setAttribute("aria-label", "어시스트 상태와 안내");
  bar.innerHTML = `<div class="assist-bar-copy"><div class="assist-status-line"><span class="assist-badge">어시스트<span class="assist-beta">BETA</span></span><span class="assist-status"></span><span class="assist-count" hidden></span></div>
    <strong class="assist-request" role="status" aria-live="polite"></strong><small class="assist-request-detail"></small><progress max="30" value="0" aria-label="확인한 카드 이력" hidden></progress></div>
    <div class="assist-bar-actions"><button type="button" class="assist-correct" hidden>직접 입력</button><button type="button" class="assist-watch" aria-controls="assist-monitor" aria-pressed="false">화면</button><button type="button" class="assist-voice" aria-label="음성 안내 설정">음성</button><button type="button" class="assist-open">연결 관리</button></div>`;
  document.body.append(bar);
  const watch = bar.querySelector(".assist-watch"), preview = monitor(assist, bar, watch);
  let lastIssue, issueSince = 0;
  bar.querySelector(".assist-open").onclick = () => { prediction.hide(); showModes(session, assist, { screen: true, voice }); };
  watch.onclick = () => preview.toggle();
  const voiceButton = bar.querySelector(".assist-voice");
  voiceButton.hidden = !voice;
  voiceButton.onclick = () => { prediction.hide(); showVoiceSettings(voice); };
  const updateVoice = () => {
    voiceButton.dataset.enabled = String(voice.enabled && !voice.playbackBlocked);
    voiceButton.textContent = voice.playbackBlocked ? "음성 확인" : voice.enabled ? "음성 켜짐" : "음성";
    voiceButton.title = voice.playbackBlocked ? "음성 설정에서 재생을 확인해 주세요" : voice.enabled ? "음성 안내 설정 · 켜짐" : "음성 안내 설정";
  };
  voice?.addEventListener("change", updateVoice);
  if (voice) updateVoice();
  bar.querySelector(".assist-correct").onclick = () => { prediction.hide(); showCorrection(assist); };
  const update = () => {
    bar.hidden = session.mode !== "assist";
    document.body.classList.toggle("is-assisting", !bar.hidden);
    const r = assist.reading;
    if (r.issue !== lastIssue) { lastIssue = r.issue; issueSince = performance.now(); }
    bar.dataset.status = r.ready ? "ready" : assist.stream ? "checking" : "disconnected";
    bar.querySelector(".assist-status").textContent = assist.stream ? r.ready ? "공유 중 · 연동됨" : "공유 중 · 확인 중" : "공유 중지";
    const [title, detail] = guidance(assist, performance.now() - issueSince);
    const request = bar.querySelector(".assist-request");
    if (request.textContent !== title) request.textContent = title;
    bar.querySelector(".assist-request-detail").textContent = detail;
    const scanning = !!assist.stream && r.issue?.startsWith("deck-");
    const count = bar.querySelector(".assist-count");
    count.hidden = !scanning; count.textContent = `${r.seen || 0} / 30 확인`;
    const progress = bar.querySelector("progress");
    progress.hidden = !scanning; progress.value = r.seen || 0;
    const correct = bar.querySelector(".assist-correct");
    correct.hidden = !assist.stream || !r.canCorrect || (!r.ready && !(fields[r.issue] && performance.now() - issueSince > 2500));
    correct.textContent = r.ready ? "값 수정" : "직접 입력";
    preview.update();
  };
  session.addEventListener("change", update); assist.addEventListener("change", update);
  update();
}
