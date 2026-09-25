import { Session } from "../application/session.js";
import { Coordinator } from "../application/coordinator.js";
import { Assist } from "../application/assist.js";
import { AssistVoice } from "../application/voice.js";
import { Assets } from "../content/assets.js";
import { GameView } from "../presentation/components/view.js";
import { BoardRenderer } from "../presentation/board/renderer.js";
import { Prediction } from "../presentation/overlays/prediction.js";
import { bindInputs } from "../presentation/input/bindings.js";
import { showModelSelection } from "../presentation/overlays/models.js";
import { isNoticeDismissed, showNotice } from "../presentation/overlays/notice.js";
import { toast } from "../presentation/overlays/dialogs.js";
import { notify } from "../presentation/overlays/notifications.js";
import { removeRetiredModelCaches } from "../compute/vela/storage.js";
import { attachDiagnostics } from "../application/diagnostics.js";
import { diagnostics } from "../platform/report.js";
import { bindDiagnostics } from "../presentation/overlays/diagnostics.js";
import { bindAssistBar } from "../presentation/overlays/assist.js";

// Suppress only the browser menu; game-specific right-click handlers still run.
document.addEventListener("contextmenu", event => event.preventDefault(), { capture: true });

document.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, { capture: true });

const session = new Session(),
  coordinator = new Coordinator(session),
  assist = new Assist(session),
  voice = new AssistVoice(session, coordinator, assist),
  assets = new Assets(),
  view = new GameView(assets);
attachDiagnostics(session, coordinator, assets);
diagnostics.provide("assist", () => assist.snapshot);
diagnostics.provide("voice", () => voice.snapshot);
voice.addEventListener("notice", event => toast(event.detail));
bindDiagnostics();
const renderer = new BoardRenderer(
    document.querySelector("#board-canvas"),
    assets,
    (error) => { diagnostics.capture(error, "board.render", null, true); toast(error.message); },
  ),
  prediction = new Prediction(session, renderer);
const render = () => {
  view.render(session.view, coordinator.result);
  renderer.update(session.view);
};
session.addEventListener("change", render);
let imagesPending = false;
assets.addEventListener("change", () => {
  for (const [id, variable] of [[77, "--portrait-image"], [78, "--card-image"], [82, "--arrows-image"]]) {
    const image = assets.get(id);
    if (image) document.body.style.setProperty(variable, `url("${image.src}")`);
  }
  view.render(session.view, coordinator.result);
  document.body.classList.toggle("missing-portrait", !assets.get(77));
  document.body.classList.toggle("missing-arrows", !assets.get(82));
  if (!document.querySelector("#loading").hidden) return;
  const missing = assets.missing;
  if (missing.length) {
    imagesPending = true;
    const failed = missing.some(record => record.state === "failed");
    notify("assets", failed ? "일부 이미지를 불러오지 못했습니다." : "이미지를 불러오는 중입니다.", {
      tone: failed ? "warning" : "loading", duration: 0,
      action: failed ? () => assets.retryFailed() : undefined, actionLabel: failed ? "다시 시도" : undefined,
    });
  } else if (imagesPending) {
    imagesPending = false;
    notify("assets", "이미지 준비가 완료되었습니다.", { tone: "success", duration: 4000 });
  }
});
coordinator.addEventListener("notice", event => toast(event.message));
coordinator.addEventListener("change", () => {
  view.render(session.view, coordinator.result);
  if (coordinator.result.status === "error") toast(coordinator.result.message);
});
bindInputs(session, coordinator, renderer, prediction, assist, voice);
bindAssistBar(session, assist, prediction, voice);
const resize = () => {
  const scale = Math.min(innerWidth / 1234, innerHeight / 694);
  document.querySelector("#frame").style.cssText =
    `width:${1234 * scale}px;height:${694 * scale}px`;
  document.querySelector("#game").style.transform = `scale(${scale})`;
  renderer.draw();
};
addEventListener("resize", resize);
resize();
addEventListener("pagehide", () => {
  voice.dispose();
  assist.dispose();
  renderer.dispose();
  assets.dispose();
  coordinator.dispose();
});
addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});
try {
  const advance = (completed, total) => {
    const percent = Math.round((completed / total) * 100);
    document.querySelector("#loading-progress").value = percent;
    document.querySelector("#loading-percent").textContent = percent + "%";
    document.querySelector("#loading-detail").textContent =
      completed === total ? "준비 완료" : "게임 화면을 준비하고 있습니다.";
  };
  coordinator.checkGpu();
  removeRetiredModelCaches().catch(error => { diagnostics.capture(error, "model.cache.cleanup"); console.error("Model cache cleanup failed", error); });
  await assets.initial(advance);
  render();
  document.querySelector("#loading").hidden = true;
  assets.changed();
  document.querySelector("#frame").inert = false;
  document.querySelector("#frame").removeAttribute("inert");
  if (!isNoticeDismissed()) {
    showNotice({
      onClose: () => showModelSelection(coordinator, { initial: true }),
    });
  } else {
    showModelSelection(coordinator, { initial: true });
  }
} catch (error) {
  diagnostics.capture(error, "boot.main");
  window.adventureBoot.fail();
  document.querySelector("#loading-status").textContent =
    "준비하지 못했습니다.";
  console.error("Loading failed", error);
  document.querySelector("#loading-detail").textContent = "연결을 확인한 뒤 다시 시도해 주세요.";
  const retry = document.createElement("button");
  retry.textContent = "다시 시도";
  retry.onclick = () => location.reload();
  document.querySelector(".loading-card").append(retry);
}
