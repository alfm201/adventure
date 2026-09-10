export class Forecast {
  clear() { this.key = undefined; this.value = undefined; this.previous = undefined; }
  update(state, result) {
    if (result.model !== "vela" && result.profile?.model !== "vela") {
      this.clear();
      return {};
    }
    const key = JSON.stringify([state.position, state.diceUsed, state.bonusRoll, state.hand, state.deckAvailable]);
    if (key !== this.key) {
      this.previous = this.value;
      this.value = undefined;
      this.key = key;
    }
    const terminal = state.diceUsed >= 100 && !state.bonusRoll;
    const complete = terminal || result.status === "complete";
    const score = terminal ? state.position : result.expectedFinalScore;
    if (complete && Number.isFinite(score)) {
      this.value = Math.round(score);
      return { value: this.value, delta: this.previous === undefined ? 0 : this.value - this.previous, terminal };
    }
    return { pending: result.status === "running", terminal };
  }
}
