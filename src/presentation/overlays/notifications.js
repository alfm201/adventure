export function syncNotifications() {
  const stack = document.querySelector("#notification-stack");
  if (!stack) return;
  const popover = typeof stack.showPopover === "function";
  if (popover) stack.setAttribute("popover", "manual");
  const hide = () => { if (popover) { try { stack.hidePopover(); } catch {} } };
  stack.hidden = ![...stack.children].some(element => !element.hidden);
  if (stack.hidden) hide();
  else if (popover) { try { stack.showPopover(); } catch {} }
  if (!stack.hidden) {
    stack.style.bottom = "";
    const controls = document.querySelector(".toolbar")?.getBoundingClientRect();
    const bounds = stack.getBoundingClientRect();
    if (controls && bounds.left < controls.right && bounds.right > controls.left && bounds.top < controls.bottom && bounds.bottom > controls.top)
      stack.style.bottom = Math.max(12, innerHeight - controls.top + 12) + "px";
  }
}

const notices = new Map(), dismissed = new Map(), visible = [], waiting = [];
let sequence = 0, timer, hiddenAt = document.hidden ? performance.now() : undefined;
const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const icons = {
  success: '<path d="m6 12 4 4 8-8"/>',
  warning: '<path d="M12 7v6m0 4h.01"/>',
  info: '<path d="M12 11v6m0-10h.01"/>',
  loading: '<path d="M20 12a8 8 0 1 1-8-8"/>',
};

function animate(element, frames, duration = 350, easing = "cubic-bezier(0.22, 1, 0.36, 1)", options = {}) {
  if (motion() && typeof element.animate === "function")
    return element.animate(frames, { duration, easing, ...options });
}

function layout(change) {
  const positions = new Map(visible.map(item => [item, item.element.getBoundingClientRect().top]));
  change();
  for (const item of visible) if (positions.has(item) && !item.leaving && !item.dragging) {
    const offset = positions.get(item) - item.element.getBoundingClientRect().top;
    if (Math.abs(offset) > 1) animate(item.element, [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }], 300, "cubic-bezier(0.22, 1, 0.36, 1)");
  }
}

function paint(item) {
  const element = item.element;
  element.className = "notification notification-" + item.tone;
  element.querySelector(".notification-icon").innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[item.tone] || icons.info}</svg>`;
  element.querySelector(".notification-message").textContent = item.message;
  const button = element.querySelector(".notification-action");
  button.hidden = !item.action;
  button.textContent = item.actionLabel || "확인";
  button.onclick = () => item.action?.();
}

function deadline(item) {
  return item.started + (waiting.length ? Math.max(3500, item.duration - waiting.length * 700) : item.duration);
}

function schedule() {
  clearTimeout(timer);
  if (document.hidden) return;
  const timed = visible.filter(item => item.duration && !item.leaving && !item.dragging);
  if (!timed.length) return;
  timer = setTimeout(() => {
    const now = performance.now();
    for (const item of timed) if (deadline(item) <= now + 1) remove(item);
    schedule();
  }, Math.max(0, Math.min(...timed.map(deadline)) - performance.now()));
}

function pump() {
  const stack = document.querySelector("#notification-stack");
  if (!stack) return;
  while (visible.length < 3 && waiting.length) {
    const item = waiting.shift();
    item.element = document.createElement("div");
    item.element.dataset.notice = item.key;
    item.element.setAttribute("role", "status");
    item.element.setAttribute("aria-atomic", "true");
    item.element.innerHTML = '<span class="notification-icon"></span><span class="notification-message"></span><button type="button" class="notification-action" hidden></button><button type="button" class="notification-close" aria-label="알림 닫기"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg></button>';
    item.started = document.hidden ? hiddenAt ?? performance.now() : performance.now();
    paint(item);
    item.element.classList.add("notification-in");
    item.element.querySelector(".notification-close").onclick = () => dismiss(item);
    bindSwipe(item);
    layout(() => { visible.push(item); stack.append(item.element); syncNotifications(); });
  }
  syncNotifications();
  schedule();
}

function bindSwipe(item) {
  const element = item.element;
  let drag;
  element.addEventListener("pointerdown", event => {
    if (drag || event.isPrimary === false || event.button !== 0 || event.target.closest("button") || item.leaving) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), offset: 0 };
    item.dragging = true;
    element.setPointerCapture(event.pointerId);
    schedule();
  });
  element.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.x, y = event.clientY - drag.y;
    if (!drag.offset && (Math.abs(x) < 8 || Math.abs(y) > Math.abs(x))) return;
    drag.offset = x;
    element.style.transform = `translateX(${x}px)`;
    element.style.opacity = String(Math.max(.35, 1 - Math.abs(x) / element.offsetWidth));
  });
  const end = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { offset, at } = drag, elapsed = performance.now() - at;
    drag = null; item.dragging = false; item.started += elapsed;
    const opacity = element.style.opacity || "1";
    if (event.type === "pointerup" && (Math.abs(offset) > Math.min(100, element.offsetWidth * .25) || Math.abs(offset) > 35 && Math.abs(offset) / Math.max(1, elapsed) > .5)) {
      dismiss(item, offset);
    } else {
      element.style.transform = ""; element.style.opacity = "";
      if (offset) animate(element, [{ opacity, transform: `translateX(${offset}px)` }, { opacity: 1, transform: "translateX(0)" }]);
      schedule();
    }
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) element.addEventListener(type, end);
}

function dismiss(item, offset = 0) {
  if (!item.key.startsWith("toast-")) {
    dismissed.set(item.key, { message: item.message, tone: item.tone });
    if (dismissed.size > 32) dismissed.delete(dismissed.keys().next().value);
  }
  remove(item, offset);
}

function remove(item, offset = 0) {
  if (item.leaving) return;
  item.leaving = true;
  if (notices.get(item.key) === item) notices.delete(item.key);
  if (!item.element) {
    const idx = waiting.indexOf(item);
    if (idx !== -1) waiting.splice(idx, 1);
    schedule();
    return;
  }
  let done = false, fallback;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    item.element.removeEventListener("animationend", finish);
    layout(() => {
      const index = visible.indexOf(item);
      if (index !== -1) visible.splice(index, 1);
      item.element.remove();
      syncNotifications();
    });
    pump();
  };
  if (offset) {
    const animation = animate(item.element, [
      { opacity: item.element.style.opacity || 1, transform: `translateX(${offset}px)` },
      { opacity: 0, transform: `translateX(${Math.sign(offset) * (item.element.offsetWidth + 30)}px) scale(0.92)` }
    ], 260, "cubic-bezier(0.2, 0.8, 0.2, 1)", { fill: "forwards" });
    if (animation) animation.finished.then(finish, finish);
    else finish();
  } else {
    item.element.classList.remove("notification-in");
    item.element.classList.add("notification-out");
    item.element.addEventListener("animationend", finish, { once: true });
    fallback = setTimeout(finish, 380);
  }
}

export function notify(key, message, { tone = "info", duration = 5500, action, actionLabel } = {}) {
  message = String(message || "").trim();
  if (!message) return;
  const previous = dismissed.get(key);
  if (previous?.message === message && previous.tone === tone) return;
  dismissed.delete(key);
  let item = notices.get(key);
  if (item) {
    const hadAction = !!item.action;
    item.action = action;
    if (item.message === message && item.tone === tone && item.duration === duration && item.actionLabel === actionLabel && hadAction === !!action) return;
    Object.assign(item, { message, tone, duration, actionLabel, started: document.hidden ? hiddenAt ?? performance.now() : performance.now() });
    if (item.element) layout(() => { paint(item); syncNotifications(); });
  } else {
    item = { key, message, tone, duration, action, actionLabel };
    notices.set(key, item); waiting.push(item);
  }
  pump();
}

export function dismissNotification(key) {
  const item = notices.get(key);
  if (item) remove(item);
}

export function toast(message) {
  if ([...notices.values()].some(item => item.message === message)) return;
  notify("toast-" + ++sequence, message, { tone: "info" });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = performance.now(); clearTimeout(timer); }
  else {
    if (hiddenAt !== undefined) for (const item of visible) item.started += performance.now() - hiddenAt;
    hiddenAt = undefined; schedule();
  }
});
addEventListener("resize", () => requestAnimationFrame(syncNotifications));
