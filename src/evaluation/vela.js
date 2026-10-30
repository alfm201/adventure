import { velaSearch } from "../policies/vela/search.js";
import { MODEL_NAME } from "../compute/vela/model.js";
import { BOARD_SIZE } from "../rules/index.js";

export async function evaluateVela({ snapshot, backend, signal, requestId, revision, strength = "normal" }) {
  const option = velaSearch(strength);
  const terminal = snapshot.diceUsed >= 100 && !snapshot.bonusRoll;
  const result = terminal
    ? { best: 0, values: Array(snapshot.hand.length + 1).fill(snapshot.position), elapsedMs: 0 }
    : await backend.run(snapshot, { signal, strength });
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const highest = result.values[result.best];
  const recommended = terminal ? [] : result.values.flatMap((value, i) => value === highest ? [i] : []);
  return {
    status: "complete", model: "vela", requestId, revision,
    profile: { model: "vela", engine: "cpu", searchStrength: option.key, nodeBudget: option.nodeBudget },
    search: { nodes: result.nodes ?? 0, depth: result.depth ?? 2, capped: result.capped ?? false },
    policyVersion: option.policyId,
    modelName: backend.info?.manifest?.name ?? MODEL_NAME,
    modelVersion: backend.info?.manifest?.version,
    elapsedMs: result.elapsedMs,
    expectedFinalScore: terminal ? snapshot.position : Number.isFinite(result.expectedFinalScore)
      ? Math.min(BOARD_SIZE, result.expectedFinalScore) : undefined,
    best: result.best, recommended,
    actions: result.values.map((value, action) => ({
      action, value, gap: highest - value,
      status: terminal ? "terminal" : recommended.includes(action) ? "recommended" : "evaluated",
    })),
  };
}
