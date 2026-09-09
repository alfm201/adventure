import {
  tiles,
  cards,
  BOARD_SIZE as size,
  STAGE_COUNT,
  stageStarts,
  clampPosition,
} from "../rules/index.js";
const minMove = Math.min(
  0,
  ...cards
    .slice(1)
    .filter((c) => c.type === 1)
    .map((c) => c.value),
);
const maxMove = Math.max(
  12,
  STAGE_COUNT + 1,
  ...cards.slice(1).map((c) => (c.type === 2 ? c.value * 12 : c.value)),
);
export const offset = -minMove,
  cardSpec = new Int16Array(31);
for (const c of cards.slice(1)) cardSpec[c.id] = (c.value << 2) | c.type;
export const landing = new Uint16Array(size + maxMove + offset + 1);
for (let s = 1; s <= size; s++) {
  let p = s,
    hops = 0;
  while (tiles[p - 1].event === 4) {
    p = clampPosition(p + tiles[p - 1].jump);
    if (++hops > size) throw Error("Cyclic stage jump");
  }
  landing[s + offset] = p | (tiles[p - 1].event === 2 ? 4096 : 0);
}
landing.fill(landing[1 + offset], 0, 1 + offset);
landing.fill(landing[size + offset], size + offset + 1);
export const nextStage = new Uint16Array(size + 1),
  nextStageRaw = new Uint16Array(size + 1),
  rollTable = new Uint16Array((size + 1) * 11),
  stopAfter = new Uint16Array(size + 1);
let stop = size;
for (let s = size; s >= 1; s--) {
  const target = tiles[s - 1].stage + 1;
  nextStageRaw[s] = clampPosition(stageStarts[target] || s + target);
  nextStage[s] = landing[nextStageRaw[s] + offset];
  stopAfter[s] = stop;
  for (let d = 2; d <= 12; d++)
    rollTable[s * 11 + d - 2] = landing[Math.min(s + d, stop) + offset];
  if (tiles[s - 1].event === 6 || tiles[s - 1].event === 9) stop = s;
}
export const pop = new Uint8Array(256),
  select = new Uint8Array(2048);
for (let mask = 1; mask < 256; mask++) {
  let count = 0;
  for (let bit = 0; bit < 8; bit++)
    if (mask & (1 << bit)) select[(mask << 3) + count++] = bit;
  pop[mask] = count;
}
export function popcount(mask) {
  return (
    pop[mask & 255] +
    pop[(mask >>> 8) & 255] +
    pop[(mask >>> 16) & 255] +
    pop[mask >>> 24]
  );
}
export function resolveLanding(position) {
  return landing[clampPosition(position) + offset] & 4095;
}
export function rawDestination(position, move, stop = false) {
  return clampPosition(
    stop ? Math.min(position + move, stopAfter[position]) : position + move,
  );
}
