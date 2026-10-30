import { VELA_SEARCH, velaSearch } from "../../policies/vela/search.js";
import { bindMetricHints } from "../components/metric-hint.js";
import { dialog, confirmAction, paintChoices, toast, canOpenDialog, stepDialog } from "./dialogs.js";
import { showSettings } from "./settings.js";
import { modelComparison } from "../../content/models.js";
import { sameModel, LOCAL_MODEL as localModel } from "../../compute/vela/model.js";
import { compatibilityMessage } from "../../content/compatibility.js";
import { showSupport } from "../components/support.js";
import { diagnostics } from "../../platform/report.js";
import { showDiagnostics } from "./diagnostics.js";
import { downloadProgress } from "./download-progress.js";

import { megabytes, memoryText, preparationConsent, preparationProgress, preparationReady, preparationStage } from "./model-preparation.js";
import { pageLanguage, setLocalizedAttribute } from '../../localization/index.js';
const transferLabel = localModel ? "파일 읽기" : "다운로드";
const comparison = model => {
  const { meanScore, relativeTime } = modelComparison[model];
  return `<span class="model-choice-metrics"><span>평균 기록 <b>약 ${(model === "vela" ? meanScore : Math.round(meanScore)).toLocaleString("ko-KR")}점</b></span><span>추론 시간 <b>${relativeTime}</b></span></span>`;
};
export function showModelSelection(coordinator, { initial = false, selectedModel, onFinish, parent = null } = {}) {
  if (!canOpenDialog(parent)) return;
  const resume = coordinator.suspend();
  const body = document.createElement("div");
  let busy = false;
  const node = dialog("모델 선택", body, { className: "model-dialog", parent, closeOnOutside: () => !busy });
  let controller, epoch = 0, handedOff = false, selected = selectedModel ?? (coordinator.enabled ? coordinator.settings.model : "vela");
  const refreshStrengthLabels = () => body.querySelectorAll("[data-search-label]").forEach(label => {
    const option = velaSearch(label.dataset.searchLabel); label.textContent = option.labels[pageLanguage()] ?? option.label;
  });
  addEventListener("adventurelanguagechange", refreshStrengthLabels);
  node.addEventListener("close", () => removeEventListener("adventurelanguagechange", refreshStrengthLabels), { once: true });
  let ready = false, strength = coordinator.settings.velaStrength ?? "normal", strengthHints;
  node.addEventListener('closing', () => { epoch++; controller?.abort(); });
  const heading = node.querySelector("h2");
  const settingsEntry = document.createElement('button');
  settingsEntry.type = 'button'; settingsEntry.className = 'model-settings-entry';
  settingsEntry.setAttribute('aria-label', '설정'); settingsEntry.title = '설정';
  settingsEntry.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg><span>설정</span>';
  settingsEntry.onclick = () => document.dispatchEvent(new CustomEvent('adventureopensettings', {detail:{parent:node}}));
  node.querySelector('.dialog-header').insertBefore(settingsEntry, node.querySelector('.dialog-close'));
  const focusPrimary = () => body.querySelector(".primary:not(:disabled)")?.focus({ preventScroll: true });
  // Screen changes inside this dialog use the shared dialog switch motion (LYRA moves between separate dialogs).
  // Leaving a screen ends its ready state at once, so closing during the motion never applies the abandoned model.
  const step = next => () => { ready = false; stepDialog(node, next); };
  const leave = next => { handedOff = true; node.addEventListener("close", next, { once: true }); node.close(); };
  node.addEventListener("close", () => {
    resume();
    epoch++; controller?.abort(); coordinator.removeEventListener("capabilities", refreshSupport);
    if (handedOff) return;
    if (ready) { coordinator.configure({ model: 'vela', velaStrength: strength }); onFinish?.(); return; }
    coordinator.cancelModelPreparation();
    if (initial && !coordinator.enabled) confirmSkip();
    else {
      if (coordinator.enabled) coordinator.recalculate();
      onFinish?.();
    }
  }, { once: true });
  function refreshSupport() {
    const input = body.querySelector('[name=model][value=vela]');
    if (!input) return;
    const support = coordinator.velaSupport, hint = body.querySelector(".vela-availability"), detail = body.querySelector(".vela-support");
    input.disabled = support.state !== "available";
    if (support.state === "checking" || support.state === "unchecked") { hint.textContent = "사용 가능 여부 확인 중"; detail.replaceChildren(); }
    else if (!support.available) {
      hint.textContent = compatibilityMessage(support.code).title;
      showSupport(detail, support.code, { retry: () => coordinator.checkVela(true), target: "VELA 사용 가능 여부", label: "이유·해결 방법" });
      if (selected === "vela") { selected = "lyra"; body.querySelector('[name=model][value=lyra]').checked = true; }
    } else { hint.textContent = "CPU 전용 · 탐색 강도 선택 가능"; detail.replaceChildren(); }
    body.querySelector(".primary").disabled = selected === "vela" && input.disabled;
    input.closest(".model-option").classList.toggle("has-support", !!detail.firstElementChild);
    paintChoices(body);
    if (document.activeElement === node.querySelector(".dialog-close")) focusPrimary();
  }
  coordinator.addEventListener("capabilities", refreshSupport);
  async function confirmSkip() {
    const skip = await confirmAction("추천 없이 시작할까요?", "행동 추천 없이 게임을 이용합니다. 나중에 ‘모델 선택’에서 추천을 켤 수 있습니다.",
      { confirmLabel: "추천 없이 시작", cancelLabel: "모델 선택", className: "model-dialog model-skip-dialog" });
    if (skip) {
      await coordinator.dispose();
      document.querySelector("#settings-button").focus({ preventScroll: true });
      onFinish?.({ skipped: true });
    }
    else showModelSelection(coordinator, { initial, selectedModel: selected, onFinish, parent });
  }
  function select() {
    strengthHints?.dispose(); strengthHints = null;
    busy = false;
    ready = false;
    settingsEntry.hidden = false;
    epoch++; controller?.abort(); controller = null; coordinator.cancelModelPreparation();
    heading.textContent = "모델 선택";
    body.innerHTML = `<p class="model-intro">게임의 다음 선택을 도와줄 모델을 고르세요.</p>
      <div class="model-options" role="radiogroup" aria-label="모델">
        <div class="model-option lyra-option"><label class="model-choice"><input type="radio" name="model" value="lyra"><span class="model-choice-copy"><strong class="model-choice-heading"><span class="model-name">LYRA <small>v2</small></span><span class="model-research-badge">연구용</span></strong><span>신경망 가치 추정으로 행동 비교</span><span class="model-choice-metrics"><span>연구 평가 <b>약 ${Math.round(modelComparison.lyra.meanScore).toLocaleString('ko-KR')}점</b></span><span>추론 시간 <b>${modelComparison.lyra.relativeTime}</b></span></span><small>GPU 또는 CPU · 사용량 선택 가능</small></span><span class="model-check" aria-hidden="true"></span></label>

        </div>
        <div class="model-option"><label class="model-choice"><input type="radio" name="model" value="vela"><span class="model-choice-copy"><strong>VELA <small>v4.3</small></strong><span>가치 모델과 탐색으로 행동 비교</span>${comparison("vela")}<small class="vela-availability">사용 가능 여부 확인 중</small></span><span class="model-check" aria-hidden="true"></span></label><div class="model-support vela-support"></div></div>
        <label class="model-choice"><input type="radio" name="model" value="x36"><span class="model-choice-copy"><strong>X36 <small>G3</small></strong><span>반복 시뮬레이션으로 행동 비교</span>${comparison("x36")}<small>GPU 또는 CPU · 사용량 선택 가능</small></span><span class="model-check" aria-hidden="true"></span></label>
      </div>
      <p class="model-comparison-note">참고값 · 모델별 평가 표본이 다름 · 기기·상태별 차이</p>
      <p class="model-note">저장된 모델은 설정의 저장 공간에서 삭제할 수 있습니다.</p>
      <footer><a class="legacy-access" aria-label="기존 화면으로 이동"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M3 7h14"/></svg><span>기존 화면</span><span class="legacy-arrow" aria-hidden="true">→</span></a><span></span><button type="button" class="primary">다음</button><button type="button" class="model-cancel">취소</button></footer>`;
    body.querySelector(".legacy-access").href = new URL("../../../old/v1/", import.meta.url).href + location.search + location.hash;
    body.querySelector(`[value="${selected}"]`).checked = true;
    body.querySelectorAll("[name=model]").forEach(input => input.onchange = () => { selected = input.value; refreshSupport(); });
    body.querySelector(".model-cancel").onclick = () => node.close();
    body.querySelector(".primary").onclick = () => selected === "lyra" ? selectLyra() : selected === "vela" ? step(selectStrength)() : loadX36();
    coordinator.checkVela(); coordinator.checkLyraGpu(); refreshSupport(); focusPrimary();
  }
  function selectLyra() {
    leave(() => showSettings(coordinator, { model: 'lyra', initial, parent,
      onBack: () => showModelSelection(coordinator, { initial, selectedModel: selected, onFinish, parent }),
      onCancel: initial && !coordinator.enabled ? confirmSkip : undefined, onFinish }));
  }
  function selectStrength() {
    busy = false; ready = false; settingsEntry.hidden = true;
    strengthHints?.dispose(); strengthHints = null;
    heading.textContent = "VELA 탐색 강도";
    // Rows like the model choices: name, default badge and decision time on the left, score in an aligned column on the right.
    body.innerHTML = `<p class="model-intro">강도가 높을수록 접전에서 더 깊이 계산합니다.</p>
      <div class="vela-strength-options" role="radiogroup" aria-label="탐색 강도">${VELA_SEARCH.map(option => `<label class="model-choice vela-strength-choice"><input type="radio" name="strength" value="${option.key}"><span class="model-choice-copy"><strong><span data-search-label="${option.key}" translate="no">${option.label}</span>${option.key === "normal" ? "<small>기본</small>" : ""}${option.hint ? `<button type="button" class="run-metric-hint" data-strength-hint="${option.key}" aria-label="${option.label} 안내">ⓘ</button>` : ""}</strong><span class="vela-strength-time">${option.time}</span></span><span class="vela-strength-score">${option.score.toLocaleString("ko-KR", { minimumFractionDigits: 1 })}점</span><span class="model-check" aria-hidden="true"></span></label>`).join("")}</div>
      <footer><button type="button" class="model-back">모델 선택</button><span></span><button type="button" class="primary">다음</button><button type="button" class="model-cancel">취소</button></footer>`;
    body.querySelector(`[name=strength][value=${strength}]`).checked = true;
    body.querySelectorAll('[name=strength]').forEach(input => input.onchange = () => { strength = velaSearch(input.value).key; paintChoices(body); });
    refreshStrengthLabels();
    strengthHints = bindMetricHints(node, VELA_SEARCH.filter(option => option.hint).map(option => ({ button: body.querySelector(`[data-strength-hint=${option.key}]`), text: option.hint })));
    body.querySelector('.model-back').onclick = step(select);
    body.querySelector('.model-cancel').onclick = () => node.close();
    body.querySelector('.primary').onclick = step(inspectVela);
    paintChoices(body); focusPrimary();
  }
  async function inspectVela() {
    const current = progressScreen("VELA 준비"), signal = controller.signal;
    body.querySelectorAll(".model-meter, progress").forEach(element => element.hidden = true);
    body.querySelector(".model-loading-title").textContent = "사용할 모델을 확인하고 있습니다.";
    try {
      const { latest } = await coordinator.inspectVela(signal);
      if (signal.aborted || current !== epoch || !node.open) return;
      if (localModel) localPreparation(latest);
      else if (coordinator.velaCacheAllowed) loadVela(true, latest);
      else consent(latest);
    } catch (error) {
      if (!signal.aborted && current === epoch && node.open) {
        failure(error, inspectVela);
      }
    }
  }
  function localPreparation(manifest) {
    busy = false;
    heading.textContent = "VELA 준비";
    body.innerHTML = preparationConsent({ bytes: manifest.bytes, intro: "이 PC의 모델 파일을 불러옵니다.", memory: memoryText(manifest), local: true, storage: false });
    body.querySelector(".model-back").onclick = step(selectStrength);
    const primary = body.querySelector(".primary"); primary.textContent = "모델 불러오기";
    primary.onclick = step(() => loadVela(false, manifest));
    focusPrimary();
  }
  function consent(manifest, issue) {
    busy = false;
    heading.textContent = "VELA 준비";
    const resident = coordinator.vela?.ready && sameModel(coordinator.vela.info.manifest, manifest);
    const supported = coordinator.velaSupport.storage !== false && !!navigator.storage?.getDirectory && !issue;
    body.innerHTML = preparationConsent({ bytes: manifest.bytes, resident, supported, local: localModel,
      intro: resident ? "모델은 준비되어 있습니다. 다음 접속을 위한 저장 여부를 선택하세요." : localModel ? "이 PC의 모델 파일을 불러와 준비합니다." : "전체 모델을 한 번 내려받아 준비합니다.",
      memory: memoryText(manifest), saveHint: resident ? localModel ? "저장 시 파일을 다시 읽습니다" : "저장 시 다시 다운로드" : "" });
    if (!supported) showSupport(body.querySelector(".cache-support"), issue || "storage-unsupported", { retry: issue ? () => consent(manifest) : null, target: "모델 저장", retryLabel: "설정 변경" });
    body.querySelector(".model-back").onclick = step(selectStrength);
    const primary = body.querySelector(".primary"); primary.textContent = "모델 불러오기";
    primary.onclick = async () => {
      const persist = body.querySelector("[name=cache]:checked").value === "yes";
      if (persist) {
        busy = true;
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
      step(() => loadVela(persist, manifest))();
    };
    paintChoices(body); focusPrimary();
  }
  function progressScreen(title, manifest) {
    strengthHints?.dispose(); strengthHints = null;
    busy = true;
    ready = false;
    // Preparation can hand off to another dialog asynchronously. Settings are
    // entered from model selection, where that parent stays stable.
    settingsEntry.hidden = true;
    heading.textContent = title;
    body.innerHTML = preparationProgress({ transferLabel, memory: manifest ? memoryText(manifest) : "" });
    body.querySelector(".model-back").onclick = step(select); body.querySelector(".model-cancel").onclick = () => node.close();
    controller?.abort(); controller = new AbortController(); return ++epoch;
  }
  async function loadVela(persist, manifest, cachedOnly = false) {
    const current = progressScreen("VELA 준비", manifest), signal = controller.signal;
    const transfer = localModel ? null : downloadProgress(body.querySelector(".model-transfer-detail"));
    signal.addEventListener("abort", () => transfer?.dispose(), { once: true });
    let downloaded = false;
    try {
      const info = await coordinator.prepareVela({ persist, manifest, cachedOnly, strength, signal, onProgress: data => {
        if (current !== epoch || !node.open) return;
        transfer?.update(data);
        const cached = data.phase === "cache";
        body.querySelector(".model-loading-title").textContent = cached ? "모델을 메모리에 준비하는 중" : data.phase === "download" ? localModel ? "VELA를 불러오는 중" : "VELA를 내려받는 중" : data.phase === "retry" ? localModel ? "모델 파일을 다시 읽는 중" : "모델을 다시 내려받는 중" : "VELA를 준비하는 중";
        body.querySelector(".model-loading-detail").textContent = data.phase === "retry" ? localModel ? "브라우저 저장본 대신 이 PC의 모델 파일을 읽습니다." : "저장된 파일을 확인하지 못해 새로 받습니다." : "준비가 끝나면 바로 사용할 수 있습니다.";
        if (data.phase === "download" || (!downloaded && cached)) {
          body.querySelector(".model-meter span").textContent = cached ? "저장된 파일" : transferLabel;
          setLocalizedAttribute(body.querySelector(".model-download"), "aria-label", cached ? "저장된 모델 읽기" : localModel ? "모델 파일 읽기" : "모델 다운로드");
          body.querySelector(".model-transfer").textContent = data.total ? `${megabytes(data.received)} / ${megabytes(data.total)}` : "준비 중";
          body.querySelector(".model-download").value = data.fraction || 0;
          if (data.phase === "download") downloaded = true;
        }
        if (downloaded && data.phase === "prepare") {
          body.querySelector(".model-transfer").textContent = `${megabytes(manifest.bytes)} / ${megabytes(manifest.bytes)}`;
          body.querySelector(".model-download").value = 1;
        }
        body.querySelector(".model-prepare").value = data.prepared || 0;
        body.querySelector(".model-prepared").textContent = data.prepared ? `${Math.round(data.prepared * 100)}%` : "대기 중";
      }});
      if (signal.aborted || current !== epoch || !node.open) return;
      heading.textContent = `${info.manifest.name} 준비 완료`;
      ready = true;
      busy = false;
      body.innerHTML = preparationReady({ ...info, local: localModel, initial });
      if (info.cacheFailed) { showSupport(body.querySelector(".cache-support"), info.cacheIssue || "storage-failed", { target: "모델 저장" }); toast("모델을 저장하지 못했습니다. 이번에는 사용할 수 있습니다."); }
      body.querySelector(".model-back").onclick = step(select);
      body.querySelector(".primary").onclick = () => node.close();
      focusPrimary();
    } catch (error) { if (!signal.aborted && current === epoch && node.open) failure(error, inspectVela); }
    finally { transfer?.dispose(); }
  }
  async function loadX36() {
    const current = progressScreen("X36 준비"), signal = controller.signal;
    preparationStage(body, "실행 환경 준비 중", 1, 2);
    body.querySelector(".model-loading-detail").textContent = "준비가 끝나면 바로 사용할 수 있습니다.";
    try {
      await coordinator.prepare({ signal, onProgress: data => {
        if (signal.aborted || current !== epoch || !node.open) return;
        preparationStage(body, data.phase === "warmup" ? "동작 확인 중" : "실행 환경 준비 중", data.phase === "warmup" ? 2 : 1, 2);
      } }); coordinator.checkGpu();
      if (signal.aborted || current !== epoch || !node.open) return;
      leave(() => showSettings(coordinator, { initial, parent, onBack: () => showModelSelection(coordinator, { initial, selectedModel: selected, onFinish, parent }), onCancel: initial && !coordinator.enabled ? confirmSkip : undefined, onFinish }));
    } catch (error) { if (!signal.aborted && current === epoch && node.open) failure(error, loadX36); }
  }
  function failure(error, retry) {
    busy = false;
    diagnostics.capture(error, "model.prepare");
    console.error("Model preparation failed", error);
    heading.textContent = "모델을 준비하지 못했습니다";
    body.innerHTML = '<p class="model-intro">다시 시도하거나 다른 모델을 선택할 수 있습니다.</p><div class="model-support failure-support"></div><footer><button class="model-back">모델 선택</button><button class="diagnostics-button">진단 정보</button><span></span><button class="primary">다시 시도</button></footer>';
    body.querySelector(".diagnostics-button").onclick = showDiagnostics;
    showSupport(body.querySelector(".failure-support"), error.code || "network", { target: "모델 준비" });
    body.querySelector(".model-back").onclick = step(select); body.querySelector(".primary").onclick = retry; focusPrimary();
  }
  select(); return node;
}
