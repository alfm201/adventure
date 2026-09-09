import { Board } from "../../environment/board.js";
import { restore, copyCore } from "../../environment/state.js";
import { seededRandom, streamSeed } from "../../environment/random.js";
import { createPolicy } from "../../policies/index.js";
import { accumulator } from "../../evaluation/statistics.js";
const choose = createPolicy();
export function runRollouts({
  snapshot,
  action,
  count,
  start = 0,
  seed = 1,
}) {
  const initial = restore(new Board(), snapshot),
    env = new Board(),
    stats = accumulator(true);
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isInteger(action) ||
    action < 0 ||
    action > initial.cardCount
  )
    throw Error("Invalid rollout request");
  for (let i = 0; i < count; i++) {
    copyCore(env, initial);
    env.random = seededRandom(streamSeed(seed, action, start + i));
    env.step(action);
    while (!env.terminal) env.step(choose(env));
    const value = env.score;
    stats.count++;
    stats.sum += value;
    stats.sumSq += value * value;
    stats.min = Math.min(stats.min, value);
    stats.max = Math.max(stats.max, value);
    stats.histogram[value]++;
  }
  return stats;
}
