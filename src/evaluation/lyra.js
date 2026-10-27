import { MODEL_ID, MODEL_NAME, MANIFEST } from '../compute/lyra/model.js';
import { BOARD_SIZE } from '../rules/index.js';
export async function evaluateLyra({ snapshot, backend, signal, requestId, revision }) {
  const terminal = snapshot.diceUsed >= 100 && !snapshot.bonusRoll;
  const result = terminal ? { best: 0, values: Array(snapshot.hand.length + 1).fill(snapshot.position), elapsedMs: 0 }
    : await backend.run(snapshot, { signal });
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const highest = result.values[result.best];
  const recommended = terminal ? [] : result.values.flatMap((v, i) => v === highest ? [i] : []);
  return { status: 'complete', model: 'lyra', requestId, revision,
    profile: { model: 'lyra', engine: result.engine ?? backend?.info?.engine ?? 'cpu', device: backend?.info?.preference ?? 'auto', usage: backend?.info?.usage ?? 'medium' },
    policyVersion: MODEL_ID, modelName: MODEL_NAME, modelVersion: MANIFEST.version, elapsedMs: result.elapsedMs,
    expectedFinalScore: terminal ? snapshot.position : Number.isFinite(result.expectedFinalScore)
      ? Math.min(BOARD_SIZE, result.expectedFinalScore) : undefined,
    best: result.best, bestClass: result.bestClass, recommended,
    actions: result.values.map((value, action) => ({ action, value, gap: highest - value,
      status: terminal ? 'terminal' : recommended.includes(action) ? 'recommended' : 'evaluated' })) };
}
