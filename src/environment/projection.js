import { tiles, cards } from "../rules/index.js";
import { nextStageRaw, rawDestination, resolveLanding } from "./tables.js";
export function landingDetails(position, move, stop = false) {
  const raw = rawDestination(position, move, stop),
    score = resolveLanding(raw);
  return {
    score,
    raw,
    jumpTotal: score - raw,
    event: tiles[score - 1].event,
    stop: stop && [6, 9].includes(tiles[score - 1].event),
  };
}
export function project(s, action) {
  if (!Number.isInteger(action) || action < 0 || action > s.hand.length)
    throw Error("Invalid projection action");
  const c = action ? cards[s.hand[action - 1]] : null,
    random = !c || c.type === 2,
    results = new Map(),
    denominator = random ? 36 : 1;
  let card = 0,
    jump = 0,
    stop = 0;
  const record = (move, a = 0, b = 0) => {
    const d = landingDetails(s.position, move, !c),
      key = String(d.score);
    let r = results.get(key);
    if (!r) {
      r = { ...d, count: 0, denominator, sums: [] };
      results.set(key, r);
    }
    r.count++;
    if (random && !r.sums.includes(a + b)) r.sums.push(a + b);
    if (d.event === 2) card++;
    if (d.jumpTotal > 0) jump++;
    if (d.stop) stop++;
  };
  if (random)
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) record((a + b) * (c?.value || 1), a, b);
  else record(c.type === 3 ? nextStageRaw[s.position] - s.position : c.value);
  const outcomes = [...results.values()].sort((a, b) => a.score - b.score),
    diceDelta = random && !s.bonusRoll ? 1 : 0,
    nextDice = s.diceUsed + diceDelta,
    meanPosition = outcomes.reduce(
      (n, o) => n + (o.score * o.count) / denominator,
      0,
    );
  return {
    action,
    random,
    outcomes,
    denominator,
    diceDelta,
    meanMove: meanPosition - s.position,
    ratioDelta:
      nextDice > 0
        ? meanPosition / nextDice - (s.diceUsed ? s.position / s.diceUsed : 0)
        : null,
    cardProbability: card / denominator,
    acquisitionProbability:
      s.hand.length - (action ? 1 : 0) < 5 ? card / denominator : 0,
    jumpProbability: jump / denominator,
    stopProbability: stop / denominator,
  };
}
