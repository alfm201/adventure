import { Session } from "../application/session.js";
import { Coordinator } from "../application/coordinator.js";
import { Assets } from "../content/assets.js";
import { GameView } from "../presentation/components/view.js";
import { BoardRenderer } from "../presentation/board/renderer.js";
import { Prediction } from "../presentation/overlays/prediction.js";
import { bindInputs } from "../presentation/input/bindings.js";
import { showModelSelection } from "../presentation/overlays/models.js";
import { toast } from "../presentation/overlays/dialogs.js";
import { syncNotifications } from "../presentation/overlays/notifications.js";
import { removeRetiredModelCaches } from "../compute/vela/storage.js";
import { attachDiagnostics } from "../application/diagnostics.js";
import { diagnostics } from "../platform/report.js";
import { bindDiagnostics } from "../presentation/overlays/diagnostics.js";

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
  assets = new Assets(),
  view = new GameView(assets);
attachDiagnostics(session, coordinator, assets);
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
assets.addEventListener("change", () => {
  for (const [id, variable] of [[77, "--portrait-image"], [78, "--card-image"], [82, "--arrows-image"]]) {
    const image = assets.get(id);
    if (image) document.body.style.setProperty(variable, `url("${image.src}")`);
  }
  view.render(session.view, coordinator.result);
  document.body.classList.toggle("missing-portrait", !assets.get(77));
  document.body.classList.toggle("missing-arrows", !assets.get(82));
  const notice = document.querySelector("#asset-notice"), missing = assets.missing;
  notice.hidden = !missing.length || !document.querySelector("#loading").hidden;
  const failed = missing.some(record => record.state === "failed");
  notice.querySelector("span").textContent = failed ? "일부 이미지를 불러오지 못했습니다." : "이미지를 불러오는 중입니다.";
  notice.querySelector("button").hidden = !failed;
  syncNotifications();
});
document.querySelector("#asset-notice button").onclick = () => assets.retryFailed();
coordinator.addEventListener("notice", event => toast(event.message));
coordinator.addEventListener("change", () => {
  view.render(session.view, coordinator.result);
  if (coordinator.result.status === "error") toast(coordinator.result.message);
});
bindInputs(session, coordinator, renderer, prediction);
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
  showModelSelection(coordinator, { initial: true });
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
