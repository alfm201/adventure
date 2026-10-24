import { translate, numberLocale } from "../../localization/index.js";
import { cardLabels } from "../../content/cards.js";

const t = (text, ...values) => values.reduce((s, value, i) => s.replaceAll(`{${i}}`, value), translate(text));
const fmt = n => n.toLocaleString(numberLocale());
const colors = { vela: "#247f78", x36: "#b76c35", lyra: "#7c67aa" };
let sequence = 0;
const el = (tag, cls, text) => {
  const node = document.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createRunChart(run) {
  const points = run.points, models = [...new Map(points.map(p => [p.modelKey, p])).values()];
  const id = `run-chart-${++sequence}`, node = el("section", "run-chart-section");
  const title = el("div", "run-chart-title"), legend = el("div", "run-legend");
  title.append(el("h3", "", t("최종 점수 예측 추이")), legend); node.append(title);
  for (const model of models) {
    const label = el("span", "", model.modelName), swatch = el("i", "");
    swatch.style.background = colors[model.family]; label.prepend(swatch); legend.append(label);
  }
  const chart = svgNode("svg", { viewBox: "0 0 540 236", class: "run-chart", role: "group", tabindex: "-1", "aria-label": t("최종 점수 예측 추이. 좌우 방향키로 기록을 살펴볼 수 있습니다.") });
  const defs = svgNode("defs"), clip = svgNode("clipPath", { id: `${id}-clip` });
  const revealRect = svgNode("rect", { x: 58, y: 20, width: 464, height: 174 }); clip.append(revealRect); defs.append(clip);
  for (const [family, color] of Object.entries(colors)) {
    const gradient = svgNode("linearGradient", { id: `${id}-${family}`, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: 26, y2: 187 });
    gradient.append(svgNode("stop", { offset: "0%", "stop-color": color, "stop-opacity": .22 }), svgNode("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 })); defs.append(gradient);
  }
  chart.append(defs); node.append(chart);
  const gapSteps = [...new Set(run.rows.filter(r => r.action.kind === "gap").map(r => r.step))].sort((a, b) => a - b);
  const gapLabels = gapSteps.length ? el("div", "run-gap-labels") : null;
  if (gapLabels) { gapLabels.setAttribute("role", "note"); gapLabels.setAttribute("aria-label", t("기록 공백")); chart.before(gapLabels); }
  const values = [...points.map(p => p.value), run.finalScore], low = Math.min(...values), high = Math.max(...values);
  const span = Math.max(100, high - low), min = Math.floor((low - span * .16) / 25) * 25;
  const max = Math.ceil((high + span * .16) / 25) * 25;
  const maxStep = Math.max(1, run.actions), x = step => 58 + step / maxStep * 464;
  let gapWidth = -1, gapObserver;
  const layoutGaps = () => {
    if (!gapLabels || !gapLabels.clientWidth || gapLabels.clientWidth === gapWidth) return;
    gapWidth = gapLabels.clientWidth;
    const sample = el("span", "run-gap-label", t("기록 공백")); gapLabels.replaceChildren(sample);
    const labelWidth = sample.getBoundingClientRect().width, half = labelWidth / 2;
    const clamp = center => Math.max(half, Math.min(gapWidth - half, center));
    const groups = [];
    for (const step of gapSteps) {
      const position = x(step) / 540 * gapWidth, previous = groups.at(-1);
      if (previous && clamp(position) - previous.center < labelWidth + 8) {
        previous.center = clamp((previous.first + position) / 2);
      } else groups.push({ first: position, center: clamp(position) });
    }
    gapLabels.replaceChildren(...groups.map(group => {
      const label = el("span", "run-gap-label", t("기록 공백"));
      label.style.left = `${group.center}px`; label.setAttribute("aria-hidden", "true"); return label;
    }));
  };
  const y = value => 187 - (value - min) / (max - min) * 161;
  for (let i = 0; i <= 2; i++) {
    const value = Math.round(min + (max - min) * i / 2);
    chart.append(svgNode("line", { x1: 58, x2: 522, y1: y(value), y2: y(value), class: "run-grid" }));
    if (Math.abs(y(value) - y(run.finalScore)) >= 22)
      chart.append(svgNode("text", { x: 50, y: y(value) + 4, "text-anchor": "end", class: "run-axis run-y-axis" }, fmt(value)));
  }
  const series = svgNode("g", { "clip-path": `url(#${id}-clip)` }); chart.append(series);
  let groups = [], group;
  for (const p of points) {
    const previous = group?.at(-1);
    if (!previous || previous.modelKey !== p.modelKey || previous.segment !== p.segment || p.rowId > previous.rowId + 1) groups.push(group = []);
    group.push(p);
  }
  for (const rows of groups) {
    const first = rows[0], last = rows.at(-1), color = colors[first.family];
    const path = rows.map((p, i) => `${i ? "L" : "M"}${x(p.step)},${y(p.value)}`).join(" ");
    if (rows.length > 1) series.append(svgNode("path", { d: `${path} L${x(last.step)},187 L${x(first.step)},187 Z`, fill: `url(#${id}-${first.family})` }),
      svgNode("path", { d: path, stroke: color, class: "run-curve" }));
    else series.append(svgNode("circle", { cx: x(first.step), cy: y(first.value), r: 2, fill: color }));
  }
  const switches = points.filter((p, i) => i && p.modelKey !== points[i - 1].modelKey);
  for (const p of switches) chart.append(svgNode("line", { x1: x(p.step), x2: x(p.step), y1: 22, y2: 187, class: "run-switch" }));
  for (const row of run.rows.filter(r => r.action.kind === "gap")) chart.append(svgNode("rect", { x: x(row.step) - 3, y: 26, width: 6, height: 161, fill: "#b59b68", opacity: .15, class: "run-gap-marker" }));
  chart.append(svgNode("line", { x1: 58, x2: 522, y1: y(run.finalScore), y2: y(run.finalScore), class: "run-final" }),
    svgNode("circle", { cx: x(run.actions), cy: y(run.finalScore), r: 3, fill: "#748b7e" }));
  const finalTick = svgNode("g", { class: "run-final-tick", "aria-label": t("실제 최종 점수") + ' ' + fmt(run.finalScore) });
  finalTick.append(svgNode("rect", { x: 0, y: y(run.finalScore) - 18, width: 55, height: 36, fill: "transparent" }),
    svgNode("text", { x: 50, y: y(run.finalScore) + 4, "text-anchor": "end", class: "run-final-label" }, fmt(run.finalScore)));
  chart.append(finalTick);
  for (const step of new Set(Array.from({ length: 5 }, (_, i) => Math.round(run.actions * i / 4)))) chart.append(svgNode("text", { x: x(step), y: 208, "text-anchor": "middle", class: "run-axis" }, fmt(step)));
  chart.append(svgNode("text", { x: 522, y: 232, "text-anchor": "end", class: "run-axis" }, t(run.partial ? "확인한 행동 수" : "행동 수")));
  const cursor = svgNode("g", { visibility: "hidden", "pointer-events": "none" });
  const line = svgNode("line", { y1: 26, y2: 187, class: "run-selected-line" }), dot = svgNode("circle", { r: 3.5, stroke: "white", "stroke-width": 1.5 });
  cursor.append(line, dot); chart.append(cursor);
  const filter = el("label", "run-range-filter", t("최고·최저 기준")), select = document.createElement("select");
  select.setAttribute("aria-label", t("최고·최저 기준"));
  for (const model of models) select.append(new Option(model.modelName, model.modelKey));
  select.value = models.at(-1).modelKey; filter.append(select); filter.hidden = models.length < 2; node.append(filter);
  const extrema = el("div", "run-extrema"), buttons = [];
  let highest, lowest, busy = true, selected = -1, touchStart;
  for (const label of ["최고 예측", "최저 예측"]) { const button = el("button", ""); button.type = "button"; button.append(el("span", "run-extrema-label", t(label)), el("strong", ""), el("span", "run-extrema-step")); buttons.push(button); extrema.append(button); }
  node.append(extrema);
  const note = el("p", "run-footnote", t("당시 선택한 모델을 계속 따를 때의 예상입니다. 종료 시 실제 점수는 예측 기록에서 제외했습니다."));
  if (run.partial) note.append(document.createElement("br"), document.createTextNode(t("행동과 카드는 확인한 구간만 집계합니다. 기록 공백 전후의 선은 연결하지 않습니다.")));
  if (models.length > 1) note.append(document.createElement("br"), document.createTextNode(t("최고·최저는 모델별로 확인합니다.")));
  node.append(note);
  const tooltip = el("div", "run-tooltip run-chart-tooltip"); tooltip.id = `${id}-tooltip`; tooltip.role = "tooltip"; tooltip.hidden = true;
  const hide = () => { selected = -1; tooltip.hidden = true; cursor.setAttribute("visibility", "hidden"); chart.removeAttribute("aria-describedby"); buttons.forEach(b => b.setAttribute("aria-pressed", "false")); };
  const pointTitle = p => p.step === 0 ? t("기록 시작") : t("{0}번째 행동 후", fmt(p.step));
  const placeTooltip = anchor => {
    tooltip.hidden = false; chart.setAttribute("aria-describedby", tooltip.id);
    const view = window.visualViewport, left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0, width = view?.width ?? innerWidth, height = view?.height ?? innerHeight;
    tooltip.style.maxWidth = `${width - 20}px`; tooltip.style.maxHeight = `${height - 20}px`;
    const size = tooltip.getBoundingClientRect(); let tx = anchor.x + 16, ty = anchor.y - size.height - 16;
    if (tx + size.width > left + width - 10) tx = anchor.x - size.width - 16;
    if (ty < top + 10) ty = anchor.y + 16;
    tooltip.style.left = `${Math.max(left + 10, Math.min(tx, left + width - size.width - 10))}px`;
    tooltip.style.top = `${Math.max(top + 10, Math.min(ty, top + height - size.height - 10))}px`;
  };
  const showFinal = () => {
    if (busy) return;
    hide(); tooltip.replaceChildren(el("strong", "", t("실제 최종 점수")), el("div", "run-tip-context", t("{0}점", fmt(run.finalScore))));
    const box = finalTick.getBoundingClientRect(); placeTooltip({ x: box.right, y: box.top });
  };
  const show = (index, anchor) => {
    if (busy) return;
    selected = Math.max(0, Math.min(points.length - 1, index)); const p = points[selected];
    line.setAttribute("x1", x(p.step)); line.setAttribute("x2", x(p.step)); dot.setAttribute("cx", x(p.step)); dot.setAttribute("cy", y(p.value)); dot.setAttribute("fill", colors[p.family]); cursor.setAttribute("visibility", "visible");
    tooltip.replaceChildren(el("strong", "", pointTitle(p)));
    const peers = points.filter(other => other.rowId === p.rowId);
    tooltip.append(el("div", "run-tip-context", t(peers.length > 1 ? "모델 변경" : "예상 최종 점수")));
    for (const other of peers) {
      const row = el("div", "run-tip-row"), dot = el("i", ""); dot.style.background = colors[other.family];
      row.append(dot, el("span", "", other.modelName), el("b", "", t("{0}점", fmt(other.value)))); tooltip.append(row);
    }
    const action = p.action.cardId ? t("{0} 카드 사용", translate(cardLabels[p.action.cardId - 1])) : t(p.action.kind === "roll" ? "주사위 굴리기" : p.action.kind === "gap" ? "기록 공백 이후" : "기록 시작");
    tooltip.append(el("div", "run-tip-detail", t("주사위 {0}회 사용 · {1}", fmt(p.paid), action)));
    const box = chart.getBoundingClientRect(); anchor ??= { x: box.left + x(p.step) / 540 * box.width, y: box.top + y(p.value) / 236 * box.height };
    placeTooltip(anchor);
    buttons[0].setAttribute("aria-pressed", String(p === highest)); buttons[1].setAttribute("aria-pressed", String(p === lowest));
  };
  const updateExtrema = () => {
    const pool = points.filter(p => p.modelKey === select.value);
    highest = pool.reduce((a, b) => a.value >= b.value ? a : b); lowest = pool.reduce((a, b) => a.value <= b.value ? a : b);
    [highest, lowest].forEach((p, i) => { buttons[i].querySelector("strong").textContent = t("{0}점", fmt(p.value)); buttons[i].lastChild.textContent = pointTitle(p); });
  };
  updateExtrema(); select.onchange = () => { hide(); updateExtrema(); };
  buttons[0].onclick = () => show(points.indexOf(highest)); buttons[1].onclick = () => show(points.indexOf(lowest));
  const closest = event => {
    const box = chart.getBoundingClientRect(), px = (event.clientX - box.left) / box.width * 540, py = (event.clientY - box.top) / box.height * 236;
    let best = 0;
    for (let i = 1; i < points.length; i++) { const a = Math.abs(x(points[i].step) - px), b = Math.abs(x(points[best].step) - px); if (a < b - .001 || Math.abs(a - b) < .001 && Math.abs(y(points[i].value) - py) < Math.abs(y(points[best].value) - py)) best = i; }
    return best;
  };
  chart.addEventListener("pointermove", event => { if (event.pointerType === "mouse" || event.pointerType === "pen" && !event.buttons) {
    if (finalTick.contains(event.target)) showFinal();
    else show(closest(event), { x: event.clientX, y: event.clientY });
  } });
  chart.addEventListener("pointerleave", event => { if (event.pointerType !== "touch") hide(); });
  chart.addEventListener("pointerdown", event => { touchStart = busy ? null : { x: event.clientX, y: event.clientY, id: event.pointerId }; });
  chart.addEventListener("pointerup", event => { const start = touchStart; touchStart = null; if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) {
    if (finalTick.contains(event.target)) showFinal();
    else show(closest(event), event.pointerType === "mouse" ? { x: event.clientX, y: event.clientY } : undefined);
  } });
  chart.addEventListener("pointercancel", () => { touchStart = null; hide(); });
  chart.addEventListener("keydown", event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); show(event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : selected < 0 ? 0 : selected + (event.key === "ArrowRight" ? 1 : -1)); });
  chart.addEventListener("blur", hide);
  const outside = event => { if (!chart.contains(event.target) && !extrema.contains(event.target)) hide(); };
  document.addEventListener("pointerdown", outside);
  return { node, hide,
    attach: modal => {
      modal.append(tooltip);
      if (gapLabels) {
        layoutGaps();
        if (typeof ResizeObserver === "function") { gapObserver = new ResizeObserver(layoutGaps); gapObserver.observe(gapLabels); }
        else addEventListener("resize", layoutGaps);
      }
    },
    reveal: progress => revealRect.setAttribute("width", progress * 464),
    setBusy(value) { busy = value; chart.setAttribute("aria-disabled", String(value)); chart.setAttribute("tabindex", value ? "-1" : "0"); select.disabled = value; buttons.forEach(b => b.disabled = value); if (value) hide(); },
    dispose() { gapObserver?.disconnect(); removeEventListener("resize", layoutGaps); tooltip.remove(); document.removeEventListener("pointerdown", outside); },
  };
}
