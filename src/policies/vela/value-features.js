import { cards } from "../../rules/index.js";

const idmap = new Uint8Array(31), classes = [], pairs = Array.from({ length: 23 }, () => new Uint16Array(23));
for (let id = 1; id <= 30; id++) {
  const card = cards[id];
  let index = classes.findIndex(c => c.type === card.type && c.value === card.value);
  if (index < 0) { index = classes.length; classes.push(card); }
  idmap[id] = index + 1;
}
let pairIndex = 23;
for (let c = 1; c <= 22; c++) for (let d = c; d <= 22; d++) pairs[c][d] = pairs[d][c] = pairIndex++;
const combinations = Array.from({ length: 28 }, () => new Float64Array(7));
for (let i = 0; i < 28; i++) {
  combinations[i][0] = 1;
  for (let j = 1; j <= 6; j++) combinations[i][j] = i ? combinations[i - 1][j - 1] + combinations[i - 1][j] : 0;
}
const deckCoefficients = [0,-2.9723178525982519,-2.7140637354995292,-1.8559040841767285,-0.63562876013553904,0.013346098928735728,0.63692348040956404,0.82467081150863919,2.8122521824692228,4.6473907877604148,5.2789526496655981,6.0052117771957825,7.3218175844134663,-5.1235862463748845,-6.3516751524029402,-7.0850609112363898,-29.025888492468635,-21.884611636999885,-6.3135444372928546,7.6977237067945055,14.319077743992658,28.281895126805161,-3.7274439456824098];
function rank(hand) {
  const n = hand.length;
  if (!n) return 0;
  let value = combinations[22 + n - 1][n - 1], previous = 1;
  for (let i = 0; i < n; i++) {
    const r = n - i;
    value += combinations[22 - previous + r][r] - combinations[22 - hand[i] + r][r];
    previous = hand[i];
  }
  return value;
}

export function createValueFeatures(module, pointer) {
  const header = new DataView(module.HEAPU8.buffer, pointer, 68);
  if (header.getUint32(0, true) !== 0x414c4556 || header.getUint32(4, true) !== 0x3456 ||
      header.getUint32(64, true) !== 24 || classes.length !== 22) throw Error("Unsupported value model");
  const four = pointer + 68, five = pointer + 64 + header.getUint32(8, true);
  return (state, q) => {
    const p = state.position, remaining = 100 - state.diceUsed, b = +state.bonusRoll;
    const hand = state.hand.map(id => idmap[id]).sort((a, b) => a - b);
    const features = new Float64Array(51);
    features.set([remaining, p, b, hand.length, q, 0, q - p]);
    for (const c of hand) features[6 + c]++;
    let deckCount = 0, deckSum = 0;
    for (let id = 1; id <= 30; id++) if (state.deckAvailable & (1 << (id - 1))) {
      features[28 + idmap[id]]++; deckCount++; deckSum += deckCoefficients[idmap[id]];
    }
    let phi = p;
    if (remaining > 0 || b) {
      const r = Math.min(remaining, 24), alpha = Math.min(1, (r + b) / 12);
      const data = new DataView(module.HEAPU8.buffer);
      const row = four + ((r * 2 + b) * 2899 + p) * 276 * 4;
      const row24 = four + ((48 + b) * 2899 + p) * 276 * 4;
      const v = c => data.getFloat32(row + c * 4, true);
      const w = c => data.getFloat32(row24 + c * 4, true);
      const zero = v(0) - alpha * w(0);
      let inventory = 0;
      for (const c of hand) inventory += (v(c) - v(0)) - alpha * (w(c) - w(0));
      for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
        const c = hand[i], d = hand[j], h = pairs[c][d];
        inventory += .75 * ((v(h) - v(c) - v(d) + v(0)) - alpha * (w(h) - w(c) - w(d) + w(0)));
      }
      const row5 = five + 24 + (b * 2899 + p) * (4 + 80730 * 2);
      const base = data.getFloat32(row5, true), delta = data.getInt16(row5 + 4 + rank(hand) * 2, true) / 32;
      const deckValue = .6 * Math.min(1, .7 * (r + b) / deckCount) * deckSum;
      phi = zero + .975 * inventory + alpha * (base + delta) + deckValue + 18 * Math.max(remaining - 24, 0);
    }
    features[5] = phi - q;
    return features;
  };
}
