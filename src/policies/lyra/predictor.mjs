// Shared LYRA score schema, trained on the matched checkpoint's FP32 best 1-step Q.
export function createPredictor(model) {
  if (model.format !== "lyra-v1-score-v1") throw Error("Unsupported predictor format");
  const trees = model.trees.map(tree => ({
    feature: Int16Array.from(tree.feature),
    threshold: Float64Array.from(tree.threshold),
    left: Uint16Array.from(tree.left),
    right: Uint16Array.from(tree.right),
    value: Float64Array.from(tree.value),
  }));
  const classOf = Uint8Array.from(model.classOf);
  return function predictFinalScore(state, q, phi) {
    if (state.diceUsed >= 100 && !state.bonusRoll) return state.position;
    if (!Number.isFinite(q)) throw Error("A finite LYRA best action Q is required");
    if (model.usePhi && !Number.isFinite(phi)) throw Error("phi is not used by this predictor");
    const r = 100 - state.diceUsed;
    if (!Number.isInteger(r) || r < 0 || r > 100) throw Error("Invalid diceUsed");
    const x = new Float32Array(model.usePhi ? 51 : 50);
    x[0] = r; x[1] = state.position; x[2] = +state.bonusRoll;
    x[3] = state.hand.length; x[4] = q;
    let offset = 0;
    if (model.usePhi) x[5] = phi - q;
    else offset = -1;
    x[6 + offset] = q - state.position;
    for (const id of state.hand) x[6 + classOf[id] + offset]++;
    for (let id = 1; id <= 30; id++)
      if (state.deckAvailable & (1 << (id - 1))) x[28 + classOf[id] + offset]++;
    let correction = model.baseline;
    for (const tree of trees) {
      let node = 0;
      while (tree.feature[node] >= 0)
        node = x[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
      correction += tree.value[node];
    }
    return q + model.correction[r] + correction;
  };
}
