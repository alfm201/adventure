import { RULES_VERSION, BOARD_SIZE, FULL_DECK, tiles } from "../rules/index.js";
import { popcount } from "./tables.js";
export const SCHEMA_VERSION = 1;
export function handIds(board) {
  return Array.from(
    { length: board.cardCount },
    (_, i) => (board.cards >>> (i * 5)) & 31,
  );
}
export function snapshot(board) {
  return Object.freeze({
    schemaVersion: 1,
    rulesVersion: RULES_VERSION,
    position: board.score,
    diceUsed: board.diceUse,
    bonusRoll: board.isDouble,
    hand: Object.freeze(handIds(board)),
    deckAvailable: board.deckMask,
  });
}
export function validateSnapshot(s) {
  if (s.schemaVersion !== 1 || s.rulesVersion !== RULES_VERSION)
    throw Error("Incompatible state version");
  if (
    !Number.isInteger(s.position) ||
    s.position < 1 ||
    s.position > BOARD_SIZE ||
    !Number.isInteger(s.diceUsed) ||
    s.diceUsed < 0 ||
    s.diceUsed > 100 ||
    typeof s.bonusRoll !== "boolean" ||
    !Array.isArray(s.hand) ||
    s.hand.length > 5 ||
    s.hand.some((id) => !Number.isInteger(id) || id < 1 || id > 30) ||
    !Number.isInteger(s.deckAvailable) ||
    s.deckAvailable < 1 ||
    s.deckAvailable > FULL_DECK
  )
    throw Error("Invalid state");
  return s;
}
export function restore(board, s) {
  validateSnapshot(s);
  board.score = s.position;
  board.diceUse = s.diceUsed;
  board.isDouble = s.bonusRoll;
  board.cardCount = s.hand.length;
  board.cards = 0;
  for (let i = 0; i < s.hand.length; i++) board.cards |= s.hand[i] << (i * 5);
  board.deckMask = s.deckAvailable;
  board.deckCount = popcount(s.deckAvailable);
  return board;
}
export function copyCore(target, source) {
  target.score = source.score;
  target.diceUse = source.diceUse;
  target.isDouble = source.isDouble;
  target.cards = source.cards;
  target.cardCount = source.cardCount;
  target.deckMask = source.deckMask;
  target.deckCount = source.deckCount;
  return target;
}
export function toLegacy(s, { automatic = true, edited = false } = {}) {
  validateSnapshot(s);
  const t = tiles[s.position - 1];
  return [
    edited,
    automatic,
    s.position,
    t.stage,
    t.ordinal,
    s.diceUsed,
    +s.bonusRoll,
    ...Array.from({ length: 5 }, (_, i) => s.hand[i] || 0),
    ...Array.from({ length: 30 }, (_, i) =>
      s.deckAvailable & (1 << i) ? 0 : 1,
    ),
  ];
}
export function fromLegacy(a) {
  if (
    !Array.isArray(a) ||
    a.length !== 42 ||
    !tiles[a[2] - 1] ||
    tiles[a[2] - 1].stage !== a[3] ||
    tiles[a[2] - 1].ordinal !== a[4] ||
    ![0, 1].includes(a[6]) ||
    a.slice(12).some((x) => x !== 0 && x !== 1)
  )
    throw Error("Invalid legacy state");
  const slots = a.slice(7, 12),
    firstEmpty = slots.indexOf(0);
  if (firstEmpty >= 0 && slots.slice(firstEmpty).some((x) => x !== 0))
    throw Error("Non-contiguous hand");
  let mask = 0;
  for (let i = 0; i < 30; i++) if (!a[12 + i]) mask |= 1 << i;
  return validateSnapshot({
    schemaVersion: 1,
    rulesVersion: RULES_VERSION,
    position: a[2],
    diceUsed: a[5],
    bonusRoll: a[6] === 1,
    hand: slots.filter(Boolean),
    deckAvailable: mask || FULL_DECK,
  });
}
