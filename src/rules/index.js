import { boardRows } from "./board-data.js";
import { cardRows } from "./card-data.js";
export const RULES_VERSION = "adventure-1acaa72-v1",
  BOARD_SIZE = boardRows.length,
  STAGE_COUNT = boardRows[boardRows.length - 1][1],
  FULL_DECK = 0x3fffffff,
  HAND_LIMIT = 5,
  DICE_LIMIT = 100;
export function validateRules(rows = boardRows, defs = cardRows) {
  if (!rows.length || rows.length > 4095 || defs.length !== 30)
    throw Error("Unsupported rules dimensions");
  let last = 0;
  rows.forEach((r, i) => {
    if (
      r[0] !== i + 1 ||
      !Number.isInteger(r[1]) ||
      r[1] < 1 ||
      r[1] < last ||
      r[1] > last + 1 ||
      !Number.isInteger(r[2]) ||
      r[2] < 1 ||
      ![null, 1, 2, 3, 4, 5, 6, 9].includes(r[4]) ||
      (r[4] === 4 && !Number.isInteger(r[3]))
    )
      throw Error(`Invalid board definition ${i + 1}`);
    if (r[1] !== last && r[2] !== 1) throw Error("Missing stage start");
    last = r[1];
  });
  defs.forEach(([id, type, value], i) => {
    if (
      id !== i + 1 ||
      ![1, 2, 3].includes(type) ||
      !Number.isInteger(value) ||
      Math.abs(value) > 127 ||
      (type === 2 && value < 1) ||
      (type === 3 && value !== 1)
    )
      throw Error(`Invalid card ${id}`);
  });
}
validateRules();
export const tiles = Object.freeze(
  boardRows.map((r) =>
    Object.freeze({
      id: r[0],
      stage: r[1],
      ordinal: r[2],
      jump: r[3],
      event: r[4],
    }),
  ),
);
export const cards = Object.freeze([
  null,
  ...cardRows.map((r) => Object.freeze({ id: r[0], type: r[1], value: r[2] })),
]);
export const stageStarts = new Uint16Array(STAGE_COUNT + 2);
for (const t of tiles) if (!stageStarts[t.stage]) stageStarts[t.stage] = t.id;
// Policy-only positional view preserves baseline null arithmetic, without UI data.
export const policyStage = Object.freeze(
  tiles.map((t) =>
    Object.freeze([t.id, t.stage, t.ordinal, null, t.jump, t.event]),
  ),
);
export const policyCards = Object.freeze(
  cardRows.map((r) => Object.freeze([...r, 0])),
);
export const clampPosition = (n) => Math.max(1, Math.min(BOARD_SIZE, n));
