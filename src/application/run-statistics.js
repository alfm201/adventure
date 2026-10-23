import { FULL_DECK, HAND_LIMIT, tiles } from "../rules/index.js";

const terminal = s => s.diceUsed >= 100 && !s.bonusRoll;
const initial = s => s.position === 1 && s.diceUsed === 0 && !s.bonusRoll && !s.hand.length && s.deckAvailable === FULL_DECK;
const key = s => JSON.stringify([s.position, s.diceUsed, s.bonusRoll, s.hand, s.deckAvailable]);
const copy = s => ({ ...s, hand: [...s.hand] });
const LIMIT = 4096;

export class RunStatistics extends EventTarget {
  constructor(session, coordinator, assist) {
    super();
    this.session = session;
    this.coordinator = coordinator;
    this.assist = assist;
    this.serial = 0;
    this.run = null;
    this.disconnected = false;
    this.onSession = event => this.observe(event.detail);
    this.onPrediction = () => {
      const result = coordinator.result;
      queueMicrotask(() => { if (!this.disposed) this.recordPrediction(result); });
    };
    this.onDisconnect = () => { this.disconnected = true; };
    session.addEventListener("change", this.onSession);
    coordinator.addEventListener("change", this.onPrediction);
    assist?.addEventListener("capture-end", this.onDisconnect);
    if (session.mode === "automatic") this.start(session.state);
  }
  changed() { this.dispatchEvent(new Event("change")); }
  start(state) {
    this.run = {
      id: ++this.serial, mode: this.session.mode, startPaid: state.diceUsed,
      partial: !initial(state), terminalOnly: terminal(state), gaps: 0,
      actions: 0, acquired: 0, missed: 0, used: 0, rows: [], points: [],
      segment: 0, rowSerial: 0, lastState: copy(state), finished: false,
    };
    this.row(state, { kind: "start" });
    this.finish(state);
  }
  row(state, action) {
    const r = this.run;
    const row = { id: ++r.rowSerial, step: r.actions, paid: state.diceUsed,
      position: state.position, action, segment: r.segment };
    r.rows.push(row);
    r.lastState = copy(state);
    if (r.rows.length > LIMIT) {
      r.rows.splice(0, LIMIT / 4);
      const first = r.rows[0].id;
      r.points = r.points.filter(p => p.rowId >= first);
      r.partial = true; r.truncated = true;
    }
    return row;
  }
  step(state, action) {
    const r = this.run, before = r.lastState;
    const used = action.kind === "card" || action.kind === "multiplier";
    const slot = action.slot;
    r.actions++;
    r.used += Number(used);
    const acquired = Math.max(0, Math.min(1, state.hand.length - before.hand.length + Number(used)));
    r.acquired += acquired;
    if (!acquired && state.hand.length === HAND_LIMIT && tiles[state.position - 1].event === 2) r.missed++;
    this.row(state, { kind: action.kind, cardId: used ? before.hand[slot - 1] : undefined });
  }
  gap(state) {
    const r = this.run;
    r.partial = true; r.gaps++; r.segment++;
    this.row(state, { kind: "gap" });
  }
  finish(state) {
    if (terminal(state)) { this.run.finished = true; this.run.finalScore = state.position; }
  }
  observe(detail = {}) {
    const { session } = this, state = session.state;
    if (detail.type === "mode") {
      this.run = null; this.disconnected = false;
      if (session.mode === "automatic") this.start(state);
      this.changed(); return;
    }
    if (session.mode === "manual") return;
    if (session.mode === "automatic") {
      if (detail.type === "reset") this.start(state);
      else if (["roll", "card"].includes(detail.type) && !detail.before?.terminal) {
        if (!this.run) this.start(detail.before?.state ?? state);
        const slot = typeof detail.value === "number" ? detail.value : detail.value?.slot;
        this.step(state, { kind: detail.type, slot });
        this.finish(state);
      } else if (this.run && key(state) !== key(this.run.lastState)) {
        if (this.run.finished) this.start(state);
        else { this.gap(state); this.finish(state); }
      }
      this.changed(); return;
    }
    if (!detail.ready || !state) return;
    const old = this.run, same = old && key(state) === key(old.lastState);
    const fresh = initial(state) && old && (detail.newGame || !initial(old.lastState));
    const restart = old && (old.finished && !terminal(state) || state.diceUsed < old.lastState.diceUsed);
    if (!old || fresh || restart || this.disconnected && !(old.finished && same)) this.start(state);
    else if (!old.finished) {
      const trace = detail.statistics;
      if (trace?.complete && trace.steps.length) {
        for (const step of trace.steps) this.step(step.state, step.action);
        if (key(this.run.lastState) !== key(state)) this.gap(state);
      } else if (!same || trace?.complete === false) this.gap(state);
      this.finish(state);
    }
    this.disconnected = false;
    this.changed();
  }
  recordPrediction(result) {
    const r = this.run, { session, coordinator } = this;
    if (!r || r.finished || !session.canRecommend || session.mode !== r.mode ||
        result.requestId !== coordinator.requestId || result.revision !== session.revision ||
        !["ready", "complete", "running"].includes(result.status) ||
        !Number.isFinite(result.expectedFinalScore)) return;
    const family = result.model ?? result.profile?.model;
    if (!["vela", "lyra", "x36"].includes(family)) return;
    const modelKey = `${family}:${result.policyVersion ?? result.modelVersion ?? ""}`;
    const modelName = family.toUpperCase();
    const row = r.rows.at(-1), value = Math.round(result.expectedFinalScore);
    const previous = r.points.at(-1);
    if (previous?.rowId === row.id && previous.modelKey === modelKey) { if (previous.value === value) return; previous.value = value; }
    else r.points.push({ ...row, rowId: row.id, family, modelKey, modelName, value });
    if (r.points.length > LIMIT * 2) { r.points.splice(0, LIMIT / 2); r.truncated = true; }
    this.changed();
  }
  dispose() {
    this.disposed = true;
    this.session.removeEventListener("change", this.onSession);
    this.coordinator.removeEventListener("change", this.onPrediction);
    this.assist?.removeEventListener("capture-end", this.onDisconnect);
    this.run = null;
  }
}
