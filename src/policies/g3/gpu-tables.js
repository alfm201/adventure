const X36_GPU_STAGE_BASE_LEN = 2898;
const X36_GPU_LUT_LEN = 2899;
const X36_GPU_NEXT_OFFSET = X36_GPU_STAGE_BASE_LEN;
const X36_GPU_LOCAL_OFFSET = X36_GPU_NEXT_OFFSET + X36_GPU_LUT_LEN;
const X36_GPU_SAME50_OFFSET = X36_GPU_LOCAL_OFFSET + X36_GPU_LUT_LEN;
const X36_GPU_FUTURE_P3_OFFSET = X36_GPU_SAME50_OFFSET + X36_GPU_LUT_LEN;
const X36_GPU_FUTURE_P3_LEN = 8 * X36_GPU_LUT_LEN;
function x36F32ToI32Bits(value) {
  const f = new Float32Array(1);
  const i = new Int32Array(f.buffer);
  f[0] = Math.fround(Number(value) || 0);
  return i[0];
}

function x36GpuCardQuality(cardType, cardValue) {
  const type = Number(cardType) || 0;
  const value = Number(cardValue) || 0;
  if (type === 1) return Math.max(-0.3, Math.min(1.3, value / 10));
  if (type === 2) return Math.min(1.5, value / 8);
  return 0.8;
}

function buildX36GpuLookupData(tables) {
  const next = new Float32Array(X36_GPU_LUT_LEN);
  const local = new Float32Array(X36_GPU_LUT_LEN);
  const same50 = new Int32Array(X36_GPU_LUT_LEN);
  const rollProjected = new Uint16Array(X36_GPU_LUT_LEN * 11);
  const rollGainsCard = new Uint8Array(X36_GPU_LUT_LEN * 11);
  let futureCardP3 = new Float32Array(X36_GPU_FUTURE_P3_LEN);
  const sid = (index) =>
    index < 0 || index >= X36_GPU_STAGE_BASE_LEN
      ? 0
      : Number(tables.stageId[index] || 0);
  const mov = (index) =>
    index < 0 || index >= X36_GPU_STAGE_BASE_LEN
      ? 0
      : Number(tables.stageMove[index] || 0);
  const evt = (index) =>
    index < 0 || index >= X36_GPU_STAGE_BASE_LEN
      ? 0
      : Number(tables.stageEvent[index] || 0);
  const diceWeight = (sum) =>
    sum === 2 || sum === 12
      ? 1
      : sum === 3 || sum === 11
        ? 2
        : sum === 4 || sum === 10
          ? 3
          : sum === 5 || sum === 9
            ? 4
            : sum === 6 || sum === 8
              ? 5
              : sum === 7
                ? 6
                : 0;

  const landing = (fromScore, rawValue, stop) => {
    let value = rawValue;
    if (stop) {
      const end = Math.min(2897, fromScore + value - 1);
      for (let i = fromScore; i < end; i++) {
        const eventType = evt(i);
        if (eventType === 6 || eventType === 9) {
          value = i - fromScore + 1;
          break;
        }
      }
    }
    return Math.min(2898, Math.max(1, fromScore + value));
  };

  const projected = (fromScore, rawValue, stop) => {
    let score = landing(fromScore, rawValue, stop);
    for (let guard = 0; guard < 16; guard++) {
      if (evt(score - 1) !== 4) break;
      score = Math.min(2898, score + mov(score - 1));
    }
    return score;
  };

  for (let score = 1; score <= X36_GPU_STAGE_BASE_LEN; score++) {
    let nextValue = 0;
    let localValue = 0;
    for (let diceSum = 2; diceSum <= 12; diceSum++) {
      const weight = diceWeight(diceSum);
      const land = landing(score, diceSum, true);
      const proj = projected(score, diceSum, true);
      const eventType = evt(land - 1);
      const rollIndex = score * 11 + diceSum - 2;
      rollProjected[rollIndex] = proj;
      if (eventType === 2 || (eventType === 4 && evt(proj - 1) === 2)) {
        nextValue += weight;
        rollGainsCard[rollIndex] = 1;
      }
      if (eventType === 2) {
        localValue += weight;
      } else if (eventType === 4) {
        localValue +=
          weight *
          (Math.max(0, mov(land - 1)) / 12 + (evt(proj - 1) === 2 ? 1 : 0));
      }
    }
    next[score] = nextValue / 36;
    local[score] = localValue / 36;

    let count = 0;
    for (
      let pos = Math.min(2897, score + 1);
      pos < Math.min(2897, score + 50);
      pos++
    ) {
      if (sid(pos) === sid(score - 1)) count++;
    }
    same50[score] = count;
  }

  const futureIndex = (remainingPaid, isDouble, score) =>
    (remainingPaid * 2 + isDouble) * X36_GPU_LUT_LEN + score;
  let previous = new Float32Array(X36_GPU_FUTURE_P3_LEN);
  for (let depth = 1; depth <= 3; depth++) {
    const current = new Float32Array(X36_GPU_FUTURE_P3_LEN);
    for (let remainingPaid = 0; remainingPaid <= 3; remainingPaid++) {
      for (let isDouble = 0; isDouble <= 1; isDouble++) {
        if (remainingPaid === 0 && isDouble === 0) continue;
        for (let score = 1; score <= X36_GPU_STAGE_BASE_LEN; score++) {
          let probability = 0;
          for (let die1 = 1; die1 <= 6; die1++) {
            for (let die2 = 1; die2 <= 6; die2++) {
              const rollIndex = score * 11 + die1 + die2 - 2;
              const proj = rollProjected[rollIndex];
              const gained = rollGainsCard[rollIndex] !== 0;
              const nextRemaining = isDouble
                ? remainingPaid
                : Math.max(0, remainingPaid - 1);
              const nextDouble = isDouble ? 0 : die1 === die2 ? 1 : 0;
              probability += gained
                ? 1
                : previous[futureIndex(nextRemaining, nextDouble, proj)];
            }
          }
          current[futureIndex(remainingPaid, isDouble, score)] =
            probability / 36;
        }
      }
    }
    previous = current;
    if (depth === 3) futureCardP3 = current;
  }

  const packedStageId = new Int32Array(
    X36_GPU_FUTURE_P3_OFFSET + X36_GPU_FUTURE_P3_LEN,
  );
  for (let i = 0; i < X36_GPU_STAGE_BASE_LEN; i++) {
    packedStageId[i] = Number(tables.stageId[i] || 0);
  }
  for (let i = 0; i < X36_GPU_LUT_LEN; i++) {
    packedStageId[X36_GPU_NEXT_OFFSET + i] = x36F32ToI32Bits(next[i]);
    packedStageId[X36_GPU_LOCAL_OFFSET + i] = x36F32ToI32Bits(local[i]);
    packedStageId[X36_GPU_SAME50_OFFSET + i] = same50[i];
  }
  for (let i = 0; i < futureCardP3.length; i++) {
    packedStageId[X36_GPU_FUTURE_P3_OFFSET + i] = x36F32ToI32Bits(
      futureCardP3[i],
    );
  }
  return packedStageId;
}

function wgslFloatLiteral(value) {
  const n = Math.fround(Number(value) || 0);
  if (!Number.isFinite(n)) return "0.0";
  let result = String(n);
  if (!/[.eE]/.test(result)) result += ".0";
  return result;
}

function buildX36PoolQualityWgsl(tables) {
  const groups = new Map();
  let totalQuality = 0;

  for (let cardId = 1; cardId <= 30; cardId++) {
    const quality = Math.fround(
      x36GpuCardQuality(tables.cardType[cardId], tables.cardValue[cardId]),
    );
    totalQuality += quality;
    const key = wgslFloatLiteral(quality);
    const entry = groups.get(key) || { quality: key, mask: 0 };
    entry.mask = (entry.mask | ((1 << (cardId - 1)) >>> 0)) >>> 0;
    groups.set(key, entry);
  }

  const terms = [...groups.values()]
    .map(
      (entry) =>
        `  total = total - f32(countOneBits(mask & 0x${entry.mask.toString(16)}u)) * ${entry.quality};`,
    )
    .join("\n");

  return `
const X36_TOTAL_CARD_QUALITY: f32 = ${wgslFloatLiteral(totalQuality)};

fn pool_quality_x36(obtained: u32) -> f32 {
  let mask = obtained & 0x3fffffffu;
  let remaining = 30u - countOneBits(mask);
  if (remaining == 0u) { return 0.0; }
  var total = X36_TOTAL_CARD_QUALITY;
${terms}
  return total / f32(remaining);
}
`;
}

export { buildX36GpuLookupData, buildX36PoolQualityWgsl };
