import { dialog, paintChoices, canOpenDialog } from "./dialogs.js";
import { showLyraPreparation } from "./lyra-preparation.js";
import { compatibilityMessage } from "../../content/compatibility.js";
import { showSupport } from "../components/support.js";
const usageOptions = [
  ["low", "낮음", "다른 작업 우선"],
  ["medium", "보통", "균형"],
  ["high", "높음", "빠른 계산 우선"],
];
export function showSettings(coordinator, { model = "x36", initial = false, selection, onBack, onCancel, onFinish, parent = null } = {}) {
  if (!canOpenDialog(parent)) return;
  const resume = coordinator.suspend();
  const lyra = model === "lyra";
  const settings = coordinator.settings,
    defaultWorkers = Math.ceil(coordinator.maxWorkers / 2),
    workers = [
      ...new Set([
        1,
        defaultWorkers,
        coordinator.maxWorkers,
        settings.workers || defaultWorkers,
      ]),
    ].sort((a, b) => a - b);
  const choice = (name, value, title, detail, defaultChoice = false) =>
    `<label class="model-choice compute-choice"><input type="radio" name="${name}" value="${value}"><span class="model-choice-copy"><strong>${title}${defaultChoice ? "<small>기본</small>" : ""}</strong><span class="compute-description">${detail}</span></span><span class="model-check" aria-hidden="true"></span></label>`;
  const body = document.createElement("form");
  body.method = "dialog";
  body.innerHTML = `<p class="model-intro">계산 방식과 기기 사용량을 고르세요.</p>${lyra ? `
  <p class="model-research-notice">연구용 모델입니다. 사용 중 예상하지 못한 동작이 있을 수 있습니다.</p>
  <fieldset class="compute-engine-options lyra-engine-options" aria-label="LYRA 실행 장치">${choice("engine", "auto", "자동", "GPU 우선", true)}${choice("engine", "cpu", "CPU", "CPU로 계산")}${choice("engine", "gpu", "GPU", "GPU로 계산")}</fieldset>
  <p class="lyra-gpu-availability" aria-live="polite"></p>
  <fieldset class="lyra-usage-panel"><legend>사용량</legend><div class="compute-options">${usageOptions.map(([key, title, detail]) => choice("usage", key, title, detail, key === "medium")).join("")}</div></fieldset>
  <p class="model-note">낮음은 처리 부하를 줄이고, 높음은 빠른 계산을 우선합니다. 모든 설정에서 같은 모델과 정책을 사용합니다.</p>
  ` : `
  <fieldset class="compute-engine-options" aria-label="계산 엔진">${choice("engine", "gpu", "GPU", "G3 · 더 많은 표본")}${choice("engine", "cpu", "CPU", "G3 · 적은 연산량")}</fieldset>
  <div class="model-support gpu-support"></div>
  <fieldset data-engine-panel="gpu"><legend>GPU 사용량</legend><div class="compute-options">${usageOptions.map(([key, title, detail]) => choice("usage", key, title, detail, key === "medium")).join("")}</div></fieldset>
  <fieldset data-engine-panel="cpu"><legend>CPU 사용량</legend><div class="compute-options">${workers.map((n) => choice("workers", n, n === 1 ? "낮음" : n === coordinator.maxWorkers ? "높음" : "보통", `${n}개 동시 계산`, n === defaultWorkers)).join("")}</div></fieldset>`}
  <footer><span></span><button type="submit" class="primary">${lyra ? "다음" : initial ? "시작" : "적용"}</button><button type="button" class="compute-cancel">취소</button></footer>`;
  for (const [key, value] of Object.entries(lyra ? {
    engine: selection?.engine ?? settings.lyraDevice ?? 'auto', usage: selection?.usage ?? settings.lyraUsage ?? 'medium',
  } : {
    engine: settings.engine,
    usage: settings.usage,
    workers: settings.workers || defaultWorkers,
  }))
    body.elements[key].value = String(value);
  const gpuRadio = body.querySelector("[name=engine][value=gpu]");
  let engineChanged = false;
  const refresh = () => {
    const engine = body.elements.engine.value;
    body.querySelectorAll("[data-engine-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.enginePanel !== engine;
      panel
        .querySelectorAll("input")
        .forEach((input) => (input.disabled = panel.hidden));
    });
    paintChoices(body);
  };
  const refreshSupport = () => {
    if (lyra) {
      const support = coordinator.lyraGpuSupport, hint = body.querySelector('.lyra-gpu-availability');
      gpuRadio.disabled = !support.available;
      if (gpuRadio.disabled && body.elements.engine.value === 'gpu') body.elements.engine.value = 'auto';
      hint.textContent = support.state === 'checking' || support.state === 'unchecked' ? 'GPU 사용 가능 여부 확인 중'
        : support.available ? 'GPU 사용 가능' : '이 환경에서는 GPU를 사용할 수 없습니다.';
      refresh(); return;
    }
    const support = coordinator.gpuSupport, detail = body.querySelector(".gpu-support");
    const pending = support.state === "checking" || support.state === "unchecked";
    gpuRadio.disabled = support.state !== "available";
    const hint = gpuRadio.closest("label").querySelector(".compute-description");
    hint.textContent = pending ? "사용 가능 여부 확인 중" : support.available ? "G3 · 더 많은 표본" : compatibilityMessage(support.code).title;
    if (gpuRadio.disabled) body.elements.engine.value = "cpu";
    else if (!engineChanged && settings.engine === "gpu") body.elements.engine.value = "gpu";
    if (!pending && !support.available && detail.dataset.code !== support.code) {
      detail.dataset.code = support.code;
      showSupport(detail, support.code, { retry: () => coordinator.checkGpu(true), target: "GPU 사용 가능 여부", label: "GPU 사용 불가 · 도움말" });
    } else if (pending || support.available) { detail.replaceChildren(); delete detail.dataset.code; }
    refresh();
  };
  body.addEventListener("change", event => { if (event.target.name === "engine") engineChanged = true; refresh(); });
  coordinator.addEventListener("capabilities", refreshSupport);
  if (lyra) coordinator.checkLyraGpu(); else coordinator.checkGpu();
  refreshSupport();
  if (onBack) {
    const back = document.createElement("button");
    back.type = "button"; back.className = "model-back"; back.textContent = "모델 선택";
    body.querySelector("footer").prepend(back);
    back.onclick = () => { returning = true; node.addEventListener("close", onBack, { once: true }); node.close(); };
  }
  const node = dialog(lyra ? "LYRA 실행 장치 선택" : "X36 엔진 선택", body, { className: "model-dialog compute-dialog", parent });
  let applied = false, returning = false;
  body.querySelector(".compute-cancel").onclick = () => node.close();
  node.addEventListener("close", () => {
    resume();
    coordinator.removeEventListener("capabilities", refreshSupport);
    if (lyra && !applied) coordinator.cancelModelPreparation();
    if (applied || returning) return;
    if (onCancel) onCancel();
    else {
      if (coordinator.enabled) coordinator.recalculate();
      onFinish?.();
    }
  }, { once: true });
  body.onsubmit = (e) => {
    e.preventDefault();
    if (lyra) {
      const device = body.elements.engine.value, usage = body.elements.usage.value;
      if (device === 'gpu' && !coordinator.lyraGpuSupport.available) { refreshSupport(); return; }
      returning = true;
      node.addEventListener("close", () => showLyraPreparation(coordinator, { device, usage, initial, parent, persist: selection?.persist,
        onBack: persist => showSettings(coordinator, { model, initial, parent, selection: { engine: device, usage, persist }, onBack, onCancel, onFinish }),
        onCancel, onFinish }), { once: true });
      node.close();
      return;
    }
    applied = true;
    const next = {
      model: "x36",
      engine: body.elements.engine.value === "gpu" && coordinator.gpuSupport.available ? "gpu" : "cpu",
      usage: body.elements.usage.value,
      workers: Number(body.elements.workers.value),
    };
    resume(); node.close();
    coordinator.configure(next);
    onFinish?.();
  };
  return node;
}
