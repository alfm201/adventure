export function syncNotifications() {
  const stack = document.querySelector("#notification-stack");
  if (!stack) return;
  const dialogs = document.querySelectorAll("dialog[open]:not(.dialog-fallback)"), active = dialogs[dialogs.length - 1];
  const parent = active || document.body;
  const popover = typeof stack.showPopover === "function";
  if (popover) stack.setAttribute("popover", "manual");
  const hide = () => { if (popover) { try { stack.hidePopover(); } catch {} } };
  if (stack.parentElement !== parent) { hide(); parent.append(stack); }
  stack.hidden = ![...stack.children].some(element => !element.hidden);
  if (stack.hidden) hide();
  else if (popover) { try { stack.showPopover(); } catch {} }
}

export function toast(message) {
  const element = document.querySelector("#toast");
  element.querySelector(".notification-message").textContent = message;
  element.hidden = false;
  syncNotifications();
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; syncNotifications(); }, 5500);
}
