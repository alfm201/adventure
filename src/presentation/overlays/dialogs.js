import { syncNotifications } from "./notifications.js";
export { toast } from "./notifications.js";

const fallbackDialogs = [];
let frameState;
function syncFallbacks() {
  const frame = document.querySelector("#frame"), top = fallbackDialogs[fallbackDialogs.length - 1]?.node;
  if (top && frame && !frameState) {
    frameState = { inert: frame.hasAttribute("inert"), hidden: frame.getAttribute("aria-hidden") };
    frame.setAttribute("inert", ""); frame.setAttribute("aria-hidden", "true");
  }
  if (!top && frame && frameState) {
    if (!frameState.inert) frame.removeAttribute("inert");
    if (frameState.hidden === null) frame.removeAttribute("aria-hidden");
    else frame.setAttribute("aria-hidden", frameState.hidden);
    frameState = null;
  }
  fallbackDialogs.forEach(({ node, backdrop }, index) => {
    backdrop.style.zIndex = 10000 + index * 2;
    node.style.zIndex = 10001 + index * 2;
    if (node === top) { node.removeAttribute("inert"); node.removeAttribute("aria-hidden"); }
    else { node.setAttribute("inert", ""); node.setAttribute("aria-hidden", "true"); }
    node.setAttribute("aria-modal", String(node === top));
  });
}
function blockFallbackInput(event) {
  const top = fallbackDialogs[fallbackDialogs.length - 1]?.node;
  if (!top || top.contains(event.target) || event.target.closest?.("#notification-stack")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.type === "focusin") (top.querySelector(".primary:not(:disabled),input:not(:disabled),button:not(:disabled)") || top).focus({ preventScroll: true });
}

export function paintChoices(root) {
  root.querySelectorAll(".model-choice,.cache-options label,.option").forEach(label => {
    const input = label.querySelector("input");
    label.classList.toggle("is-selected", !!input?.checked);
    label.classList.toggle("is-unavailable", !!input?.disabled);
  });
}
export function dialog(title, body, { className = "" } = {}) {
  const previous = document.activeElement,
    node = document.createElement("dialog");
  node.className = className;
  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.id = "dialog-title-" + Math.random().toString(36).slice(2);
  node.setAttribute("aria-labelledby", heading.id);
  if (className === "help-tour") node.append(heading, body);
  else {
    const header = document.createElement("header"), close = document.createElement("button");
    header.className = "dialog-header";
    close.type = "button";
    close.className = "dialog-close";
    close.setAttribute("aria-label", "닫기");
    close.textContent = "×";
    close.onclick = () => node.close();
    header.append(heading, close);
    node.append(header, body);
  }
  document.body.append(node);
  let backdrop, escape;
  if (typeof node.showModal !== "function" || typeof node.close !== "function") {
    node.classList.add("dialog-fallback");
    if (!("open" in node)) Object.defineProperty(node, "open", { get: () => node.hasAttribute("open") });
    node.setAttribute("role", "dialog"); node.setAttribute("aria-modal", "true");
    node.showModal = () => {
      node.setAttribute("open", "");
      backdrop = document.createElement("div"); backdrop.className = "dialog-backdrop";
      document.body.insertBefore(backdrop, node);
      if (!fallbackDialogs.length)
        for (const type of ["click", "pointerdown", "keydown", "focusin", "wheel"])
          document.addEventListener(type, blockFallbackInput, { capture: true, passive: false });
      fallbackDialogs.push({ node, backdrop }); syncFallbacks();
    };
    node.close = () => {
      if (!node.hasAttribute("open")) return;
      node.removeAttribute("open"); backdrop?.remove();
      const index = fallbackDialogs.findIndex(item => item.node === node);
      if (index >= 0) fallbackDialogs.splice(index, 1);
      syncFallbacks();
      if (!fallbackDialogs.length)
        for (const type of ["click", "pointerdown", "keydown", "focusin", "wheel"])
          document.removeEventListener(type, blockFallbackInput, true);
      node.dispatchEvent(new Event("close"));
    };
    escape = event => {
      if (event.key !== "Escape" || !node.hasAttribute("open")) return;
      const open = document.querySelectorAll("dialog[open]");
      if (open[open.length - 1] !== node) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (node.dispatchEvent(new Event("cancel", { cancelable: true }))) node.close();
    };
    document.addEventListener("keydown", escape, true);
  }
  const observer = new MutationObserver(() => paintChoices(node));
  observer.observe(body, { childList: true });
  node.addEventListener("change", () => paintChoices(node));
  paintChoices(node);
  node.addEventListener(
    "close",
    () => {
      observer.disconnect(); backdrop?.remove();
      if (escape) document.removeEventListener("keydown", escape, true);
      syncNotifications();
      node.remove();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    },
    { once: true },
  );
  node.showModal();
  syncNotifications();
  if (className !== "help-tour")
    (body.querySelector("button.primary:not(:disabled)") ?? body.querySelector("button:not(:disabled)") ?? node.querySelector(".dialog-close"))?.focus({ preventScroll: true });
  return node;
}
export function askValue(title, {
  value = "", min, max, text = false, label: fieldLabel = "값",
  hint, placeholder = "",
} = {}) {
  return new Promise((resolve) => {
    const form = document.createElement("form");
    form.method = "dialog";
    const label = document.createElement("label");
    label.className = "dialog-field";
    label.textContent = fieldLabel;
    const input = document.createElement("input");
    input.type = text ? "text" : "number";
    input.value = value;
    input.placeholder = placeholder;
    input.required = true;
    input.autocomplete = "off";
    if (!text) {
      input.min = min;
      input.max = max;
      input.step = 1;
    }
    label.append(input);
    form.append(label);
    const description = hint ?? (min !== undefined && max !== undefined ? `${min.toLocaleString()}–${max.toLocaleString()} 사이의 숫자` : "");
    if (description) {
      const note = document.createElement("p");
      note.className = "dialog-hint";
      note.id = "input-hint-" + Math.random().toString(36).slice(2);
      note.textContent = description;
      input.setAttribute("aria-describedby", note.id);
      form.append(note);
    }
    const footer = document.createElement("footer"),
      cancel = document.createElement("button"),
      ok = document.createElement("button");
    cancel.textContent = "취소";
    cancel.type = "button";
    ok.textContent = "확인";
    ok.className = "primary";
    footer.append(ok, cancel);
    form.append(footer);
    const node = dialog(title, form, { className: "prompt-dialog" });
    let answer = null;
    cancel.onclick = () => node.close();
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      answer = text ? input.value : Number(input.value);
      node.close();
    };
    node.addEventListener("close", () => resolve(answer), { once: true });
    input.focus({ preventScroll: true });
    input.select();
  });
}
export function confirmAction(title, message, {
  confirmLabel = "확인", cancelLabel = "취소", className = "confirm-dialog",
} = {}) {
  return new Promise((resolve) => {
    const body = document.createElement("div"),
      p = document.createElement("p");
    p.textContent = message;
    const footer = document.createElement("footer");
    const cancel = document.createElement("button"),
      ok = document.createElement("button");
    cancel.textContent = cancelLabel;
    ok.textContent = confirmLabel;
    ok.className = "primary";
    footer.append(ok, cancel);
    body.append(p, footer);
    const node = dialog(title, body, { className });
    let answer = false;
    cancel.onclick = () => node.close();
    ok.onclick = () => {
      answer = true;
      node.close();
    };
    node.addEventListener("close", () => resolve(answer), { once: true });
  });
}
