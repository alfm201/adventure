import { compatibilityMessage } from "../../content/compatibility.js";

export function showSupport(container, code, { retry, target = "사용 가능 여부", label, retryLabel = "다시 확인" } = {}) {
  const key = `${code}:${target}:${!!retry}`;
  if (container.dataset.support === key && container.firstChild) return;
  container.dataset.support = key;
  container.replaceChildren();
  const { title, detail } = compatibilityMessage(code);
  const row = document.createElement("div"), toggle = document.createElement("button"), message = document.createElement("p");
  row.className = "support-actions";
  toggle.type = "button"; toggle.className = "support-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", `${target}: ${title}. 원인과 해결 방법`);
  const text = document.createElement("span"); text.textContent = label || title;
  toggle.append(text);
  message.id = "support-detail-" + Math.random().toString(36).slice(2);
  message.className = "support-message"; message.textContent = detail; message.hidden = true;
  toggle.setAttribute("aria-controls", message.id);
  toggle.onclick = () => { message.hidden = !message.hidden; toggle.setAttribute("aria-expanded", String(!message.hidden)); };
  row.append(toggle);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "support-retry";
    button.setAttribute("aria-label", `${target} ${retryLabel}`);
    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8a6 6 0 1 0 0 4M16 3v5h-5"/></svg><span></span>';
    button.querySelector("span").textContent = retryLabel;
    button.onclick = retry; row.append(button);
  }
  container.append(row, message);
}
