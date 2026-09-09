import { tiles } from "../../rules/index.js";
import { tileLayout } from "../../content/board-layout.js";
export const BOARD_GEOMETRY = Object.freeze({
  width: 1024,
  height: 694,
  pitch: 96,
  x: 34,
  y: 60,
  characterY: 15,
  eventY: 36,
});
export function cellRect(position) {
  const grid = tileLayout[position - 1][1] - 1;
  return {
    x: (grid % 10) * 96 + 34,
    y: Math.floor(grid / 10) * 96 + 60,
    width: 89,
    height: 89,
  };
}
export function characterRect(position) {
  const r = cellRect(position);
  return { ...r, y: r.y - 45, width: 90, height: 120 };
}
export function positionAt(clientX, clientY, canvas, stage) {
  const rect = canvas.getBoundingClientRect(),
    x = ((clientX - rect.left) * 1024) / rect.width,
    y = ((clientY - rect.top) * 694) / rect.height,
    col = Math.floor((x - 34) / 96),
    row = Math.floor((y - 60) / 96);
  if (col < 0 || col >= 10 || row < 0) return null;
  const grid = row * 10 + col + 1;
  const index = tiles.findIndex(
    (t, i) => t.stage === stage && tileLayout[i][1] === grid,
  );
  return index < 0 ? null : index + 1;
}
