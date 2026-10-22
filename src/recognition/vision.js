import { CharacterProbe } from "./character.js";
import { DeckNumbers } from "./deck-numbers.js";

const WIDTH = 1234;
const white = (r, g, b) => Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 48;
const WHITE_POINTS = [[70, 7], [130, 7], [8, 50], [200, 100], [80, 278], [130, 278]];
const CORE_REGIONS = [[74, 55, 51, 21], [420, 638, 220, 42], [16, 540, 176, 70], [128, 659, 35, 27]];

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
    this.anchor = templates.anchor;
    this.deckNumbers = new DeckNumbers(templates.deckDigits);
    this.character = new CharacterProbe(templates.characters);
  }
  pixel(x, y) { const i = (Math.round(y) * WIDTH + Math.round(x)) * 4; return this.data.subarray(i, i + 3); }
  whiteAt(x, y) { return white(...this.pixel(x, y)); }
  textMask(x, y, width, height, predicate) {
    const mask = new Uint8Array(width * height);
    for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++)
      mask[yy * width + xx] = +predicate(...this.pixel(x + xx, y + yy));
    return mask;
  }
  anchorScore(image) {
    return this.structureScore((x, y) => image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3));
  }
  structureScore(pixel) {
    // All groups are text-free frame/divider/icon patches. Each must agree;
    // a large matching blank panel cannot compensate for an unrelated icon.
    return Math.min(...this.anchor.groups.map(group => {
      let error = 0;
      for (const [x, y, r, g, b] of group) {
        const rgb = pixel(x, y);
        error += Math.abs(rgb[0] - r) + Math.abs(rgb[1] - g) + Math.abs(rgb[2] - b);
      }
      return 1 - error / (group.length * 3 * 255);
    }));
  }
  visible() {
    if (WHITE_POINTS.filter(([x, y]) => this.whiteAt(x, y)).length < 3) return false;
    const a = this.anchor;
    this.lastAnchorScore = this.structureScore((x, y) => this.pixel(a.x + x, a.y + y));
    return this.lastAnchorScore > .88;
  }
  dimmingGain() {
    const samples = WHITE_POINTS.map(([x, y]) => Array.from(this.pixel(x, y)))
      .filter(rgb => Math.max(...rgb) - Math.min(...rgb) < 30 && Math.min(...rgb) >= 32);
    if (samples.length < 4) return null;
    const levels = samples.map(rgb => Math.max(...rgb)).sort((a, b) => a - b);
    const level = levels[Math.floor(levels.length / 2)], gain = 255 / level;
    // A coherent dimming layer preserves the UI colors and geometry. Do not
    // brighten arbitrary covered windows, colored overlays, or near-black UI.
    if (gain < 1.06 || gain > 7.5 || levels.filter(value => Math.abs(value - level) < Math.max(7, level * .12)).length < 4) return null;
    return gain;
  }
  brightenCore(image, gain, retained) {
    this.corePixels ||= new Uint8ClampedArray(WIDTH * 694 * 4);
    const source = image.data, target = this.corePixels;
    const regions = retained ? CORE_REGIONS : [...CORE_REGIONS,
      [this.anchor.x, this.anchor.y, this.anchor.width, this.anchor.height]];
    for (const [x, y, width, height] of regions) for (let yy = y; yy < y + height; yy++) {
      for (let i = (yy * WIDTH + x) * 4, end = i + width * 4; i < end; i += 4) {
        target[i] = source[i] * gain; target[i + 1] = source[i + 1] * gain;
        target[i + 2] = source[i + 2] * gain; target[i + 3] = source[i + 3];
      }
    }
    if (!retained) for (const [x, y] of WHITE_POINTS) {
      const i = (y * WIDTH + x) * 4;
      for (let channel = 0; channel < 4; channel++) target[i + channel] = channel === 3 ? source[i + channel] : source[i + channel] * gain;
    }
    this.data = target;
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
    if (blank < 3 || r < g * 1.25 || r < b * 1.1) { this.deckCache = this.deckFailure = null; return { open: false, rows: [] }; }
    // Scan this fixed ROI directly. Avoid allocating an RGB subarray for
    // each of its 120,224 pixels on every deck frame.
    const mask = new Uint8Array(221 * 544), data = this.data;
    for (let y = 0, p = 0; y < 544; y++) {
      let at = ((y + 67) * WIDTH + 256) * 4;
      for (let x = 0; x < 221; x++, p++, at += 4)
        mask[p] = +(data[at] < 170 && data[at + 1] < 170 && data[at + 2] < 170);
    }
    let levels;
    const readLevels = () => {
      levels = new Uint8Array(221 * 544);
      for (let y = 0, p = 0; y < 544; y++) {
        let at = ((y + 67) * WIDTH + 256) * 4;
        for (let x = 0; x < 221; x++, p++, at += 4)
          levels[p] = Math.max(data[at], data[at + 1], data[at + 2]);
      }
      return levels;
    };
    if (this.deckCache && mask.every((value, i) => value === this.deckCache.mask[i]) &&
        (!this.deckCache.levels || readLevels().every((value, i) => value === this.deckCache.levels[i]))) {
      return { open: true, range: this.deckCache.range,
        ...(this.deckCache.contrast ? { recognition: this.deckCache.contrast } : {}),
        rows: this.deckCache.rows.map(row => ({ index: row.index, identified: true, obtained: this.deckRowFlag(row) }))
          .filter(row => row.obtained !== null) };
    }
    this.deckCache = null;
    if (this.deckFailure && (levels || readLevels()).every((value, i) => value === this.deckFailure.levels[i]))
      return { open: true, rows: [], recognition: this.deckFailure.analysis };
    let analysis = this.deckNumbers.analyze(mask, 221, 544), identified = analysis.identified;
    if (!identified) {
      const alternate = this.deckNumbers.analyzeContrast(levels || readLevels(), 221, 544);
      if (alternate) { analysis = alternate; identified = alternate.identified; }
    }
    if (!identified) {
      this.deckFailure = { levels, analysis };
      return { open: true, rows: [], recognition:analysis };
    }
    this.deckFailure = null;
    const rows = identified.rows.map(row => ({ ...row, y: row.y + 67,
      ...(analysis.samples ? { ys: analysis.samples.flatMap(sample => {
        const found = sample.find(r => r.index === row.index);
        return found ? [found.y + 67] : [];
      }) } : {}) }));
    const contrast = analysis.contrast ? { reason: 'identified', method: 'contrast', ...analysis.contrast } : null;
    this.deckCache = { mask, range: identified.range, rows, levels: contrast ? levels : null, contrast };
    return { open: true, range: identified.range,
      ...(contrast ? { recognition: contrast } : {}),
      rows: rows.map(row => ({ index: row.index, identified: true, obtained: this.deckRowFlag(row) }))
        .filter(row => row.obtained !== null) };
  }

  deckRowFlag(row) {
    const value = this.deckFlag(row.y);
    // Contrast may move a text band's top by one pixel. A flag must agree
    // at every independently accepted band position, including cache hits.
    return row.ys?.some(y => this.deckFlag(y) !== value) ? null : value;
  }
  deckFlag(y) {
    let orange = 0, dark = 0;
    for (let yy = y - 3; yy < y + 12; yy++) for (let xx = 232; xx < 252; xx++) {
      const [r, g, b] = this.pixel(xx, yy);
      if (r > 170 && g > 95 && g < 215 && b < g * .8) orange++;
      if (xx >= 242 && xx < 248 && yy >= y + 2 && yy < y + 8 && Math.max(r, g, b) < 100) dark++;
    }
    return orange >= 12 ? true : orange < 3 && dark >= 15 ? false : null;
  }
  readCore(image, { allowOverlay = false, retained = false, illumination = 1 } = {}) {
    this.data = image.data;
    this.lastAnchorScore = 0;
    let overlay = false, dimmed = false;
    if (retained && Number.isFinite(illumination) && illumination >= 1.06 && illumination <= 7.5) {
      this.brightenCore(image, illumination, true); dimmed = true;
    }
    const visible = retained || this.visible();
    if (!retained && visible) {
      // A light fade can pass the white-pixel gate while already changing card
      // colors. Normalize coherent fades too, with the same stricter UI check.
      const gain = this.dimmingGain(), score = this.lastAnchorScore;
      if (gain) {
        this.brightenCore(image, gain, false);
        if (this.visible() && this.lastAnchorScore > .90) { illumination = gain; dimmed = true; }
        else { this.data = image.data; this.lastAnchorScore = score; }
      }
    }
    if (!retained && !visible) {
      const a = this.anchor;
      if (allowOverlay) {
        this.lastAnchorScore = this.structureScore((x, y) => this.pixel(a.x + x, a.y + y));
        overlay = this.lastAnchorScore > .90;
      }
      if (!overlay) {
        const gain = this.dimmingGain();
        if (gain) {
          this.brightenCore(image, gain, false);
          if (this.visible() && this.lastAnchorScore > .90) { illumination = gain; dimmed = true; }
        }
        if (!dimmed) {
          this.data = image.data;
          return { visible: false, issue: "covered", anchorScore: Math.round((this.lastAnchorScore || 0) * 1000) / 1000 };
        }
      }
    }
    const position = this.number("score"), diceUsed = this.number("dice"), hand = this.hand();
    let blue = 0, yellow = 0, magenta = 0;
    for (let y = 544; y < 607; y += 7) {
      for (const x of [22, 28, 180, 186]) {
        const [r, g, b] = this.pixel(x, y);
        if ((b > r * 1.2 && b > 115) || (g > r * 1.25 && b > r * 1.1)) blue++;
        if (r > b * 1.4 && g > b * 1.05 && r > 175) yellow++;
      }
    }
    for (let y = 566; y <= 586; y += 5) {
      for (let x = 55; x <= 95; x += 8) {
        const [r, g, b] = this.pixel(x, y);
        if (r > 180 && b > 150 && g < 130) magenta++;
      }
    }
    const bonusRoll = (magenta >= 2 || blue > yellow + 5) ? true : (yellow > blue + 5) ? false : null;
    return { visible: true, position, diceUsed, hand, bonusRoll, overlay, dimmed, illumination: dimmed ? illumination : 1,
      issue: position === null ? "score" : diceUsed === null ? "dice" : hand === null ? "hand" : bonusRoll === null ? "bonus" : null,
      anchorScore: Math.round(this.lastAnchorScore * 1000) / 1000 };
  }
  read(image, context) {
    const observation = this.readCore(image);
    if (!observation.visible) return observation;
    // Dimming correction is restricted to core ROIs. Deck flags still use
    // original pixels; optional avatar evidence is unavailable behind a modal.
    this.data = image.data;
    const deck = this.deck();
    let profile = null, character = null, helperIssue = null;
    try {
      profile = observation.dimmed ? null : this.character.profile(this.data);
      if (profile?.present) this.character.profileId = profile.id;
      const knownId = profile?.present ? profile.id : context?.characterId;
      character = !observation.dimmed && !deck.open && observation.position && (knownId || context?.position === observation.position)
        ? this.character.read(this.data, observation.position, knownId, !!profile?.present) : null;
    } catch {
      // Optional sprite evidence must never discard a valid core/deck reading.
      helperIssue = "character";
      profile = character = null;
    }
    return { ...observation, deck, character, profile, helperIssue };
  }
}
