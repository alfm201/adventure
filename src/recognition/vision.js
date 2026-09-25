const WIDTH = 1234;
const CLASSES = [1, 2, 3, 4, 4, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 29];
const white = (r, g, b) => Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 48;

export function findGameRegion({ data, width, height }) {
  const mask = new Uint8Array(width * height), queue = new Int32Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = +white(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const choices = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = i; mask[i] = 0;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = (p / width) | 0;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const n of [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (n >= 0 && n < mask.length && mask[n]) { mask[n] = 0; queue[tail++] = n; }
      }
    }
    const w = right - left + 1, h = bottom - top + 1, measured = w / 193;
    if (measured < .55 || measured > 3 || Math.abs(h / measured - 272) > 6 || tail < 750 * measured * measured) continue;
    const rounded = Math.round(measured * 20) / 20;
    const scale = Math.abs(rounded - measured) < .012 ? rounded : measured;
    const x = Math.round(left + (w - 193 * scale) / 2 - 8 * scale), y = Math.round(top + (h - 272 * scale) / 2 - 7 * scale);
    if (x < -2 || y < -2 || x + WIDTH * scale > width + 2 || y + 694 * scale > height + 2) continue;
    choices.push({ x, y, width: WIDTH * scale, height: 694 * scale, scale });
  }
  return choices.sort((a, b) => b.scale - a.scale);
}

function runs(bits) {
  const result = [];
  for (let i = 0; i < bits.length;) {
    if (!bits[i]) { i++; continue; }
    const start = i;
    while (i < bits.length && bits[i]) i++;
    result.push([start, i]);
  }
  return result;
}

function normalized(mask, width, top, bottom, left, right) {
  const output = new Float32Array(216);
  const w = right - left, h = bottom - top;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
    const x0 = x * w / 12, x1 = (x + 1) * w / 12, y0 = y * h / 18, y1 = (y + 1) * h / 18;
    let sum = 0;
    for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++)
      for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++)
        sum += mask[(top + yy) * width + left + xx] * (Math.min(x1, xx + 1) - Math.max(x0, xx)) * (Math.min(y1, yy + 1) - Math.max(y0, yy));
    output[y * 12 + x] = sum / ((x1 - x0) * (y1 - y0));
  }
  return output;
}

export class GameRecognizer {
  constructor(templates) {
    this.templates = templates;
    this.rows = templates.rows.map(row => ({ ...row, mask: this.inkMask(row) }));
    this.anchor = { ...templates.anchor, mask: this.inkMask(templates.anchor) };
  }
  inkMask(template) {
    const mask = new Uint8Array(template.width * template.height);
    for (const p of template.ink) mask[p] = 1;
    return mask;
  }
  pixel(x, y) { const i = (Math.round(y) * WIDTH + Math.round(x)) * 4; return this.data.subarray(i, i + 3); }
  whiteAt(x, y) { return white(...this.pixel(x, y)); }
  textMask(x, y, width, height, predicate) {
    const mask = new Uint8Array(width * height);
    for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++)
      mask[yy * width + xx] = +predicate(...this.pixel(x + xx, y + yy));
    return mask;
  }
  inkSimilarity(mask, reference) {
    let total = 0, both = 0;
    for (let i = 0; i < mask.length; i++) { total += mask[i] + reference[i]; both += mask[i] & reference[i]; }
    return total ? both * 2 / total : 0;
  }
  anchorScore(image) {
    const mask = new Uint8Array(image.width * image.height);
    for (let i = 0; i < mask.length; i++) mask[i] = +(Math.min(image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2]) > 170);
    return this.inkSimilarity(mask, this.anchor.mask);
  }
  visible() {
    if ([[70, 7], [130, 7], [8, 50], [200, 100], [80, 278], [130, 278]].filter(([x, y]) => this.whiteAt(x, y)).length < 3) return false;
    const a = this.anchor;
    const mask = this.textMask(a.x, a.y, a.width, a.height, (r, g, b) => Math.min(r, g, b) > 170);
    this.lastAnchorScore = this.inkSimilarity(mask, a.mask); return this.lastAnchorScore > .62;
  }
  number(kind) {
    const [x, y, w, h] = kind === "score" ? [74, 55, 51, 21] : [131, 662, 28, 21];
    const mask = this.textMask(x, y, w, h, kind === "score" ? (r, g, b) => Math.min(r, g, b) > 135 : (r, g, b) => b > 165 && g > 130 && r > 95);
    const columns = Array.from({ length: w }, (_, x) => { for (let y = 0; y < h; y++) if (mask[y * w + x]) return true; return false; });
    const parts = runs(columns);
    if (!parts.length || parts.length > (kind === "score" ? 4 : 3)) return null;
    let text = "";
    for (const [left, right] of parts) {
      let top = h, bottom = 0;
      for (let yy = 0; yy < h; yy++) for (let xx = left; xx < right; xx++) if (mask[yy * w + xx]) { top = Math.min(top, yy); bottom = Math.max(bottom, yy + 1); }
      if (bottom - top < 7 || bottom - top > 14 || right - left > 9) return null;
      const feature = normalized(mask, w, top, bottom, left, right), scores = new Map();
      for (const template of this.templates.digits[kind]) {
        let error = 0;
        for (let i = 0; i < feature.length; i++) error += Math.abs(feature[i] - template.pixels[i] / 255);
        error = error / feature.length + Math.abs((right - left) / (bottom - top) - template.width / template.height) * .3;
        scores.set(template.value, Math.min(scores.get(template.value) ?? Infinity, error));
      }
      const sorted = [...scores].sort((a, b) => a[1] - b[1]);
      if (sorted[0][1] > .19 || sorted[1][1] - sorted[0][1] < .018) return null;
      text += sorted[0][0];
    }
    if (text.length > 1 && text.startsWith("0")) return null;
    const value = Number(text);
    return value >= (kind === "score" ? 1 : 0) && value <= (kind === "score" ? 2898 : 100) ? value : null;
  }
  hand() {
    const result = [];
    let empty = false;
    for (let slot = 0; slot < 5; slot++) {
      const x = 422 + slot * 42.67, y = 643;
      let teal = 0;
      for (let yy = 5; yy < 29; yy += 3) for (let xx = 5; xx < 29; xx += 3) {
        const [r, g, b] = this.pixel(x + xx, y + yy);
        if (g > r * 1.2 && b > r * 1.25 && Math.abs(g - b) < 80) teal++;
      }
      if (teal > 56) { empty = true; continue; }
      if (empty) return null;
      const costs = [];
      for (const card of this.templates.cards) {
        let best = Infinity;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          let error = 0, count = 0, i = 0;
          for (let yy = 3; yy < 31; yy += 2) for (let xx = 3; xx < 31; xx += 2, i++) {
            if (!card.mask[i]) continue;
            const rgb = this.pixel(x + xx + dx, y + yy + dy);
            for (let channel = 0; channel < 3; channel++) error += Math.abs(rgb[channel] - card.pixels[i * 3 + channel]);
            count += 3;
          }
          best = Math.min(best, error / count / 255);
        }
        costs.push([card.id, best]);
      }
      costs.sort((a, b) => a[1] - b[1]);
      if (costs[0][1] > .20 || costs[1][1] - costs[0][1] < .003) return null;
      result.push(costs[0][0]);
    }
    return result;
  }
  deck() {
    const blank = [[465, 105], [465, 250], [465, 490]].filter(([x, y]) => this.whiteAt(x, y)).length;
    const [r, g, b] = this.pixel(465, 30);
    if (blank < 3 || r < g * 1.25 || r < b * 1.1) return { open: false, rows: [] };
    const mask = this.textMask(256, 67, 221, 544, (r, g, b) => Math.max(r, g, b) < 115);
    const lines = Array.from({ length: 544 }, (_, y) => { let n = 0; for (let x = 0; x < 221; x++) n += mask[y * 221 + x]; return n > 4; });
    const bands = runs(lines).filter(([a, b]) => b - a >= 8 && b - a <= 14);
    const observed = [];
    for (const [start, end] of bands) {
      const y = start + 67;
      const costs = [];
      const parts = [-1, 0, 1].map(dy => this.textMask(256, y + dy, 221, 11, (r, g, b) => Math.max(r, g, b) < 115));
      for (const template of this.rows) {
        let best = 0;
        for (const part of parts) best = Math.max(best, this.inkSimilarity(part, template.mask));
        costs.push([template.id, best]);
      }
      costs.sort((a, b) => b[1] - a[1]);
      const id = costs[0][1] > .80 && costs[0][1] - costs[1][1] > .003 ? costs[0][0] : null;
      let orange = 0, dark = 0;
      for (let yy = y - 3; yy < y + 12; yy++) for (let xx = 232; xx < 252; xx++) {
        const [r, g, b] = this.pixel(xx, yy);
        if (r > 170 && g > 95 && g < 215 && b < g * .8) orange++;
        if (xx >= 242 && xx < 248 && yy >= y + 2 && yy < y + 8 && Math.max(r, g, b) < 100) dark++;
      }
      const obtained = orange >= 12 ? true : orange < 3 && dark >= 15 ? false : null;
      observed.push({ y, id, obtained });
    }
    if (observed.length < 3) return { open: true, rows: [] };
    const candidates = [];
    for (let start = 0; start < 30; start++) {
      let matches = 0, mismatches = 0;
      for (const row of observed) {
        const index = start + Math.round((row.y - observed[0].y) / 30);
        if (index >= 30) { mismatches += 2; continue; }
        if (row.id !== null) { if (CLASSES[index] === row.id) matches++; else mismatches++; }
      }
      candidates.push({ start, matches, mismatches, score: matches - 3 * mismatches });
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best.matches < 3 || best.mismatches || best.score - candidates[1].score < 2) return { open: true, rows: [] };
    return { open: true,
      range: { start: best.start, end: best.start + Math.round((observed.at(-1).y - observed[0].y) / 30) },
      rows: observed.map(row => ({ index: best.start + Math.round((row.y - observed[0].y) / 30), obtained: row.obtained, identified: row.id !== null })).filter(row => row.index < 30 && row.identified && row.obtained !== null) };
  }
  read(image) {
    this.data = image.data;
    if (!this.visible()) return { visible: false, issue: "covered", anchorScore: Math.round((this.lastAnchorScore || 0) * 1000) / 1000 };
    const position = this.number("score"), diceUsed = this.number("dice"), hand = this.hand();
    let blue = 0, yellow = 0;
    for (let y = 544; y < 607; y += 8) for (const x of [24, 31, 177, 184]) {
      const [r, g, b] = this.pixel(x, y);
      if (b > r * 1.2 && g > r) blue++;
      if (r > b * 1.5 && g > b * 1.1) yellow++;
    }
    const bonusRoll = blue > 18 ? true : yellow > 18 ? false : null;
    return { visible: true, position, diceUsed, hand, bonusRoll, deck: this.deck(),
      issue: position === null ? "score" : diceUsed === null ? "dice" : hand === null ? "hand" : bonusRoll === null ? "bonus" : null,
      anchorScore: Math.round(this.lastAnchorScore * 1000) / 1000 };
  }
}
