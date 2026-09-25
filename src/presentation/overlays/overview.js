import { dialog } from "./dialogs.js";
import { placePopover } from "./prediction.js";

export function bindOverview(coordinator, prediction) {
  const overview = document.querySelector("#score-overview"), estimates = document.querySelector("#estimates"),
    button = document.querySelector("#compare-button"), anchor = document.querySelector("#settings-button");
  const wide = matchMedia("(min-width: 760px) and (min-height: 500px)");
  let opened = null, timer, held = false;
  const hide = () => { if (!opened) overview.hidden = true; };
  const show = event => {
    if (event?.pointerType && event.pointerType !== "mouse") return;
    if (!wide.matches || !coordinator.enabled || !coordinator.session.canRecommend || document.querySelector("dialog")) return;
    prediction.hide(); overview.hidden = false; placePopover(overview, estimates, anchor);
  };
  const expand = () => {
    if (!coordinator.enabled || !coordinator.session.canRecommend || document.querySelector("dialog")) return;
    prediction.hide(); overview.hidden = false; overview.classList.add("overview-expanded");
    overview.style.removeProperty("left"); overview.style.removeProperty("top");
    const marker = document.createComment(""); overview.before(marker);
    const body = document.createElement("div"); body.append(overview);
    opened = dialog(overview.getAttribute("aria-label"), body, { className: "overview-dialog" });
    button.setAttribute("aria-expanded", "true");
    opened.addEventListener("close", () => {
      marker.replaceWith(overview); overview.hidden = true; overview.classList.remove("overview-expanded");
      opened = null; button.setAttribute("aria-expanded", "false");
    }, { once: true });
  };
  button.onclick = expand;
  button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", "false");
  estimates.addEventListener("pointerenter", show);
  estimates.addEventListener("pointerleave", hide);
  document.querySelector("#score-forecast").addEventListener("pointerenter", show);
  document.querySelector("#score-forecast").addEventListener("pointerleave", hide);
  estimates.addEventListener("focusin", show);
  estimates.addEventListener("focusout", hide);
  estimates.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") return;
    held = false; timer = setTimeout(() => { held = true; expand(); }, 550);
  });
  const stopHold = () => clearTimeout(timer);
  for (const type of ["pointerup", "pointercancel", "pointermove"]) estimates.addEventListener(type, stopHold);
  estimates.addEventListener("click", event => { if (held) { held = false; event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  const resize = () => { if (!opened) { if (wide.matches && !overview.hidden) placePopover(overview, estimates, anchor); else hide(); } };
  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => { stopHold(); hide(); });
  coordinator.session.addEventListener("change", hide);
  document.addEventListener("keydown", event => { if (event.key === "Escape") hide(); });
}
