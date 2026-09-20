import { dialog } from "./dialogs.js";

export function askMultiplierRoll(multiplier, anchor, signal) {
  if (signal?.aborted || document.querySelector("dialog")) return Promise.resolve(null);
  return new Promise(resolve => {
    const form = document.createElement("form");
    form.noValidate = true;
    form.innerHTML = `<label class="multiplier-field"><span>나온 눈의 합</span><input type="text" inputmode="numeric" enterkeyhint="done" maxlength="2" autocomplete="off" placeholder="2–12" aria-describedby="multiplier-result"></label>
      <div class="multiplier-grid" role="group" aria-label="주사위 눈의 합"></div>
      <div class="multiplier-detail"><output id="multiplier-result" aria-live="polite"></output><span>Enter 적용</span></div>`;
    const input = form.querySelector("input"), grid = form.querySelector(".multiplier-grid"),
      output = form.querySelector("output"), buttons = [];
    const valid = value => /^(?:[2-9]|1[0-2])$/.test(String(value));
    const preview = value => {
      output.textContent = valid(value) ? `${value} × ${multiplier} = ${Number(value) * multiplier}칸` : "눈의 합을 선택하세요.";
    };
    const update = () => {
      input.removeAttribute("aria-invalid");
      buttons.forEach(button => button.classList.toggle("is-selected", button.dataset.roll === input.value));
      preview(input.value);
    };
    let answer = null;
    const apply = value => {
      if (!node.open || signal?.aborted) return;
      if (!valid(value)) {
        input.setAttribute("aria-invalid", "true");
        output.textContent = "2~12 사이의 합을 입력하세요.";
        input.focus({ preventScroll: true }); input.select();
        return;
      }
      answer = Number(value);
      node.close();
    };
    for (let sum = 2; sum <= 12; sum++) {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.roll = String(sum); button.textContent = sum;
      button.onclick = () => apply(sum);
      button.onpointerenter = event => { if (event.pointerType === "mouse") preview(sum); };
      button.onpointerleave = () => preview(input.value);
      grid.append(button); buttons.push(button);
    }
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "multiplier-cancel"; cancel.textContent = "취소";
    grid.append(cancel);
    const node = dialog(`주사위 ${multiplier}배`, form, { className: "multiplier-dialog" });
    cancel.onclick = () => node.close();
    input.oninput = update;
    input.onfocus = () => input.select();
    form.onsubmit = event => { event.preventDefault(); apply(input.value); };
    node.addEventListener("keydown", event => {
      if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) apply(input.value);
      } else if (event.target !== input && /^[0-9]$/.test(event.key)) {
        event.preventDefault(); input.focus({ preventScroll: true });
        input.value = event.key; input.setSelectionRange(1, 1); update();
      } else if (event.target !== input && event.key === "Backspace") {
        event.preventDefault(); input.focus({ preventScroll: true });
        input.value = input.value.slice(0, -1); input.setSelectionRange(input.value.length, input.value.length); update();
      }
    });
    const desktop = matchMedia("(min-width: 760px) and (hover: hover) and (pointer: fine)");
    const place = () => {
      const anchored = desktop.matches && anchor?.isConnected;
      node.classList.toggle("multiplier-anchored", !!anchored);
      if (!anchored) { node.style.removeProperty("left"); node.style.removeProperty("top"); return; }
      const r = anchor.getBoundingClientRect(), w = node.offsetWidth, h = node.offsetHeight;
      node.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + (r.width - w) / 2)) + "px";
      node.style.top = Math.max(12, Math.min(innerHeight - h - 12, r.top >= h + 22 ? r.top - h - 10 : r.bottom + 10)) + "px";
    };
    const abort = () => { answer = null; node.close(); };
    const outside = event => {
      const r = node.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    };
    let pressedOutside = false;
    node.addEventListener("pointerdown", event => { pressedOutside = outside(event); });
    node.addEventListener("click", event => { if (pressedOutside && outside(event)) node.close(); });
    window.addEventListener("resize", place);
    signal?.addEventListener("abort", abort, { once: true });
    node.addEventListener("close", () => {
      window.removeEventListener("resize", place);
      signal?.removeEventListener("abort", abort);
      resolve(answer);
    }, { once: true });
    update(); place();
    if (desktop.matches) input.focus({ preventScroll: true });
    else { node.tabIndex = -1; node.focus({ preventScroll: true }); }
  });
}
