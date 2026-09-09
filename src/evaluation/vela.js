export async function evaluateVela({ snapshot, backend, signal, requestId, revision }) {
  const terminal = snapshot.diceUsed >= 100 && !snapshot.bonusRoll;
  const result = terminal
    ? { best: 0, values: Array(snapshot.hand.length + 1).fill(snapshot.position), elapsedMs: 0 }
    : await backend.run(snapshot, { signal });
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const highest = result.values[result.best];
  const recommended = terminal ? [] : result.values.flatMap((value, i) => value === highest ? [i] : []);
  return {
    status: "complete", model: "vela", requestId, revision,
    profile: { model: "vela", engine: "cpu" },
    policyVersion: backend.info?.manifest?.id ?? "vela-v4",
    modelName: backend.info?.manifest?.name ?? "VELA v4",
    modelVersion: backend.info?.manifest?.version,
    elapsedMs: result.elapsedMs,
    best: result.best, recommended,
    actions: result.values.map((value, action) => ({
      action, value, gap: highest - value,
      status: terminal ? "terminal" : recommended.includes(action) ? "recommended" : "evaluated",
    })),
  };
}
