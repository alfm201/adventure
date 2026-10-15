import { validateSnapshot } from '../../environment/state.js';
export function researchState(snapshot) {
  validateSnapshot(snapshot);
  return [snapshot.position, snapshot.diceUsed, +snapshot.bonusRoll, snapshot.hand.length,
    ...Array.from({ length: 5 }, (_, i) => snapshot.hand[i] ?? 0), snapshot.deckAvailable,
    +(snapshot.diceUsed >= 100 && !snapshot.bonusRoll)];
}
export function slotValues(snapshot, result, rules) {
  const classes = [0, ...snapshot.hand.map(id => rules.idmap[id])];
  const values = classes.map(cls => result.q[result.classes.indexOf(cls)]);
  // The research policy breaks ties by sorted effect class, not hand order.
  const best = classes.indexOf(result.best);
  if (best < 0 || values.some(v => !Number.isFinite(v))) throw Error('Invalid LYRA policy output');
  return { best, values, bestClass: result.best };
}
