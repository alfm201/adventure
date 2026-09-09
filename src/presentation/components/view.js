import { tiles } from "../../rules/index.js";
import { stageNames } from "../../content/board-layout.js";
import { cardLabels, cardIcons } from "../../content/cards.js";
export const number = (n, digits = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("ko-KR", { maximumFractionDigits: digits })
    : "—";
export class GameView {
  constructor(assets) {
    this.assets = assets;
    this.rows = [];
    this.hand = [];
    this.info = [];
    this.tableRows = [];
    for (let a = 0; a < 6; a++) {
      const b = document.createElement("button");
      b.className = "estimate-row";
      b.dataset.action = a;
      b.textContent = (a ? `${a}번카드` : "주사위") + ": —";
      document.querySelector("#estimates").append(b);
      this.rows.push(b);
      const row = document.createElement("tr");
      for (let i = 0; i < 7; i++) row.append(document.createElement("td"));
      document.querySelector("#overview-body").append(row);
      this.tableRows.push(row);
    }
    for (let a = 1; a <= 5; a++) {
      const b = document.createElement("button");
      b.className = "hand-button";
      b.dataset.slot = a;
      b.innerHTML = '<span class="card-sprite" hidden></span><span class="card-fallback" hidden></span>';
      document.querySelector("#hand").append(b);
      this.hand.push(b);
    }
    for (let id = 1; id <= 30; id++) {
      const b = document.createElement("button");
      b.className = "card-info-row";
      b.dataset.card = id;
      document.querySelector("#card-info-list").append(b);
      this.info.push(b);
    }
    for (let sum = 2; sum <= 12; sum++) {
      const b = document.createElement("button");
      b.textContent = "+" + sum;
      b.dataset.sum = sum;
      b.setAttribute("aria-label", `${sum}칸 직접 이동`);
      document.querySelector("#dice-buttons").append(b);
    }
  }
  render(session, result) {
    const s = session.state,
      t = tiles[s.position - 1],
      automatic = session.mode === "automatic",
      disabled = result.status === "disabled",
      vela = result.model === "vela" || result.profile?.model === "vela";
    const text = (id, value) =>
      (document.getElementById(id).textContent = value);
    text("settings-button", disabled ? "모델 선택" : vela ? "행동별 평가" : "예상 점수");
    document.querySelector("#settings-button").dataset.model = vela ? "vela" : "x36";
    const overview = document.querySelector("#score-overview");
    document.querySelector("#compare-button").disabled = disabled;
    overview.classList.toggle("vela-overview", vela);
    overview.setAttribute("aria-label", vela ? "행동별 평가 비교" : "예상 점수 전체 비교");
    overview.querySelector("header strong").textContent = vela ? "행동별 평가" : "예상 점수 전체 비교";
    overview.querySelector(".legend").innerHTML = vela
      ? "<b class=recommended>추천</b>: 평가가 가장 높은 선택. 값이 클수록 유리하며, 최종 점수 예측은 아닙니다."
      : "<b class=recommended>추천</b>: 현재 평균이 가장 높은 선택 · <b class=near>근접</b>: 차이가 작아 우열이 애매한 선택 · <b class=candidate>후보</b>: 아직 제외되지 않은 선택";
    text("position", s.position);
    text("stage-name", `${t.stage}.${stageNames[t.stage - 1]}`);
    text("stage-position", t.ordinal);
    text("dice-used", s.diceUsed);
    text("remaining", 100 - s.diceUsed);
    text("high-score", session.highScore + " 칸");
    text(
      "board-description",
      `${stageNames[t.stage - 1]}, 현재 ${s.position}칸, 스테이지 ${t.ordinal}번째 칸, 주사위 ${s.diceUsed}회 사용. ${automatic ? "자동" : "수동"} 모드.`,
    );
    const roll = document.querySelector("#roll-button");
    roll.classList.toggle("is-double", s.bonusRoll);
    roll.setAttribute(
      "aria-label",
      automatic
        ? "주사위 굴리기"
        : `더블 여부 변경 (${s.bonusRoll ? "더블" : "일반"})`,
    );
    roll.disabled = automatic && session.terminal;
    document
      .querySelector("#mode-button")
      .setAttribute(
        "aria-label",
        `모드변경 (현재 ${automatic ? "자동" : "수동"})`,
      );
    document
      .querySelectorAll("[data-sum]")
      .forEach((b) => (b.disabled = automatic || session.terminal));
    this.hand.forEach((b, i) => {
      const id = s.hand[i],
        icon = b.firstElementChild;
      b.setAttribute(
        "aria-label",
        id
          ? `${i + 1}번 카드: ${cardLabels[id - 1]}`
          : `${i + 1}번 빈 카드 슬롯: 카드 획득`,
      );
      const imageReady = !this.assets || !!this.assets.get(78);
      icon.hidden = !id || !imageReady;
      b.lastElementChild.hidden = !id || imageReady;
      b.lastElementChild.textContent = id ? cardLabels[id - 1].replace("앞으로 ", "+").replace("뒤로 ", "−").replace("칸 이동", "").replace("주사위 ", "").replace(/!+/g, "").replace("다음 스테이지 첫번째 칸으로 이동", "NEXT").trim() : "";
      b.dataset.cardId = id || "";
      if (id) {
        const index = cardIcons[id - 1];
        icon.style.backgroundPosition = `-${(index % 31) * 33}px -${Math.floor(index / 31) * 33 + 921}px`;
      }
    });
    this.info.forEach((b, i) => {
      const obtained = !(s.deckAvailable & (1 << i));
      b.classList.toggle("obtained", obtained);
      b.textContent = (obtained ? "✔ " : "■ ") + cardLabels[i];
      b.setAttribute("aria-pressed", String(obtained));
    });
    const statusLabels = {
      recommended: "추천",
      active: "후보",
      pruned: "제외",
      pending: "계산중",
      terminal: "종료",
      evaluated: "비교",
    };
    this.rows.forEach((b, a) => {
      const available = a === 0 || a <= s.hand.length,
        r = result.actions?.[a],
        score = vela ? r?.value : r?.mean;
      let value = disabled ? "—" : !available
        ? (vela ? "—" : "0.000점")
        : result.status === "error"
          ? "오류"
          : score !== null && score !== undefined
            ? score.toFixed(3) + (vela ? "" : "점")
            : result.status === "running"
              ? "계산중..."
              : "—";
      b.textContent = (a ? `${a}번카드` : "주사위") + ": " + value;
      b.classList.toggle("is-near", !!r?.near || (vela && result.recommended?.includes(a)));
      b.setAttribute("aria-label", `${b.textContent}, ${disabled ? "모델 선택" : "다시 계산"}`);
      const row = this.tableRows[a],
        recommended = result.recommended?.includes(a),
        near = r?.near && !recommended;
      row.className = recommended ? "recommended" : near ? "near" : "";
      row.dataset.available = String(available);
      const center = vela ? r?.value : result.profile?.engine === "cpu" ? r?.median : r?.mean;
      const status = !available
        ? "비어 있음"
        : result.status === "error"
          ? "오류"
          : recommended
            ? "추천"
            : near
              ? "근접"
              : statusLabels[r?.status] ||
                (result.status === "running" ? "계산중" : "—");
      const values = [
        a
          ? `${a}번 카드${s.hand[a - 1] ? " · " + cardLabels[s.hand[a - 1] - 1] : ""}`
          : "주사위",
        available ? number(center, vela ? 3 : 0) : "—",
        available && r?.count
          ? `${number(r.min, 0)} ~ ${number(r.max, 0)}`
          : "—",
        available && r?.ci
          ? `${number(r.ci[0], 0)} ~ ${number(r.ci[1], 0)}`
          : "—",
        available ? number(r?.count, 0) : "—",
        available ? number(r?.gap) : "—",
        status,
      ];
      const labels = ["행동", vela ? "평가값" : result.profile?.engine === "cpu" ? "중앙값" : "평균", "범위", "95% CI", "샘플", "추천차", "상태"];
      values.forEach((v, i) => { row.children[i].textContent = v; row.children[i].dataset.label = labels[i]; });
    });
    text("center-label", vela ? "평가값" : result.profile?.engine === "cpu" ? "중앙값" : "평균");
    text(
      "evaluation-detail",
      result.status === "error"
        ? result.message
        : result.elapsedMs !== undefined
          ? vela ? `${result.modelName} · ${number(result.elapsedMs / 1000, 3)}초` : `${result.profile?.engine.toUpperCase()} · G3 · ${number(result.elapsedMs / 1000, 2)}초 · 실제 ${number(result.totalSamples, 0)}회${result.status === "running" ? " · 계산중" : ""}`
          : "",
    );
  }
}
