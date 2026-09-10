import { cards } from "../rules/index.js";
export function actionGroups(s) {
  const bySignature = new Map(),
    canonical = [],
    aliases = new Map(),
    representatives = [];
  const effects = s.hand.map((id) => `${cards[id].type}:${cards[id].value}`);
  for (let a = 0; a <= s.hand.length; a++) {
    const signature = a
      ? effects[a - 1]
      : "roll";
    let rep = bySignature.get(signature);
    if (rep === undefined) {
      rep = a;
      bySignature.set(signature, a);
      representatives.push(a);
      aliases.set(a, []);
    }
    canonical[a] = rep;
    aliases.get(rep).push(a);
  }
  return { canonical, aliases, representatives };
}
