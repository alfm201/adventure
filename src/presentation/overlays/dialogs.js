import { syncNotifications } from "./notifications.js";
export { toast } from "./notifications.js";
// A child can only be opened by the current top dialog. Ancestors stay open.
export function canOpenDialog(parent = null) {
  const open = [...document.querySelectorAll('dialog[open]')];
  return parent ? parent.open && open.at(-1) === parent : open.length === 0;
}

const fallbackDialogs = [];
const managedDialogs = [];
const outsideRules = new WeakMap();
const canCloseOutside = node => {
  const rule = outsideRules.get(node);
  return typeof rule === 'function' ? rule() : rule !== false;
};
let outsidePress;
const topDialog = () => managedDialogs.filter(node => node.open).at(-1);
function outside(node, event) {
  const panel = node.querySelector('.help-bubble') || node;
  if (panel !== node && !panel.contains(event.target)) return true;
  if (panel !== node || event.target !== node && node.contains(event.target)) return false;
  const r = panel.getBoundingClientRect();
  return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
}
function outsideDown(event) {
  const node = topDialog();
  outsidePress = event.button === 0 && node && outside(node, event) ? { node, allowed: canCloseOutside(node), x: event.clientX, y: event.clientY } : null;
}
function outsideClick(event) {
  const press = outsidePress; outsidePress = null;
  if (!press || press.node !== topDialog() || !outside(press.node, event) || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (press.allowed && canCloseOutside(press.node)) press.node.close();
}
function cancelOutsidePress() { outsidePress = null; }
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
export function dialog(title, body, { className = "", parent = null, closeOnOutside = true } = {}) {
  const previous = document.activeElement,
    node = document.createElement("dialog");
  node.className = className;
  outsideRules.set(node, closeOnOutside);
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
  }
  const closeNow = node.close.bind(node);
  let closing = false, openingAnimation, closingAnimation, closeTimer, closeValue;
  const finishClose = () => {
    clearTimeout(closeTimer);
    closeNow(closeValue);
    closingAnimation?.cancel();
  };
  node.close = value => {
    if (!node.open || closing) return;
    closing = true; closeValue = value;
    node.dispatchEvent(new Event('closing'));
    const target = node.querySelector('.help-bubble') || node;
    const currentStyle = getComputedStyle(target);
    const from = { opacity: currentStyle.opacity, scale: currentStyle.scale === 'none' ? '1' : currentStyle.scale };
    openingAnimation?.cancel();
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || !target.animate) { finishClose(); return; }
    node.classList.add('dialog-closing');
    closingAnimation = target.animate([from, { opacity: 0, scale: '.975' }],
      { duration: 90, easing: 'ease-in', fill: 'forwards' });
    closingAnimation.onfinish = finishClose;
    closeTimer = setTimeout(finishClose, 130);
  };
  const blockClosingInput = event => { if (closing) { event.preventDefault(); event.stopImmediatePropagation(); } };
  for (const type of ['click','submit','keydown']) node.addEventListener(type, blockClosingInput, true);
  escape = event => {
    if (event.key !== 'Escape' || topDialog() !== node) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!closing && node.dispatchEvent(new Event('cancel', { cancelable: true }))) node.close();
  };
  document.addEventListener('keydown', escape, true);
  if (!managedDialogs.length) {
    document.addEventListener('pointerdown', outsideDown, true);
    document.addEventListener('click', outsideClick, true);
    document.addEventListener('pointercancel', cancelOutsidePress, true);
  }
  managedDialogs.push(node);
  const observer = new MutationObserver(() => paintChoices(node));
  observer.observe(body, { childList: true });
  node.addEventListener("change", () => paintChoices(node));
  paintChoices(node);
  node.addEventListener(
    "close",
    () => {
      observer.disconnect(); backdrop?.remove();
      clearTimeout(closeTimer); openingAnimation?.cancel(); closingAnimation?.cancel();
      const index = managedDialogs.indexOf(node);
      if (index >= 0) managedDialogs.splice(index, 1);
      if (!managedDialogs.length) {
        document.removeEventListener('pointerdown', outsideDown, true);
        document.removeEventListener('click', outsideClick, true);
        document.removeEventListener('pointercancel', cancelOutsidePress, true);
        outsidePress = null;
      }
      if (escape) document.removeEventListener("keydown", escape, true);
      syncNotifications();
      node.remove();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    },
    { once: true },
  );
  node.showModal();
  const openingTarget = node.querySelector('.help-bubble') || node;
  if (!node.classList.contains('run-statistics') && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches && openingTarget.animate) {
    openingAnimation = openingTarget.animate([{ opacity: 0, scale: '.975' }, { opacity: 1, scale: '1' }],
      { duration: 120, easing: 'ease-out' });
  }
  if (parent) {
    const closeChild = () => { if (node.open) node.close(); };
    parent.addEventListener('close', closeChild, { once: true });
    node.addEventListener('close', () => parent.removeEventListener('close', closeChild), { once: true });
  }
  syncNotifications();
  if (className !== "help-tour")
    (body.querySelector("button.primary:not(:disabled)") ?? body.querySelector("button:not(:disabled)") ?? node.querySelector(".dialog-close"))?.focus({ preventScroll: true });
  return node;
}
// Move an open dialog to its next screen with the same motion as closing one dialog and opening the next (90 ms out, 120 ms in).
export function stepDialog(node, render) {
  const target = node.querySelector('.help-bubble') || node;
  if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || !target.animate) { render(); return; }
  node.inert = true;
  const out = target.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.975' }], { duration: 90, easing: 'ease-in', fill: 'forwards' });
  let done = false;
  const swap = () => {   // onfinish, or the timer when frames are not running (same fallback as closing)
    if (done) return; done = true; clearTimeout(timer); node.inert = false;
    if (!node.open || node.classList.contains('dialog-closing')) return;
    render(); out.cancel();
    target.animate([{ opacity: 0, scale: '.975' }, { opacity: 1, scale: '1' }], { duration: 120, easing: 'ease-out' });
  };
  const timer = setTimeout(swap, 130);
  out.onfinish = swap;
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
