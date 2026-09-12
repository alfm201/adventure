export class Forecast {
  clear() { this.key = undefined; this.value = undefined; this.previous = undefined; }
  update(state, result) {
    const model = result.model || result.profile?.model;
    if (!["vela", "x36"].includes(model) || result.status === "disabled") {
      this.clear();
      return {};
    }
    if (model !== this.model) { this.clear(); this.model = model; }
    const key = JSON.stringify([state.position, state.diceUsed, state.bonusRoll, state.hand, state.deckAvailable]);
    if (key !== this.key) {
      this.previous = this.value;
      this.value = undefined;
      this.key = key;
    }
    const terminal = state.diceUsed >= 100 && !state.bonusRoll;
    const complete = terminal || result.status === "complete" || (model === "x36" && result.status === "running");
    const score = terminal ? state.position : result.expectedFinalScore;
    if (complete && Number.isFinite(score)) {
      this.value = Math.round(score);
      return { value: this.value, delta: this.previous === undefined ? 0 : this.value - this.previous, terminal };
    }
    return { pending: result.status === "running", terminal };
  }
}
