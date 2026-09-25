import { cards, tiles, FULL_DECK, RULES_VERSION } from "../rules/index.js";
import { project } from "../environment/projection.js";

export const cardClass = id => {
  const card = cards[id];
  return card ? cards.findIndex(other => other?.type === card.type && other.value === card.value) : 0;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const classes = hand => hand.map(cardClass);
const core = observation => ({ position: observation.position, diceUsed: observation.diceUsed, bonusRoll: observation.bonusRoll, hand: observation.hand });
const keyOf = observation => JSON.stringify(core(observation));
const idsFor = group => cards.slice(1).filter(card => cardClass(card.id) === group).map(card => card.id);

function handIds(hand, mask) {
  const used = new Map();
  return hand.map(group => {
    const ids = idsFor(group).sort((a, b) => Number(!!(mask & (1 << (a - 1)))) - Number(!!(mask & (1 << (b - 1)))));
    const index = used.get(group) || 0;
    used.set(group, index + 1);
    return ids[index % ids.length];
  });
}

function deckSignature(mask) {
  return cards.slice(1).filter(card => cardClass(card.id) === card.id).map(card => idsFor(card.id).filter(id => mask & (1 << (id - 1))).length).join(",");
}

export function reconcileState(previous, observed) {
  const candidates = [];
  if (previous.diceUsed >= 100 && !previous.bonusRoll) return candidates;
  for (let action = 0; action <= previous.hand.length; action++) {
    const projection = project(previous, action), spec = action ? cards[previous.hand[action - 1]] : null;
    const outcome = projection.outcomes.find(outcome => outcome.score === observed.position);
    if (!outcome) continue;

    const normalDice = observed.diceUsed === previous.diceUsed + projection.diceDelta;
    const doublePossible = outcome.sums.some(sum => sum % 2 === 0);
    const bonusReconcile = !action && (observed.diceUsed === previous.diceUsed) && doublePossible;
    if (!normalDice && !bonusReconcile) continue;

    if (bonusReconcile) {
      if (tiles[observed.position - 1].event === 2) continue;
      if (observed.hand.length !== previous.hand.length || !same(classes(previous.hand), observed.hand)) continue;
    } else {
      const bonusPossible = projection.random
        ? previous.bonusRoll ? !observed.bonusRoll
          : outcome.sums.some(sum => observed.bonusRoll ? sum % 2 === 0 : sum > 2 && sum < 12)
        : observed.bonusRoll === previous.bonusRoll;
      if (!bonusPossible) continue;
    }
    const hand = [...previous.hand];
    if (action) hand.splice(action - 1, 1);
    let mask = previous.deckAvailable, reset = false;
    const draw = tiles[observed.position - 1].event === 2 && hand.length < 5;
    if (observed.hand.length !== hand.length + Number(draw) || !same(observed.hand.slice(0, hand.length), classes(hand))) continue;
    if (draw) {
      const group = observed.hand.at(-1), id = idsFor(group).find(id => mask & (1 << (id - 1)));
      if (!id) continue;
      hand.push(id); mask &= ~(1 << (id - 1));
      if (!mask) { mask = FULL_DECK; reset = true; }
    }
    candidates.push({ state: { ...previous, ...core(observed), hand, deckAvailable: mask }, reset,
      action: { kind: !action ? "roll" : spec.type === 2 ? "multiplier" : "card", slot: action, sums: outcome.sums } });
  }
  if (previous.position === observed.position && previous.diceUsed === observed.diceUsed && previous.bonusRoll === observed.bonusRoll && observed.hand.length === previous.hand.length - 1) {
    for (let slot = 0; slot < previous.hand.length; slot++) {
      const hand = previous.hand.filter((_, index) => index !== slot);
      if (same(classes(hand), observed.hand)) candidates.push({ state: { ...previous, hand }, reset: false, action: { kind: "discard", slot: slot + 1 } });
    }
  }
  const distinct = new Map();
  for (const candidate of candidates) {
    const key = keyOf({ ...candidate.state, hand: classes(candidate.state.hand) }) + ":" + deckSignature(candidate.state.deckAvailable);
    if (!distinct.has(key)) distinct.set(key, candidate);
  }
  return [...distinct.values()];
}

export function reconcileMultiStep(previous, observed) {
  const direct = reconcileState(previous, observed);
  if (direct.length) return direct;
  const diceDelta = observed.diceUsed - previous.diceUsed;
  if (diceDelta < 0 || diceDelta > 2) return [];

  const candidates2 = [];
  for (let action1 = 0; action1 <= previous.hand.length; action1++) {
    const proj1 = project(previous, action1);
    for (const outcome1 of proj1.outcomes) {
      const hand1 = [...previous.hand];
      if (action1) hand1.splice(action1 - 1, 1);
      const draw1 = tiles[outcome1.score - 1].event === 2 && hand1.length < 5;
      if (draw1) continue; // Avoid ambiguous card draw branching in multi-step recovery
      const midState = {
        ...previous,
        position: outcome1.score,
        diceUsed: previous.diceUsed + proj1.diceDelta,
        bonusRoll: proj1.random ? outcome1.sums.some(s => s % 2 === 0) : previous.bonusRoll,
        hand: hand1,
        deckAvailable: previous.deckAvailable,
      };
      const step2 = reconcileState(midState, observed);
      if (step2.length === 1) candidates2.push(step2[0]);
    }
  }
  const unique = new Map();
  for (const c of candidates2) {
    unique.set(JSON.stringify(core(c.state)), c);
  }
  return unique.size === 1 ? [candidates2[0]] : [];
}

export class AssistTracker {
  constructor() { this.reset(); }
  reset() {
    this.state = null;
    this.lastObservation = null;
    this.pendingKey = null;
    this.pendingSince = 0;
    this.pendingCount = 0;
    this.lastAt = -Infinity;
    this.manual = null;
    this.verifications = 0; this.lastMismatch = null;
    this.requireDeck("initial");
  }
  requireDeck(reason = "manual") {
    this.deckReason = reason;
    this.verified = false;
    this.scanKey = null;
    this.votes = Array.from({ length: 30 }, () => ({ value: null, count: 0 }));
  }
  correct(values, at) {
    if (!this.lastObservation?.visible) return false;
    this.manual = { key: keyOf(this.lastObservation), values, expires: at + 15000 };
    this.pendingKey = null;
    return true;
  }
  get seen() { return this.votes.filter(vote => vote.count >= 1).length; }
  result(issue, extra = {}) {
    return { ready: !issue, issue, seen: this.seen, verification: this.deckReason,
      canCorrect: !!this.lastObservation?.visible, ...extra };
  }
  collectDeck(observed, key) {
    if (this.scanKey !== key) {
      this.scanKey = key;
      this.votes = Array.from({ length: 30 }, () => ({ value: null, count: 0 }));
    }
    for (const row of observed.deck?.rows || []) {
      const vote = this.votes[row.index];
      if (!vote || typeof row.obtained !== "boolean") continue;
      if (vote.value !== row.obtained) { vote.value = row.obtained; vote.count = 1; }
      else vote.count++;
    }
  }
  deckIssue(deck) {
    if (!deck?.open) return "deck-open";
    const rows = deck.rows || [];
    const range = deck.range || (rows.length ? {
      start: Math.min(...rows.map(row => row.index)), end: Math.max(...rows.map(row => row.index)),
    } : null);
    if (!range) return "deck-scan";

    const missingBelow = this.votes.some((vote, i) => i > range.end && vote.count < 1);
    const missingAbove = this.votes.some((vote, i) => i < range.start && vote.count < 1);

    if (missingBelow && range.start <= 2) return "deck-down";
    if (missingAbove && range.end >= 27) return "deck-up";
    if (missingBelow && !missingAbove) return "deck-down";
    if (missingAbove && !missingBelow) return "deck-up";

    const missing = this.votes.findIndex(vote => vote.count < 1);
    if (missing < 0) return null;
    if (missing < range.start) return range.start === 0 ? "deck-down" : "deck-up";
    if (missing > range.end) return "deck-down";
    if (missingBelow) return "deck-down";
    if (missingAbove) return "deck-up";
    return "deck-adjust";
  }
  update(observation, at) {
    if (!Number.isFinite(at) || at <= this.lastAt) return this.result("waiting");
    if (this.state && this.verified && at - this.lastAt > 5000) this.requireDeck("gap");
    this.lastAt = at;
    this.lastObservation = observation;
    if (!observation.visible) {
      this.pendingKey = null;
      this.manual = null;
      return this.result(observation.issue || "window");
    }
    const rawKey = keyOf(observation);
    if (this.manual && (this.manual.key !== rawKey || at > this.manual.expires)) this.manual = null;
    const observed = this.manual ? { ...observation, ...this.manual.values } : observation;
    const complete = Number.isInteger(observed.position) && observed.position >= 1 && observed.position <= 2898
      && Number.isInteger(observed.diceUsed) && observed.diceUsed >= 0 && observed.diceUsed <= 100
      && typeof observed.bonusRoll === "boolean" && Array.isArray(observed.hand)
      && observed.hand.length <= 5 && observed.hand.every(id => cards[id] && cardClass(id) === id);
    if (!complete) {
      this.pendingKey = null;
      return this.result(observed.position === null ? "score" : observed.diceUsed === null ? "dice" : observed.hand === null ? "hand" : "bonus");
    }
    const key = keyOf(observed);
    if (key !== this.pendingKey) { this.pendingKey = key; this.pendingSince = at; this.pendingCount = 1; }
    else this.pendingCount++;
    if (!this.verified) this.collectDeck(observed, key);
    if (this.pendingCount < 2 || at - this.pendingSince < 200) return this.result("settling");
    const fresh = observed.position === 1 && observed.diceUsed === 0 && !observed.bonusRoll && observed.hand.length === 0;
    if (fresh && this.deckReason !== "manual" && (!this.verified || !same(core(observed), core(this.state)))) {
      this.state = { schemaVersion: 1, rulesVersion: RULES_VERSION, ...core(observed), deckAvailable: FULL_DECK };
      this.verified = true;
      return this.result(null, { state: this.state, synchronized: true, deckOpen: !!observed.deck?.open });
    }
    if (!this.verified) {
      if (this.seen < 30) {
        return this.result(this.deckIssue(observed.deck));
      }
      let mask = 0;
      this.votes.forEach((vote, index) => { if (!vote.value) mask |= 1 << index; });
      if (!mask) { this.requireDeck("reset"); return this.result("deck-reopen"); }
      this.state = { schemaVersion: 1, rulesVersion: RULES_VERSION, ...core(observed), hand: handIds(observed.hand, mask), deckAvailable: mask };
      this.verified = true; this.verifications++;
      return this.result(null, { state: this.state, synchronized: true, deckOpen: !!observed.deck?.open });
    }
    if (same(core(observed), { ...core(this.state), hand: classes(this.state.hand) }))
      return this.result(null, { state: this.state, deckOpen: !!observed.deck?.open });
    if (observed.diceUsed < this.state.diceUsed) return this.result("settling");
    const candidates = reconcileState(this.state, observed);
    const resolved = candidates.length === 1 ? candidates : reconcileMultiStep(this.state, observed);
    if (resolved.length === 1) {
      this.lastMismatch = null;
      const { state, reset, action } = resolved[0];
      if (action.kind === "discard" && at - this.pendingSince < 4000) return this.result("settling");
      this.state = state;
      if (reset) { this.requireDeck("reset"); return this.result("deck-open", { state, action }); }
      return this.result(null, { state, action });
    }
    const diceDelta = observed.diceUsed - this.state.diceUsed;
    this.lastMismatch = {
      from: core(this.state), to: core(observed),
      directCandidates: candidates.length, multiStepCandidates: resolved.length,
      diceDelta, timeInPending: Math.round(at - this.pendingSince)
    };
    const settlingLimit = diceDelta >= 0 && diceDelta <= 2 ? 4500 : 2500;
    if (at - this.pendingSince < settlingLimit) return this.result("settling");
    this.requireDeck("gap");
    this.collectDeck(observed, key);
    return this.result("deck-open");
  }
}
