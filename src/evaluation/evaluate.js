import { createGpuDispatchTuner } from "../compute/gpu/scheduling.js";
import { RULES_VERSION } from "../rules/index.js";
import { POLICY_VERSION } from "../policies/versions.js";
import {
  accumulator,
  merge,
  decide,
  prune,
  sampleActions,
  summarize,
} from "./statistics.js";
import { actionGroups } from "./actions.js";
import { streamSeed } from "../environment/random.js";
import { predictG3Score } from "./g3-score.js";
const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
};
const yieldFor = (ms) => new Promise((r) => setTimeout(r, ms));
export async function evaluate({
  snapshot,
  profile,
  backend,
  signal,
  seed,
  requestId = 0,
  revision = 0,
  onProgress = () => {},
}) {
  const tuner =
    profile.engine === "gpu"
      ? createGpuDispatchTuner(
          profile.batch,
          profile.gpuSettings || { gpuLoad: profile.usage },
        )
      : null;
  const started = performance.now(),
    groups = actionGroups(snapshot),
    stats = Array.from({ length: snapshot.hand.length + 1 }, () =>
      accumulator(profile.engine === "cpu"),
    );
  let active = [...groups.representatives],
    batchId = 0;
  let expectedFinalScore;
  function result(status, reason) {
    const d = decide(stats, active),
      best = d.best;
    return {
      status,
      model: "x36",
      expectedFinalScore,
      reason,
      requestId,
      revision,
      rulesVersion: RULES_VERSION,
      policyVersion: POLICY_VERSION,
      profile,
      seed,
      elapsedMs: performance.now() - started,
      representatives: groups.representatives,
      totalSamples: groups.representatives.reduce(
        (n, a) => n + stats[a].count,
        0,
      ),
      best,
      recommended: best === undefined ? [] : groups.aliases.get(best),
      actions: groups.canonical.map((rep, a) => {
        const s = d.summaries[rep],
          winner = best === undefined ? null : d.summaries[best],
          gap = winner && s.count ? winner.mean - s.mean : null;
        return {
          action: a,
          representative: rep,
          ...s,
          gap,
          near:
            best !== undefined &&
            active.includes(rep) &&
            s.count > 0 &&
            gap <= 1.96 * Math.hypot(winner.se, s.se),
          status: !s.count
            ? "pending"
            : rep === best
              ? "recommended"
              : active.includes(rep)
                ? "active"
                : "pruned",
        };
      }),
    };
  }
  if (snapshot.diceUsed >= 100 && !snapshot.bonusRoll) {
    return {
      ...result("terminal", "terminal"),
      expectedFinalScore: snapshot.position,
      best: undefined,
      recommended: [],
      actions: stats.map((_, action) => ({
        action,
        status: "terminal",
        mean: snapshot.position,
        count: 0,
        near: false,
      })),
    };
  }
  async function run(actions, amount, initial = false) {
    cancelled(signal);
    const id = ++batchId;
    if (profile.engine === "cpu") {
      const jobs = [];
      for (const action of actions) {
        let left = Math.min(amount, profile.max - stats[action].count),
          start = stats[action].count;
        while (left > 0) {
          const count = Math.min(profile.chunk, left);
          jobs.push({
            snapshot,
            action,
            count,
            start,
            seed,
            requestId,
            revision,
            batchId: id,
          });
          start += count;
          left -= count;
        }
      }
      const batches = await Promise.all(
        jobs.map((job) =>
          backend
            .run(job, signal)
            .then((stat) => ({ action: job.action, stat })),
        ),
      );
      cancelled(signal);
      for (const { action, stat } of batches) merge(stats[action], stat);
    } else {
      const runnable = actions.filter((a) => stats[a].count < profile.max);
      const shared =
        initial ||
        (groups.representatives.length < stats.length &&
          runnable.every(
            (a) =>
              Math.min(amount, profile.max - stats[a].count) ===
              Math.min(amount, profile.max - stats[runnable[0]].count),
          ));
      const dispatchGroups = shared ? [runnable] : runnable.map((a) => [a]);
      for (const dispatchedActions of dispatchGroups) {
        for (let offset = 0; offset < amount; ) {
          cancelled(signal);
          const eligible = dispatchedActions.filter(
            (a) => stats[a].count < profile.max,
          );
          if (!eligible.length) break;
          const count = Math.min(
            tuner.next(amount - offset),
            amount - offset,
            ...eligible.map((a) => profile.max - stats[a].count),
          );
          if (count <= 0) break;
          const chunkStarted = performance.now();
          const batches = await backend.run(
            {
              snapshot,
              actions: eligible,
              count,
              seed: streamSeed(seed, id, offset + (eligible[0] << 24)),
            },
            signal,
          );
          cancelled(signal);
          for (const stat of batches) {
            if (stat.truncated)
              throw Error(
                `GPU rollout ${stat.truncated}개가 종료 한도에 도달했습니다. 결과를 추천에 사용하지 않습니다.`,
              );
            merge(stats[stat.action], stat);
          }
          tuner.record(performance.now() - chunkStarted, count);
          offset += count;
          onProgress(result("running", null));
          if (offset < amount && tuner.yieldMs) await yieldFor(tuner.yieldMs);
        }
      }
    }
    cancelled(signal);
    onProgress(result("running", null));
  }
  expectedFinalScore = await predictG3Score(snapshot);
  cancelled(signal);
  await run(active, Math.min(profile.initial, profile.max), true);
  while (true) {
    cancelled(signal);
    const d = decide(stats, active);
    if (active.every((a) => stats[a].count >= profile.max))
      return result("complete", "budget");
    if (!profile.noEarlyStop && d.stop)
      return result(
        "complete",
        active.length === 1 ? "single-candidate" : "confidence",
      );
    if (!profile.noEarlyStop) active = prune(stats, active);
    if (!profile.noEarlyStop && active.length <= 1)
      return result("complete", "pruned");
    const next = profile.noEarlyStop
      ? active.filter((a) => stats[a].count < profile.max)
      : sampleActions(stats, active, profile.max);
    if (!next.length) return result("complete", "budget");
    await run(next, profile.batch);
  }
}
