import { dialog, confirmAction, paintChoices, toast } from "./dialogs.js";
import { showSettings } from "./settings.js";
import { modelComparison } from "../../content/models.js";
import { sameModel, LOCAL_MODEL as localModel } from "../../compute/vela/model.js";
import { compatibilityMessage } from "../../content/compatibility.js";
import { showSupport } from "../components/support.js";
import { diagnostics } from "../../platform/report.js";
import { showDiagnostics } from "./diagnostics.js";

const megabytes = bytes => `${Math.round(bytes / 1e6).toLocaleString()} MB`;
const transferLabel = localModel ? "파일 읽기" : "다운로드";
const memoryText = manifest => `메모리 여유 약 ${Math.ceil(manifest.decodedBytes * 1.5 / 1e9)} GB 이상 권장 · 기기별 차이`;
const comparison = model => {
  const { meanScore, relativeTime } = modelComparison[model];
  return `<span class="model-choice-metrics"><span>평균 기록 <b>약 ${Math.round(meanScore).toLocaleString("ko-KR")}점</b></span><span>추론 시간 <b>${relativeTime}</b></span></span>`;
};
export function showModelSelection(coordinator, { initial = false, selectedModel } = {}) {
  if (document.querySelector("dialog")) return;
  coordinator.cancel();
  const body = document.createElement("div");
  const node = dialog("모델 선택", body, { className: "model-dialog" });
  let controller, epoch = 0, handedOff = false, deletingCache = false, selected = selectedModel ?? (coordinator.enabled ? coordinator.settings.model : "vela");
  const heading = node.querySelector("h2");
  const focusPrimary = () => body.querySelector(".primary:not(:disabled)")?.focus({ preventScroll: true });
  const leave = next => { handedOff = true; node.addEventListener("close", next, { once: true }); node.close(); };
  node.addEventListener("close", () => {
    epoch++; controller?.abort(); coordinator.removeEventListener("capabilities", refreshSupport);
    if (handedOff) return;
    coordinator.cancelModelPreparation();
    if (initial && !coordinator.enabled) confirmSkip();
    else if (coordinator.enabled) coordinator.recalculate();
  }, { once: true });
  const navigation = () => '<footer><button type="button" class="model-back">이전</button><span></span><button type="button" class="primary">다음</button></footer>';
  function refreshSupport() {
    const input = body.querySelector('[name=model][value=vela]');
    if (!input) return;
    const support = coordinator.velaSupport, hint = body.querySelector(".vela-availability"), detail = body.querySelector(".vela-support");
    input.disabled = support.state !== "available";
    if (support.state === "checking" || support.state === "unchecked") { hint.textContent = "사용 가능 여부 확인 중"; detail.replaceChildren(); }
    else if (!support.available) {
      hint.textContent = compatibilityMessage(support.code).title;
      showSupport(detail, support.code, { retry: () => coordinator.checkVela(true), target: "VELA 사용 가능 여부", label: "이유·해결 방법" });
      if (selected === "vela") { selected = "x36"; body.querySelector('[name=model][value=x36]').checked = true; }
    } else { hint.textContent = localModel ? "이 PC의 모델 불러오기 · 약 813 MB" : "첫 사용 시 모델 전체 다운로드 · 약 813 MB"; detail.replaceChildren(); }
    body.querySelector(".primary").disabled = deletingCache || selected === "vela" && input.disabled;
    input.closest(".model-option").classList.toggle("has-support", !!detail.firstElementChild);
    paintChoices(body);
    if (document.activeElement === node.querySelector(".dialog-close")) focusPrimary();
  }
  coordinator.addEventListener("capabilities", refreshSupport);
  async function confirmSkip() {
    const skip = await confirmAction("추천 없이 시작할까요?", "행동 추천 없이 게임을 이용합니다. 나중에 ‘모델 선택’에서 추천을 켤 수 있습니다.",
      { confirmLabel: "추천 없이 시작", cancelLabel: "모델 선택", className: "model-dialog model-skip-dialog" });
    if (skip) { await coordinator.dispose(); document.querySelector("#settings-button").focus({ preventScroll: true }); }
    else showModelSelection(coordinator, { initial, selectedModel: selected });
  }
  function select() {
    epoch++; controller?.abort(); controller = null; coordinator.cancelModelPreparation();
    heading.textContent = "모델 선택";
    body.innerHTML = `<p class="model-intro">게임의 다음 선택을 도와줄 모델을 고르세요.</p>
      <div class="model-options" role="radiogroup" aria-label="모델">
        <div class="model-option"><label class="model-choice"><input type="radio" name="model" value="vela"><span class="model-choice-copy"><strong>VELA <small>v4</small></strong><span>CPU로 바로 판단</span>${comparison("vela")}<small class="vela-availability">사용 가능 여부 확인 중</small></span><span class="model-check" aria-hidden="true"></span></label><div class="model-support vela-support"></div></div>
        <label class="model-choice"><input type="radio" name="model" value="x36"><span class="model-choice-copy"><strong>X36 <small>G3</small></strong><span>시뮬레이션으로 선택 비교</span>${comparison("x36")}<small>GPU 또는 CPU · 사용량 선택 가능</small></span><span class="model-check" aria-hidden="true"></span></label>
      </div>
      <p class="model-comparison-note">참고값 · VELA CPU / G3 GPU 높음 · 기기·상태별 차이</p>
      <div class="model-cache-tools" ${!localModel && coordinator.velaCacheAllowed ? "" : "hidden"}><span>${localModel ? "이전에 저장한 모델이 있습니다." : "이 브라우저에 모델 저장을 허용했습니다."}</span><button type="button" class="model-forget">${localModel ? "저장된 모델 삭제" : "저장 해제·삭제"}</button></div>
      <footer><a class="legacy-access" aria-label="기존 화면으로 이동"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M3 7h14"/></svg><span>기존 화면</span><span class="legacy-arrow" aria-hidden="true">→</span></a><span></span><button type="button" class="primary">다음</button><button type="button" class="model-cancel">취소</button></footer>`;
    body.querySelector(".legacy-access").href = new URL("../../../old/v1/", import.meta.url).href + location.search + location.hash;
    body.querySelector(`[value="${selected}"]`).checked = true;
    body.querySelectorAll("[name=model]").forEach(input => input.onchange = () => { selected = input.value; refreshSupport(); });
    body.querySelector(".model-cancel").onclick = () => node.close();
    body.querySelector(".model-forget").onclick = async event => {
      const button = event.currentTarget; button.disabled = true; deletingCache = true; refreshSupport();
      try {
        await coordinator.clearVelaCache();
        const tools = body.querySelector(".model-cache-tools");
        if (node.open && tools) { tools.querySelector("span").textContent = "저장된 모델을 삭제했습니다."; button.hidden = true; }
      }
      catch { if (node.open) { button.textContent = "다시 삭제"; button.disabled = false; toast("모델 파일을 삭제하지 못했습니다. 다른 Adventure 탭을 닫고 다시 시도해 주세요."); } }
      finally { deletingCache = false; if (node.open) refreshSupport(); }
    };
    body.querySelector(".primary").onclick = () => selected === "vela" ? inspectVela() : loadX36();
    if (localModel) {
      const current = epoch, tools = body.querySelector(".model-cache-tools");
      coordinator.hasVelaCache().then(exists => {
        if (node.open && current === epoch && !deletingCache) tools.hidden = !exists;
      }).catch(() => {});
    }
    coordinator.checkVela(); refreshSupport(); focusPrimary();
  }
  async function inspectVela() {
    const current = progressScreen("VELA 준비"), signal = controller.signal;
    body.querySelectorAll(".model-meter, progress").forEach(element => element.hidden = true);
    body.querySelector(".model-loading-title").textContent = "사용할 모델을 확인하고 있습니다.";
    try {
      const { latest, cached } = await coordinator.inspectVela(signal);
      if (signal.aborted || current !== epoch || !node.open) return;
      if (localModel) localPreparation(latest);
      else if (cached && !sameModel(latest, cached)) versionChoice(latest, cached);
      else if (coordinator.velaCacheAllowed) loadVela(true, latest);
      else consent(latest);
    } catch (error) {
      if (!signal.aborted && current === epoch && node.open) {
        if (!localModel && coordinator.vela?.ready) {
          const manifest = coordinator.vela.info.manifest;
          if (!coordinator.velaCacheAllowed) consent(manifest);
          else loadVela(coordinator.velaCacheAllowed, manifest);
        }
        else failure(error, inspectVela);
      }
    }
  }
  function localPreparation(manifest) {
    heading.textContent = "VELA 준비";
    body.innerHTML = `<p class="model-intro">이 PC의 모델 파일을 불러옵니다.</p>
      <div class="model-size"><strong>${megabytes(manifest.bytes)} <span>모델 파일</span></strong></div>
      <p class="model-memory">${memoryText(manifest)}</p>${navigation()}`;
    body.querySelector(".model-back").onclick = select;
    const primary = body.querySelector(".primary"); primary.textContent = "모델 불러오기";
    primary.onclick = () => loadVela(false, manifest);
    focusPrimary();
  }
  function versionChoice(latest, cached) {
    heading.textContent = latest ? "새 VELA 모델이 있습니다" : "저장된 모델을 사용할까요?";
    body.innerHTML = `<p class="model-intro">${latest ? "업데이트하거나, 저장된 버전으로 계속할 수 있습니다." : "최신 버전을 확인하지 못했습니다. 저장된 모델은 사용할 수 있습니다."}</p>
      <dl class="model-versions"><div><dt>저장된 버전</dt><dd class="model-saved-version"></dd></div>${latest ? '<div><dt>새 버전</dt><dd class="model-latest-version"></dd></div>' : ""}</dl>
      <p class="model-memory">${memoryText(latest || cached)}</p>
      ${latest ? `<p class="model-note">추가 저장 공간 약 ${megabytes(latest.bytes)} · 교체 중 추천이 잠시 중단됩니다.<br>취소하거나 실패하면 이전 모델을 다시 준비합니다.</p>` : ""}
      <footer><button class="model-back">이전</button><span></span>${latest ? '<button class="primary model-update">업데이트</button>' : ""}<button class="model-use-saved ${latest ? "" : "primary"}">저장된 버전 사용</button></footer>`;
    body.querySelector(".model-saved-version").textContent = cached.version;
    if (latest) {
      body.querySelector(".model-latest-version").textContent = latest.version;
      body.querySelector(".model-update").onclick = () => loadVela(true, latest);
    }
    body.querySelector(".model-use-saved").onclick = () => loadVela(true, cached, true);
    body.querySelector(".model-back").onclick = select; focusPrimary();
  }
  function consent(manifest, issue) {
    heading.textContent = "VELA 준비";
    const resident = coordinator.vela?.ready && sameModel(coordinator.vela.info.manifest, manifest);
    const supported = coordinator.velaSupport.storage !== false && !!navigator.storage?.getDirectory && !issue;
    body.innerHTML = `<p class="model-intro">${resident ? "모델은 준비되어 있습니다. 다음 접속을 위한 저장 여부를 선택하세요." : localModel ? "이 PC의 모델 파일을 불러와 준비합니다." : "전체 모델을 한 번 내려받아 준비합니다."}</p>
      <div class="model-size"><strong>${megabytes(manifest.bytes)} <span>${resident || localModel ? "모델 파일" : "다운로드"}</span></strong><span>${resident ? localModel ? "저장 시 파일을 다시 읽습니다" : "저장 시 다시 다운로드" : `저장 시 약 ${megabytes(manifest.bytes)}`}</span></div>
      <p class="model-memory">${memoryText(manifest)}</p>
      <p class="model-question">${localModel ? "모델을 브라우저에도 저장할까요?" : "다음에도 다운로드 없이 사용할까요?"}</p>
      <div class="cache-options" role="radiogroup" aria-label="모델 저장 동의">
        <label><input type="radio" name="cache" value="yes" ${supported ? "" : "disabled"}><span><strong>이 브라우저에 저장</strong><small>저장 공간과 사용 가능 여부를 확인합니다.</small></span></label>
        <label><input type="radio" name="cache" value="no" checked><span><strong>이번에만 사용</strong><small>${localModel ? "다음 접속 때 이 PC의 파일을 다시 읽습니다." : "다음 접속 때 다시 다운로드합니다."}</small></span></label>
      </div><div class="model-support cache-support"></div>
      <p class="model-note">${localModel ? "브라우저 저장 공간을 별도로 사용합니다." : "브라우저 데이터 정리나 저장 공간 부족 시 다시 다운로드할 수 있습니다."}</p>${navigation()}`;
    if (!supported) showSupport(body.querySelector(".cache-support"), issue || "storage-unsupported", { retry: issue ? () => consent(manifest) : null, target: "모델 저장", retryLabel: "설정 변경" });
    body.querySelector(".model-back").onclick = select;
    const primary = body.querySelector(".primary"); primary.textContent = "모델 불러오기";
    primary.onclick = async () => {
      const persist = body.querySelector("[name=cache]:checked").value === "yes";
      if (persist) {
        controller?.abort(); controller = new AbortController();
        const current = ++epoch, signal = controller.signal;
        primary.disabled = true; primary.textContent = "저장 확인 중";
        try {
          const result = await coordinator.checkVelaStorage(manifest, signal);
          if (signal.aborted || current !== epoch || !node.open) return;
          if (!result.available) { consent(manifest, result.code); return; }
        } catch (error) { if (!signal.aborted && current === epoch && node.open) consent(manifest, "storage-failed"); return; }
      }
      if (!coordinator.setVelaCacheAllowed(persist) && persist) { consent(manifest, "storage-denied"); return; }
      if (persist) navigator.storage.persist?.().catch(() => {});
      loadVela(persist, manifest);
    };
    paintChoices(body); focusPrimary();
  }
  function progressScreen(title, manifest) {
    heading.textContent = title;
    body.innerHTML = `<div class="model-loading" aria-live="polite"><p class="model-loading-title">준비하고 있습니다.</p><p class="model-loading-detail">잠시만 기다려 주세요.</p>
      <div class="model-meter"><span>${transferLabel}</span><strong class="model-transfer">준비 중</strong></div><progress class="model-download" max="1" value="0" aria-label="모델 ${transferLabel}"></progress>
      <div class="model-meter"><span>모델 준비</span><strong class="model-prepared">대기 중</strong></div><progress class="model-prepare" max="1" value="0" aria-label="모델 준비"></progress>
      </div>${manifest ? `<p class="model-memory">${memoryText(manifest)}</p>` : ""}<footer><button class="model-back">이전</button><span></span><button class="model-cancel">취소</button></footer>`;
    body.querySelector(".model-back").onclick = select; body.querySelector(".model-cancel").onclick = () => node.close();
    controller?.abort(); controller = new AbortController(); return ++epoch;
  }
  async function loadVela(persist, manifest, cachedOnly = false) {
    const current = progressScreen("VELA 준비", manifest), signal = controller.signal;
    let downloaded = false;
    try {
      const info = await coordinator.prepareVela({ persist, manifest, cachedOnly, signal, onProgress: data => {
        if (current !== epoch || !node.open) return;
        const cached = data.phase === "cache";
        body.querySelector(".model-loading-title").textContent = cached ? "모델을 메모리에 준비하는 중" : data.phase === "download" ? localModel ? "VELA를 불러오는 중" : "VELA를 내려받는 중" : data.phase === "retry" ? localModel ? "모델 파일을 다시 읽는 중" : "모델을 다시 내려받는 중" : "VELA를 준비하는 중";
        body.querySelector(".model-loading-detail").textContent = data.phase === "retry" ? localModel ? "브라우저 저장본 대신 이 PC의 모델 파일을 읽습니다." : "저장된 파일을 확인하지 못해 새로 받습니다." : "준비가 끝나면 바로 사용할 수 있습니다.";
        if (data.phase === "download" || (!downloaded && cached)) {
          body.querySelector(".model-meter span").textContent = cached ? "저장된 파일" : transferLabel;
          body.querySelector(".model-download").setAttribute("aria-label", cached ? "저장된 모델 읽기" : `모델 ${transferLabel}`);
          body.querySelector(".model-transfer").textContent = data.total ? `${megabytes(data.received)} / ${megabytes(data.total)}` : "준비 중";
          body.querySelector(".model-download").value = data.fraction || 0;
          if (data.phase === "download") downloaded = true;
        }
        body.querySelector(".model-prepare").value = data.prepared || 0;
        body.querySelector(".model-prepared").textContent = data.prepared ? `${Math.round(data.prepared * 100)}%` : "대기 중";
      }});
      if (signal.aborted || current !== epoch || !node.open) return;
      heading.textContent = `${info.manifest.name} 준비 완료`;
      body.innerHTML = `<div class="model-ready"><span class="model-ready-mark" aria-hidden="true">✓</span><strong>이제 다음 선택을 비교할 수 있습니다.</strong><p>${info.cacheSaved ? "이 브라우저에 저장된 모델을 다음에도 사용합니다." : "이번 접속 동안 모델을 사용할 수 있습니다."}</p></div>${info.cacheFailed ? `<p class="model-cache-warning">모델을 저장하지 못했습니다. ${localModel ? "다음 접속 때 이 PC의 파일을 다시 읽습니다." : "다음 접속 때 다시 다운로드할 수 있습니다."}</p><div class="model-support cache-support"></div>` : ""}<footer><button class="model-back">이전</button><span></span><button class="primary">${initial ? "시작" : "적용"}</button></footer>`;
      if (info.cacheFailed) { showSupport(body.querySelector(".cache-support"), info.cacheIssue || "storage-failed", { target: "모델 저장" }); toast("모델을 저장하지 못했습니다. 이번에는 사용할 수 있습니다."); }
      body.querySelector(".model-back").onclick = select;
      body.querySelector(".primary").onclick = () => leave(() => coordinator.configure({ model: "vela" }));
      focusPrimary();
    } catch (error) { if (!signal.aborted && current === epoch && node.open) failure(error, inspectVela); }
  }
  async function loadX36() {
    const current = progressScreen("X36 준비"), signal = controller.signal;
    body.querySelectorAll(".model-meter,.model-download").forEach(el => el.hidden = true);
    body.querySelector(".model-prepare").removeAttribute("value");
    body.querySelector(".model-loading-detail").textContent = "계산 엔진을 준비하고 있습니다.";
    try {
      await coordinator.prepare({ signal }); coordinator.checkGpu();
      if (signal.aborted || current !== epoch || !node.open) return;
      leave(() => showSettings(coordinator, { initial, onBack: () => showModelSelection(coordinator, { initial, selectedModel: selected }), onCancel: initial && !coordinator.enabled ? confirmSkip : undefined }));
    } catch (error) { if (!signal.aborted && current === epoch && node.open) failure(error, loadX36); }
  }
  function failure(error, retry) {
    diagnostics.capture(error, "model.prepare");
    console.error("Model preparation failed", error);
    heading.textContent = "모델을 준비하지 못했습니다";
    body.innerHTML = '<p class="model-intro">다시 시도하거나 다른 모델을 선택할 수 있습니다.</p><div class="model-support failure-support"></div><footer><button class="model-back">모델 선택</button><button class="diagnostics-button">진단 정보</button><span></span><button class="primary">다시 시도</button></footer>';
    body.querySelector(".diagnostics-button").onclick = showDiagnostics;
    showSupport(body.querySelector(".failure-support"), error.code || "network", { target: "모델 준비" });
    body.querySelector(".model-back").onclick = select; body.querySelector(".primary").onclick = retry; focusPrimary();
  }
  select(); return node;
}
