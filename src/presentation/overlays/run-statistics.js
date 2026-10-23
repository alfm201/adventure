import { canOpenDialog, dialog } from "./dialogs.js";
import { translate, numberLocale } from "../../localization/index.js";
import { createRunChart } from "../components/run-chart.js";

const t = (text, ...values) => values.reduce((s, value, i) => s.replaceAll(`{${i}}`, value), translate(text));
const fmt = n => n.toLocaleString(numberLocale());
const element = (tag, className, text) => {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function showRunStatistics(run, fresh = true) {
  const body = element("div", "run-body");
  const hints = [];
  const row = element("div", "run-score-row"), block = element("div", "run-score-block");
  block.append(element("div", "run-label", t("최종 점수")));
  const score = element("div", "run-score"), value = element("span", "run-score-value");
  const actual = element("span", "run-score-actual", fmt(run.finalScore));
  const counter = element("span", "run-score-counter"); counter.setAttribute("aria-hidden", "true"); counter.hidden = true;
  value.append(actual, counter); score.append(value, element("small", "", t("점"))); block.append(score);
  const coverage = element("div", `run-coverage${run.partial ? " partial" : ""}`);
  coverage.append(element("strong", "", t(run.terminalOnly ? "종료 시점부터 기록" : run.partial ? "주사위 {0}회부터 기록" : "처음부터 함께한 판", fmt(run.startPaid))), document.createElement("br"),
    document.createTextNode(t(run.gaps || run.truncated ? "일부 구간의 기록이 없습니다" : run.partial && !run.terminalOnly ? "시작 이전의 기록은 없습니다" : "주사위 {0}회 사용", fmt(run.lastState.diceUsed))));
  row.append(block, coverage); body.append(row);
  if (!run.terminalOnly) {
    const metrics = element("dl", "run-metrics");
    for (const [label, count, unit, hint] of [[run.partial ? "확인한 행동" : "행동", run.actions, "회"], ["카드 획득", run.acquired, "장", "실제로 손패에 들어온 카드"], ["획득 불가", run.missed, "장", "손패가 5장이라 받지 못한 카드"]]) {
      const metric = element("div", "run-metric"), amount = element("dd", "", fmt(count));
      const term = element('dt', '', t(label));
      if (hint) {
        const button = element('button', 'run-metric-hint', 'ⓘ'); button.type = 'button';
        button.setAttribute('aria-label', t(label)); term.append(button); hints.push({button, text:t(hint)});
      }
      amount.append(element("span", "", t(unit))); metric.append(term, amount); metrics.append(metric);
    }
    body.append(metrics);
  }
  let chart;
  if (run.points.length) { chart = createRunChart(run); body.append(chart.node); }
  else {
    const empty = element("div", "run-empty");
    empty.append(element("strong", "", t(run.terminalOnly ? "이번 판의 진행 기록이 없습니다" : "예측 기록이 없습니다")),
      element("p", "", t(run.terminalOnly ? "다음 판부터 함께 기록할 수 있습니다." : "행동 추천 모델을 사용한 구간의 예측이 여기에 표시됩니다.")));
    body.append(empty);
  }
  chart?.setBusy(true);
  const modal = dialog(t("이번 판 결과"), body, { className: "run-statistics", closeOnOutside: false });
  chart?.attach(modal);
  const hint = element('div', 'run-tooltip run-metric-tooltip'); hint.role = 'tooltip'; hint.id = `run-metric-tip-${run.id}`; hint.hidden = true; modal.append(hint);
  let activeHint;
  const hideHint = () => { hint.hidden = true; activeHint?.removeAttribute('aria-describedby'); activeHint = null; };
  const showHint = ({button, text}) => {
    hideHint(); activeHint = button; hint.textContent = text; hint.hidden = false; button.setAttribute('aria-describedby', hint.id);
    const r = button.getBoundingClientRect(), box = hint.getBoundingClientRect();
    hint.style.left = `${Math.max(10, Math.min(innerWidth - box.width - 10, r.left + r.width / 2 - box.width / 2))}px`;
    hint.style.top = `${r.top > box.height + 14 ? r.top - box.height - 8 : r.bottom + 8}px`;
  };
  for (const item of hints) {
    item.button.onpointerenter = event => { if (event.pointerType !== 'touch') showHint(item); };
    item.button.onpointerleave = event => { if (event.pointerType !== 'touch') hideHint(); };
    item.button.onfocus = () => showHint(item); item.button.onblur = hideHint;
    item.button.onclick = () => showHint(item);
  }
  const outsideHint = event => { if (!hints.some(item => item.button.contains(event.target))) hideHint(); };
  document.addEventListener('pointerdown', outsideHint, true);
  modal.querySelector('.dialog-close').focus({preventScroll:true});
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, closed = false;
  const finish = () => {
    cancelAnimationFrame(frame); frame = 0;
    modal.classList.remove("run-entering", "run-counting", "run-opening");
    counter.hidden = true; chart?.reveal(1); chart?.setBusy(false);
  };
  if (!motion.matches && !document.hidden) {
    modal.classList.add("run-opening");
    if (fresh) { modal.classList.add("run-entering", "run-counting"); counter.hidden = false; counter.textContent = "0"; chart?.reveal(0); }
    const start = performance.now();
    const animate = now => {
      if (closed) return;
      const elapsed = now - start;
      if (fresh) {
        const p = Math.max(0, Math.min(1, (elapsed - 140) / 1000));
        counter.textContent = fmt(Math.round(run.finalScore * (p === 1 ? 1 : 1 - 2 ** (-10 * p))));
        if (p === 1) { counter.hidden = true; modal.classList.remove("run-counting"); }
        chart?.reveal(Math.max(0, Math.min(1, (elapsed - 900) / 1000)));
      }
      if (elapsed >= (fresh ? 2040 : 200)) finish();
      else frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  } else finish();
  const settle = () => { finish(); chart?.hide(); hideHint(); };
  const visibility = () => { if (document.hidden) settle(); };
  addEventListener("resize", settle); addEventListener("scroll", settle, true);
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", settle);
  modal.addEventListener('closing', () => { closed = true; cancelAnimationFrame(frame); chart?.hide(); hideHint(); });
  modal.addEventListener("close", () => {
    closed = true; finish(); chart?.dispose();
    removeEventListener("resize", settle); removeEventListener("scroll", settle, true);
    document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", settle);
    document.removeEventListener('pointerdown', outsideHint, true);
  }, { once: true });
  return modal;
}

export function bindRunStatistics(statistics) {
  const panel = element("section", "run-end-notice");
  const summary = element("div", "run-end-summary");
  const badge = element("span", "run-end-badge"); badge.setAttribute("aria-hidden", "true");
  badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>';
  const message = element("p", "run-end-message", t("게임 종료"));
  const label = element("div", "run-end-label", t("최종 점수")); label.setAttribute("aria-hidden", "true");
  const score = element("div", "run-end-score"), value = element("strong", ""), unit = element("span", "", t("점"));
  score.append(value, unit); summary.append(badge, message, label, score);
  const button = element("button", "run-result-open"), buttonText = element("span", "", t("이번 판 결과"));
  const arrow = element("span", "run-result-arrow"); arrow.setAttribute("aria-hidden", "true");
  arrow.innerHTML = '<svg viewBox="0 0 20 20"><path d="M8 5l5 5-5 5"/></svg>';
  button.append(buttonText, arrow);
  button.type = "button"; panel.hidden = true; panel.append(summary, button);
  document.querySelector('#frame').append(panel);
  let modal, shownId, disposed = false;
  const open = () => {
    const run = statistics.run;
    if (!run?.finished || modal?.open || !canOpenDialog() || document.hidden) return;
    const fresh = shownId !== run.id;
    shownId = run.id; modal = showRunStatistics(run, fresh);
    panel.hidden = true;
    const opened = modal;
    modal.addEventListener("close", () => { if (modal === opened) modal = null; }, { once: true });
  };
  const update = () => {
    if (disposed) return;
    const run = statistics.run;
    if (modal?.open && (!run?.finished || shownId !== run.id)) modal.close();
    buttonText.textContent = t("이번 판 결과");
    message.textContent = t("게임 종료");
    label.textContent = t("최종 점수");
    value.textContent = run?.finished ? fmt(run.finalScore) : "";
    unit.textContent = t("점");
    score.setAttribute('aria-label', t("최종 점수") + ' ' + value.textContent + unit.textContent);
    if (run?.finished && shownId !== run.id) open();
    panel.hidden = !run?.finished || !!modal?.open;
  };
  const afterDialog = () => queueMicrotask(update);
  const language = () => {
    if (modal?.open) { modal.addEventListener('close', () => { update(); open(); }, {once:true}); modal.close(); }
    else update();
  };
  button.onclick = open;
  statistics.addEventListener("change", update);
  document.addEventListener("close", afterDialog, true);
  document.addEventListener("visibilitychange", update);
  addEventListener("adventurelanguagechange", language);
  update();
  return () => {
    disposed = true; modal?.close(); panel.remove();
    statistics.removeEventListener("change", update);
    document.removeEventListener("close", afterDialog, true);
    document.removeEventListener("visibilitychange", update);
    removeEventListener("adventurelanguagechange", language);
  };
}
