const $ = id => document.getElementById(id);
const GPU_WORKGROUP_SIZE = 64;
const GPU_PARTIAL_STRIDE = 5;

const X36_GPU_STAGE_BASE_LEN = 2898;
const X36_GPU_LUT_LEN = 2899;
const X36_GPU_NEXT_OFFSET = X36_GPU_STAGE_BASE_LEN;
const X36_GPU_LOCAL_OFFSET = X36_GPU_NEXT_OFFSET + X36_GPU_LUT_LEN;
const X36_GPU_SAME50_OFFSET = X36_GPU_LOCAL_OFFSET + X36_GPU_LUT_LEN;

function log(line) {
  if ($('log')) $('log').textContent += `${line}\n`;
}

function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

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
  const sid = index => index < 0 || index >= X36_GPU_STAGE_BASE_LEN ? 0 : Number(tables.stageId[index] || 0);
  const mov = index => index < 0 || index >= X36_GPU_STAGE_BASE_LEN ? 0 : Number(tables.stageMove[index] || 0);
  const evt = index => index < 0 || index >= X36_GPU_STAGE_BASE_LEN ? 0 : Number(tables.stageEvent[index] || 0);
  const diceWeight = sum => (
    sum === 2 || sum === 12 ? 1
      : sum === 3 || sum === 11 ? 2
        : sum === 4 || sum === 10 ? 3
          : sum === 5 || sum === 9 ? 4
            : sum === 6 || sum === 8 ? 5
              : sum === 7 ? 6 : 0
  );

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
      if (eventType === 2 || (eventType === 4 && evt(proj - 1) === 2)) {
        nextValue += weight;
      }
      if (eventType === 2) {
        localValue += weight;
      } else if (eventType === 4) {
        localValue += weight * (
          Math.max(0, mov(land - 1)) / 12
          + (evt(proj - 1) === 2 ? 1 : 0)
        );
      }
    }
    next[score] = nextValue / 36;
    local[score] = localValue / 36;

    let count = 0;
    for (let pos = Math.min(2897, score + 1); pos < Math.min(2897, score + 50); pos++) {
      if (sid(pos) === sid(score - 1)) count++;
    }
    same50[score] = count;
  }

  const packedStageId = new Int32Array(
    X36_GPU_STAGE_BASE_LEN + X36_GPU_LUT_LEN * 3
  );
  for (let i = 0; i < X36_GPU_STAGE_BASE_LEN; i++) {
    packedStageId[i] = Number(tables.stageId[i] || 0);
  }
  for (let i = 0; i < X36_GPU_LUT_LEN; i++) {
    packedStageId[X36_GPU_NEXT_OFFSET + i] = x36F32ToI32Bits(next[i]);
    packedStageId[X36_GPU_LOCAL_OFFSET + i] = x36F32ToI32Bits(local[i]);
    packedStageId[X36_GPU_SAME50_OFFSET + i] = same50[i];
  }
  return packedStageId;
}

function wgslFloatLiteral(value) {
  const n = Math.fround(Number(value) || 0);
  if (!Number.isFinite(n)) return '0.0';
  let result = String(n);
  if (!/[.eE]/.test(result)) result += '.0';
  return result;
}

function buildX36PoolQualityWgsl(tables) {
  const groups = new Map();
  let totalQuality = 0;

  for (let cardId = 1; cardId <= 30; cardId++) {
    const quality = Math.fround(x36GpuCardQuality(tables.cardType[cardId], tables.cardValue[cardId]));
    totalQuality += quality;
    const key = wgslFloatLiteral(quality);
    const entry = groups.get(key) || { quality: key, mask: 0 };
    entry.mask = (entry.mask | ((1 << (cardId - 1)) >>> 0)) >>> 0;
    groups.set(key, entry);
  }

  const terms = [...groups.values()].map(entry => (
    `  total = total - f32(countOneBits(mask & 0x${entry.mask.toString(16)}u)) * ${entry.quality};`
  )).join('\n');

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

function shaderSource(tables) {
  const poolQualityWgsl = buildX36PoolQualityWgsl(tables);
  return `
struct Params {
  rolloutCount: u32,
  action: u32,
  seed: u32,
  maxSteps: u32,
  actionCount: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
}

@group(0) @binding(0) var<storage, read> stageId: array<i32>;
@group(0) @binding(1) var<storage, read> stageMove: array<i32>;
@group(0) @binding(2) var<storage, read> stageEvent: array<i32>;
@group(0) @binding(3) var<storage, read> cardType: array<i32>;
@group(0) @binding(4) var<storage, read> cardValue: array<i32>;
@group(0) @binding(5) var<storage, read> inputState: array<i32>;
@group(0) @binding(6) var<storage, read_write> partials: array<u32>;
@group(0) @binding(7) var<uniform> params: Params;

const WORKGROUP_SIZE = 64u;
const PARTIAL_STRIDE = 5u;

const X36_NEXT_OFFSET: u32 = 2898u;
const X36_LOCAL_OFFSET: u32 = 5797u;
const X36_SAME50_OFFSET: u32 = 8696u;

const X36_WEIGHT_SCALE: i32 = 1000;
const W_ROLL_CARD: i32 = 234154;
const W_ROLL_JUMP: i32 = 2474;
const W_ROLL_JUMP_CARD: i32 = 187074;
const W_HAND_PRESSURE: i32 = 96072;
const W_LATE_BONUS: i32 = 4423;
const W_LATE_THRESHOLD: i32 = 70000;
const W_MOVE_COST: i32 = 79155;
const W_MOVE_CARD: i32 = 137845;
const W_MOVE_JUMP: i32 = 2733;
const W_MOVE_JUMP_CARD: i32 = 83176;
const W_CHAIN: i32 = 36783;
const W_MULT_COST: i32 = 18355;
const W_MULT_CARD: i32 = 128161;
const W_MULT_JUMP: i32 = 2787;
const W_MULT_JUMP_CARD: i32 = 83883;
const W_STAGE_COST: i32 = 4550;
const W_STAGE_SAME50: i32 = 1740;
const W_STAGE_JUMP: i32 = 2000;
const W_HAND_QUALITY_RETENTION: i32 = 102989;
const W_NEXT_CARD_PRESSURE: i32 = -30000;
const W_TERMINAL_CONTINUOUS: i32 = -176;
const W_CHAIN_LATE_PENALTY: i32 = 17906;
const W_STAGE_ALT_MOVE_PENALTY: i32 = 2372;
const W_STAGE_ACTUAL_MOVE: i32 = 485;
const W_STAGE_DESTINATION: i32 = -43919;
const W_POOL_QUALITY_CARD: i32 = 325;

fn x36_w(value: i32) -> f32 {
  return f32(value);
}

fn next_rand(rng: ptr<function, u32>) -> u32 {
  var t = (*rng) + 0x6D2B79F5u;
  (*rng) = t;
  var r = (t ^ (t >> 15u)) * (1u | t);
  r = r ^ (r + ((r ^ (r >> 7u)) * 61u));
  return r ^ (r >> 14u);
}

var<private> boundedWord: u32;
var<private> boundedBits: u32;

fn bounded_bits_for(bound: u32) -> u32 {
  if (bound <= 1u) { return 0u; }
  if (bound <= 2u) { return 1u; }
  if (bound <= 4u) { return 2u; }
  if (bound <= 8u) { return 3u; }
  if (bound <= 16u) { return 4u; }
  return 5u;
}

fn next_bounded(rng: ptr<function, u32>, bound: u32) -> u32 {
  if (bound <= 1u) { return 0u; }
  let bits = bounded_bits_for(bound);
  let mask = (1u << bits) - 1u;
  loop {
    if (boundedBits < bits) {
      boundedWord = next_rand(rng);
      boundedBits = 32u;
    }
    let candidate = boundedWord & mask;
    boundedWord = boundedWord >> bits;
    boundedBits = boundedBits - bits;
    if (candidate < bound) { return candidate; }
  }
}

fn stage_id_at(index: i32) -> i32 {
  if (index < 0 || index >= 2898) { return 0; }
  return stageId[u32(index)];
}

fn stage_move_at(index: i32) -> i32 {
  if (index < 0 || index >= 2898) { return 0; }
  return stageMove[u32(index)];
}

fn stage_event_at(index: i32) -> i32 {
  if (index < 0 || index >= 2898) { return 0; }
  return stageEvent[u32(index)];
}

fn x36_score_index(score: i32) -> u32 {
  return u32(clamp(score, 1, 2898));
}

fn next_card_probability_x36(score: i32) -> f32 {
  return bitcast<f32>(stageId[X36_NEXT_OFFSET + x36_score_index(score)]);
}

fn local_quality_x36(score: i32) -> f32 {
  return bitcast<f32>(stageId[X36_LOCAL_OFFSET + x36_score_index(score)]);
}

fn same_stage_count50(score: i32) -> i32 {
  return stageId[X36_SAME50_OFFSET + x36_score_index(score)];
}

${poolQualityWgsl}

fn static_card_quality_x36(cardId: i32) -> f32 {
  if (cardId <= 0 || cardId > 30) { return 0.0; }
  let cType = cardType[u32(cardId)];
  let cValue = f32(cardValue[u32(cardId)]);
  if (cType == 1) { return clamp(cValue / 10.0, -0.3, 1.3); }
  if (cType == 2) { return min(1.5, cValue / 8.0); }
  return 0.8;
}

fn hand_quality_x36(
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
) -> f32 {
  if (handCount <= 0) { return 0.0; }
  var total: f32 = 0.0;
  for (var i = 0; i < handCount; i = i + 1) {
    total = total + static_card_quality_x36((*hand)[u32(i)]);
  }
  return total / f32(handCount);
}

fn positive_move_count_x36(
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
) -> i32 {
  var count = 0;
  for (var i = 0; i < handCount; i = i + 1) {
    let cardId = u32((*hand)[u32(i)]);
    if (cardType[cardId] == 1 && cardValue[cardId] > 0) {
      count = count + 1;
    }
  }
  return count;
}

fn roll_dice(
  diceUse: ptr<function, i32>,
  isDouble: ptr<function, i32>,
  rng: ptr<function, u32>,
) -> i32 {
  let val1 = i32(next_bounded(rng, 6u)) + 1;
  let val2 = i32(next_bounded(rng, 6u)) + 1;
  if ((*isDouble) != 0) {
    (*isDouble) = 0;
  } else {
    (*isDouble) = select(0, 1, val1 == val2);
    (*diceUse) = (*diceUse) + 1;
  }
  return val1 + val2;
}

fn draw_card(
  hand: ptr<function, array<i32, 5>>,
  handCount: ptr<function, i32>,
  obtained: ptr<function, u32>,
  rng: ptr<function, u32>,
) {
  if ((*handCount) >= 5) { return; }
  var remaining = 0u;
  for (var i = 0u; i < 30u; i = i + 1u) {
    if (((*obtained) & (1u << i)) == 0u) {
      remaining = remaining + 1u;
    }
  }
  if (remaining == 0u) {
    (*obtained) = 0u;
    remaining = 30u;
  }

  let pickedOffset = next_bounded(rng, remaining);
  var seen = 0u;
  var picked = 0u;
  for (var i = 0u; i < 30u; i = i + 1u) {
    if (((*obtained) & (1u << i)) == 0u) {
      if (seen == pickedOffset) {
        picked = i;
        break;
      }
      seen = seen + 1u;
    }
  }

  (*obtained) = (*obtained) | (1u << picked);
  if ((*handCount) < 5) {
    (*hand)[u32((*handCount))] = i32(picked) + 1;
    (*handCount) = (*handCount) + 1;
  }
  if (remaining == 1u) {
    (*obtained) = 0u;
  }
}

fn update_score(
  score: ptr<function, i32>,
  diceUse: ptr<function, i32>,
  isDouble: ptr<function, i32>,
  hand: ptr<function, array<i32, 5>>,
  handCount: ptr<function, i32>,
  obtained: ptr<function, u32>,
  rng: ptr<function, u32>,
  rawValue: i32,
  stop: bool,
) {
  var value = rawValue;
  if (stop) {
    let endIndex = min(2897, (*score) + value - 1);
    for (var i = (*score); i < endIndex; i = i + 1) {
      let eventType = stage_event_at(i);
      if (eventType == 6 || eventType == 9) {
        value = i - (*score) + 1;
        break;
      }
    }
  }

  (*score) = min(2898, (*score) + value);

  for (var guard = 0; guard < 16; guard = guard + 1) {
    let eventType = stage_event_at((*score) - 1);
    if (eventType == 2) {
      draw_card(hand, handCount, obtained, rng);
      break;
    }
    if (eventType == 4) {
      (*score) = min(2898, (*score) + stage_move_at((*score) - 1));
      continue;
    }
    break;
  }
}

fn remove_hand(hand: ptr<function, array<i32, 5>>, handCount: ptr<function, i32>, slot: i32) -> i32 {
  let cardId = (*hand)[u32(slot)];
  for (var i = slot; i < 4; i = i + 1) {
    (*hand)[u32(i)] = (*hand)[u32(i + 1)];
  }
  (*hand)[4] = 0;
  (*handCount) = max(0, (*handCount) - 1);
  return cardId;
}

fn use_card(
  score: ptr<function, i32>,
  diceUse: ptr<function, i32>,
  isDouble: ptr<function, i32>,
  hand: ptr<function, array<i32, 5>>,
  handCount: ptr<function, i32>,
  obtained: ptr<function, u32>,
  rng: ptr<function, u32>,
  action: u32,
) {
  if (action == 0u || i32(action) > (*handCount)) { return; }
  let cardId = remove_hand(hand, handCount, i32(action) - 1);
  let cType = cardType[u32(cardId)];
  let cValue = cardValue[u32(cardId)];
  if (cType == 1) {
    update_score(score, diceUse, isDouble, hand, handCount, obtained, rng, cValue, false);
  } else if (cType == 2) {
    let roll = roll_dice(diceUse, isDouble, rng);
    update_score(score, diceUse, isDouble, hand, handCount, obtained, rng, roll * cValue, false);
  } else if (cType == 3) {
    update_score(score, diceUse, isDouble, hand, handCount, obtained, rng, stage_card_move((*score), cValue), false);
  }
}

fn raw_landing_after_move(score: i32, rawValue: i32, stop: bool) -> i32 {
  var value = rawValue;
  if (stop) {
    let endIndex = min(2897, score + value - 1);
    for (var i = score; i < endIndex; i = i + 1) {
      let eventType = stage_event_at(i);
      if (eventType == 6 || eventType == 9) {
        value = i - score + 1;
        break;
      }
    }
  }
  return min(2898, max(1, score + value));
}

fn projected_score_after_move(score: i32, rawValue: i32, stop: bool) -> i32 {
  var projected = raw_landing_after_move(score, rawValue, stop);
  for (var guard = 0; guard < 16; guard = guard + 1) {
    let eventType = stage_event_at(projected - 1);
    if (eventType == 4) {
      projected = min(2898, projected + stage_move_at(projected - 1));
      continue;
    }
    break;
  }
  return projected;
}

fn stage_card_move(score: i32, cValue: i32) -> i32 {
  let targetStage = stage_id_at(score - 1) + cValue;
  var value = targetStage;
  for (var i = score; i < 2897; i = i + 1) {
    if (stage_id_at(i) == targetStage) {
      value = i - score + 1;
      break;
    }
  }
  return value;
}

fn dice_sum_weight(sum: i32) -> i32 {
  if (sum == 2 || sum == 12) { return 1; }
  if (sum == 3 || sum == 11) { return 2; }
  if (sum == 4 || sum == 10) { return 3; }
  if (sum == 5 || sum == 9) { return 4; }
  if (sum == 6 || sum == 8) { return 5; }
  if (sum == 7) { return 6; }
  return 0;
}

fn card_or_jump_card_option(landing: i32, projected: i32) -> bool {
  let eventType = stage_event_at(landing - 1);
  if (eventType == 2) { return true; }
  return eventType == 4 && projected >= 1 && projected <= 2898 && stage_event_at(projected - 1) == 2;
}

fn move_chain_card_option(score: i32, action: u32, hand: ptr<function, array<i32, 5>>, handCount: i32) -> bool {
  if (action == 0u || i32(action) > handCount) { return false; }
  let cardId = u32((*hand)[action - 1u]);
  if (cardType[cardId] != 1) { return false; }
  let firstValue = cardValue[cardId];
  let firstLanding = raw_landing_after_move(score, firstValue, false);
  let firstProjected = projected_score_after_move(score, firstValue, false);
  if (stage_event_at(firstLanding - 1) == 4 && card_or_jump_card_option(firstLanding, firstProjected)) {
    return true;
  }
  for (var i = 0; i < handCount; i = i + 1) {
    if (u32(i) == action - 1u) { continue; }
    let nextCardId = u32((*hand)[u32(i)]);
    if (cardType[nextCardId] == 1) {
      let nextValue = cardValue[nextCardId];
      let secondLanding = raw_landing_after_move(firstProjected, nextValue, false);
      let secondProjected = projected_score_after_move(firstProjected, nextValue, false);
      if (card_or_jump_card_option(secondLanding, secondProjected)) { return true; }
    }
  }
  return false;
}

fn current_best_roll_value_x36(score: i32, handCount: i32, obtained: u32) -> f32 {
  let canGainCard = handCount < 5;
  let poolQ = pool_quality_x36(obtained);
  var total: f32 = 0.0;
  for (var diceSum = 2; diceSum <= 12; diceSum = diceSum + 1) {
    let landing = raw_landing_after_move(score, diceSum, true);
    let projected = projected_score_after_move(score, diceSum, true);
    let eventType = stage_event_at(landing - 1);
    let dw = f32(dice_sum_weight(diceSum));
    if (eventType == 2 && canGainCard) {
      total = total + dw * (x36_w(W_ROLL_CARD) + (poolQ - 0.75) * x36_w(W_POOL_QUALITY_CARD));
    } else if (eventType == 4) {
      total = total + dw * f32(max(0, stage_move_at(landing - 1))) * x36_w(W_ROLL_JUMP);
      if (canGainCard && stage_event_at(projected - 1) == 2) {
        total = total + dw * (x36_w(W_ROLL_JUMP_CARD) + (poolQ - 0.75) * x36_w(W_POOL_QUALITY_CARD));
      }
    }
  }
  return total;
}

fn current_best_card_post_x36(
  score: i32,
  diceUse: i32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
) -> f32 {
  var value: f32 = 0.0;
  if (handCount == 5 || diceUse + handCount >= 100) {
    value = value + 36.0 * x36_w(W_HAND_PRESSURE);
  }
  if (diceUse >= 70) {
    value = value + 36.0 * x36_w(W_LATE_BONUS);
  }
  if (handCount == 5) {
    value = value - 36.0 * hand_quality_x36(hand, handCount) * x36_w(W_HAND_QUALITY_RETENTION);
    value = value + 36.0 * next_card_probability_x36(score) * x36_w(W_NEXT_CARD_PRESSURE);
  }
  let terminalT = clamp(f32(diceUse) / 100.0, 0.0, 1.0);
  value = value + 36.0 * terminalT * terminalT * terminalT * terminalT * x36_w(W_TERMINAL_CONTINUOUS);
  return value;
}

fn current_best_move_value_x36(
  score: i32,
  diceUse: i32,
  action: u32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  cValue: i32,
) -> f32 {
  let landing = raw_landing_after_move(score, cValue, false);
  let eventType = stage_event_at(landing - 1);
  var total = current_best_card_post_x36(score, diceUse, hand, handCount) - 36.0 * x36_w(W_MOVE_COST);
  if (eventType == 2) {
    total = total + 36.0 * x36_w(W_MOVE_CARD);
  } else if (eventType == 4) {
    total = total + 36.0 * f32(max(0, stage_move_at(landing - 1))) * x36_w(W_MOVE_JUMP);
    let projected = projected_score_after_move(score, cValue, false);
    if (stage_event_at(projected - 1) == 2) {
      total = total + 36.0 * x36_w(W_MOVE_JUMP_CARD);
    }
  }
  if (move_chain_card_option(score, action, hand, handCount)) {
    total = total + 36.0 * x36_w(W_CHAIN);
    let late = max(0.0, (f32(diceUse) - 70.0) / 30.0);
    total = total - 36.0 * late * x36_w(W_CHAIN_LATE_PENALTY);
  }
  return total;
}

fn current_best_mult_value_x36(
  score: i32,
  diceUse: i32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  cValue: i32,
) -> f32 {
  var total = current_best_card_post_x36(score, diceUse, hand, handCount) - 36.0 * x36_w(W_MULT_COST);
  for (var diceSum = 2; diceSum <= 12; diceSum = diceSum + 1) {
    let rawValue = diceSum * cValue;
    let landing = raw_landing_after_move(score, rawValue, false);
    let projected = projected_score_after_move(score, rawValue, false);
    let eventType = stage_event_at(landing - 1);
    let dw = f32(dice_sum_weight(diceSum));
    if (eventType == 2) {
      total = total + dw * x36_w(W_MULT_CARD);
    } else if (eventType == 4) {
      total = total + dw * f32(max(0, stage_move_at(landing - 1))) * x36_w(W_MULT_JUMP);
      if (stage_event_at(projected - 1) == 2) {
        total = total + dw * x36_w(W_MULT_JUMP_CARD);
      }
    }
  }
  return total;
}

fn current_best_stage_value_x36(
  score: i32,
  diceUse: i32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  cValue: i32,
  positiveMoveCount: i32,
) -> f32 {
  let rawValue = stage_card_move(score, cValue);
  let landing = raw_landing_after_move(score, rawValue, false);
  let projected = projected_score_after_move(score, rawValue, false);
  var total = current_best_card_post_x36(score, diceUse, hand, handCount) - 36.0 * x36_w(W_STAGE_COST);
  total = total + 36.0 * f32(same_stage_count50(score)) * x36_w(W_STAGE_SAME50);
  if (stage_event_at(landing - 1) == 4) {
    total = total + 36.0 * f32(max(0, stage_move_at(landing - 1))) * x36_w(W_STAGE_JUMP);
  }
  total = total - 36.0 * f32(positiveMoveCount) * x36_w(W_STAGE_ALT_MOVE_PENALTY);
  total = total + 36.0 * f32(max(0, projected - score)) * x36_w(W_STAGE_ACTUAL_MOVE);
  total = total + 36.0 * local_quality_x36(projected) * x36_w(W_STAGE_DESTINATION);
  return total;
}

fn current_best_card_value_x36(
  score: i32,
  diceUse: i32,
  action: u32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  positiveMoveCount: i32,
) -> f32 {
  let cardId = u32((*hand)[action - 1u]);
  let cType = cardType[cardId];
  let cValue = cardValue[cardId];
  if (cType == 1) { return current_best_move_value_x36(score, diceUse, action, hand, handCount, cValue); }
  if (cType == 2) { return current_best_mult_value_x36(score, diceUse, hand, handCount, cValue); }
  if (cType == 3) { return current_best_stage_value_x36(score, diceUse, hand, handCount, cValue, positiveMoveCount); }
  return -3.402823466e+38;
}

fn choose_action(
  score: i32,
  diceUse: i32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  obtained: u32,
) -> u32 {
  var bestAction = 0u;
  var bestValue = current_best_roll_value_x36(score, handCount, obtained);
  if (handCount <= 0) { return 0u; }
  let positiveMoveCount = positive_move_count_x36(hand, handCount);
  let actionCount = u32(handCount + 1);
  for (var action = 1u; action < actionCount; action = action + 1u) {
    let value = current_best_card_value_x36(score, diceUse, action, hand, handCount, positiveMoveCount);
    if (value > bestValue) {
      bestValue = value;
      bestAction = action;
    }
  }
  return bestAction;
}

fn step_once(
  score: ptr<function, i32>,
  diceUse: ptr<function, i32>,
  isDouble: ptr<function, i32>,
  hand: ptr<function, array<i32, 5>>,
  handCount: ptr<function, i32>,
  obtained: ptr<function, u32>,
  rng: ptr<function, u32>,
  action: u32,
) -> bool {
  if ((*diceUse) >= 100 && (*isDouble) == 0) {
    return true;
  }
  if (action == 0u) {
    let roll = roll_dice(diceUse, isDouble, rng);
    update_score(score, diceUse, isDouble, hand, handCount, obtained, rng, roll, true);
  } else {
    use_card(score, diceUse, isDouble, hand, handCount, obtained, rng, action);
  }
  return (*diceUse) >= 100 && (*isDouble) == 0;
}

var<workgroup> partialCount: array<u32, 64>;
var<workgroup> partialSum: array<u32, 64>;
var<workgroup> partialSumSq: array<u32, 64>;
var<workgroup> partialMin: array<u32, 64>;
var<workgroup> partialMax: array<u32, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(workgroup_id) workgroupId: vec3<u32>,
) {
  let lane = localId.x;
  let rolloutIndex = workgroupId.x * WORKGROUP_SIZE + lane;
  let actionIndex = select(params.action, workgroupId.y, params.mode == 1u);

  var rng = params.seed + rolloutIndex * 747796405u + actionIndex * 9173u + 2891336453u;
  boundedWord = 0u;
  boundedBits = 0u;
  var score = inputState[2];
  var diceUse = inputState[5];
  var isDouble = inputState[6];
  var hand = array<i32, 5>(
    inputState[7],
    inputState[8],
    inputState[9],
    inputState[10],
    inputState[11],
  );
  var handCount = 0;
  for (var i = 0; i < 5; i = i + 1) {
    if (hand[u32(i)] != 0) {
      handCount = handCount + 1;
    }
  }
  var obtained = 0u;
  for (var i = 0u; i < 30u; i = i + 1u) {
    if (inputState[12u + i] != 0) {
      obtained = obtained | (1u << i);
    }
  }

  if (rolloutIndex < params.rolloutCount) {
    var done = step_once(&score, &diceUse, &isDouble, &hand, &handCount, &obtained, &rng, actionIndex);
    for (var step = 0u; step < params.maxSteps; step = step + 1u) {
      if (done) { break; }
      let action = choose_action(score, diceUse, &hand, handCount, obtained);
      done = step_once(&score, &diceUse, &isDouble, &hand, &handCount, &obtained, &rng, action);
    }
    let scoreValue = u32(score);
    partialCount[lane] = 1u;
    partialSum[lane] = scoreValue;
    partialSumSq[lane] = scoreValue * scoreValue;
    partialMin[lane] = scoreValue;
    partialMax[lane] = scoreValue;
  } else {
    partialCount[lane] = 0u;
    partialSum[lane] = 0u;
    partialSumSq[lane] = 0u;
    partialMin[lane] = 4294967295u;
    partialMax[lane] = 0u;
  }

  workgroupBarrier();

  for (var offset = WORKGROUP_SIZE / 2u; offset > 0u; offset = offset / 2u) {
    if (lane < offset) {
      partialCount[lane] = partialCount[lane] + partialCount[lane + offset];
      partialSum[lane] = partialSum[lane] + partialSum[lane + offset];
      partialSumSq[lane] = partialSumSq[lane] + partialSumSq[lane + offset];
      partialMin[lane] = min(partialMin[lane], partialMin[lane + offset]);
      partialMax[lane] = max(partialMax[lane], partialMax[lane + offset]);
    }
    workgroupBarrier();
  }

  if (lane == 0u) {
    let workgroupsPerAction = (params.rolloutCount + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
    let actionOffset = select(0u, workgroupId.y * workgroupsPerAction, params.mode == 1u);
    let base = (actionOffset + workgroupId.x) * PARTIAL_STRIDE;
    partials[base + 0u] = partialCount[0];
    partials[base + 1u] = partialSum[0];
    partials[base + 2u] = partialSumSq[0];
    partials[base + 3u] = select(0u, partialMin[0], partialCount[0] > 0u);
    partials[base + 4u] = partialMax[0];
  }
}
`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  return response.json();
}

function createStorageBuffer(device, typedArray, usage = GPUBufferUsage.STORAGE) {
  const buffer = device.createBuffer({
    size: Math.max(4, typedArray.byteLength),
    usage: usage | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, typedArray);
  return buffer;
}

let gpuContextPromise = null;

function resetGpuContext() {
  gpuContextPromise = null;
}

async function getGpuContext(tables) {
  if (gpuContextPromise) return gpuContextPromise;
  gpuContextPromise = (async () => {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not available. Use a Chromium browser with WebGPU enabled.');
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter was found.');
    const device = await adapter.requestDevice();
    const shader = device.createShaderModule({ code: shaderSource(tables) });
    const pipelineDescriptor = {
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    };
    const pipeline = typeof device.createComputePipelineAsync === 'function'
      ? await device.createComputePipelineAsync(pipelineDescriptor)
      : device.createComputePipeline(pipelineDescriptor);
    const packedStageId = buildX36GpuLookupData(tables);
    return {
      adapter,
      device,
      pipeline,
      stageId: createStorageBuffer(device, packedStageId),
      stageMove: createStorageBuffer(device, new Int32Array(tables.stageMove)),
      stageEvent: createStorageBuffer(device, new Int32Array(tables.stageEvent)),
      cardType: createStorageBuffer(device, new Int32Array(tables.cardType)),
      cardValue: createStorageBuffer(device, new Int32Array(tables.cardValue)),
    };
  })();
  return gpuContextPromise;
}

async function submitAndReadU32({ device, encoder, readBuffer, started }) {
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
  await readBuffer.mapAsync(GPUMapMode.READ);
  const values = new Uint32Array(readBuffer.getMappedRange()).slice();
  readBuffer.unmap();
  return {
    values,
    elapsedMs: performance.now() - started,
  };
}

function summaryFromPartials(partials, recordOffset, recordCount) {
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let record = 0; record < recordCount; record++) {
    const base = (recordOffset + record) * GPU_PARTIAL_STRIDE;
    const partialCount = partials[base];
    if (partialCount === 0) continue;
    count += partialCount;
    sum += partials[base + 1];
    sumSq += partials[base + 2];
    min = Math.min(min, partials[base + 3]);
    max = Math.max(max, partials[base + 4]);
  }
  if (count === 0) return { count: 0, mean: 0, std: 0, min: 0, max: 0 };
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  return { count, mean, std: Math.sqrt(variance), min, max };
}

async function runGpuPartial(context, { sample, action, rolloutCount, seed }) {
  const { adapter, device, pipeline, stageId, stageMove, stageEvent, cardType, cardValue } = context;
  const inputState = createStorageBuffer(device, new Int32Array(sample.state));
  const workgroupsPerAction = Math.ceil(rolloutCount / GPU_WORKGROUP_SIZE);
  const recordCount = workgroupsPerAction;
  const byteLength = recordCount * GPU_PARTIAL_STRIDE * Uint32Array.BYTES_PER_ELEMENT;
  const partialBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const params = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(params, 0, new Uint32Array([rolloutCount, action, seed >>> 0, 512, 1, 0, 0, 0]));

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stageId } },
      { binding: 1, resource: { buffer: stageMove } },
      { binding: 2, resource: { buffer: stageEvent } },
      { binding: 3, resource: { buffer: cardType } },
      { binding: 4, resource: { buffer: cardValue } },
      { binding: 5, resource: { buffer: inputState } },
      { binding: 6, resource: { buffer: partialBuffer } },
      { binding: 7, resource: { buffer: params } },
    ],
  });

  const started = performance.now();
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroupsPerAction);
  pass.end();
  encoder.copyBufferToBuffer(partialBuffer, 0, readBuffer, 0, byteLength);
  const readResult = await submitAndReadU32({ device, encoder, readBuffer, started });
  const summary = summaryFromPartials(readResult.values, 0, recordCount);

  inputState.destroy();
  partialBuffer.destroy();
  readBuffer.destroy();
  params.destroy();

  return { ...summary, elapsedMs: readResult.elapsedMs, adapterInfo: adapter.info };
}

async function runGpuAllActionsPartial(context, { sample, rolloutCount, seed }) {
  const { adapter, device, pipeline, stageId, stageMove, stageEvent, cardType, cardValue } = context;
  const actionCount = sample.actionCount;
  const inputState = createStorageBuffer(device, new Int32Array(sample.state));
  const workgroupsPerAction = Math.ceil(rolloutCount / GPU_WORKGROUP_SIZE);
  const recordCount = workgroupsPerAction * actionCount;
  const byteLength = recordCount * GPU_PARTIAL_STRIDE * Uint32Array.BYTES_PER_ELEMENT;
  const partialBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readBuffer = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const params = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(params, 0, new Uint32Array([rolloutCount, 0, seed >>> 0, 512, actionCount, 1, 0, 0]));

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stageId } },
      { binding: 1, resource: { buffer: stageMove } },
      { binding: 2, resource: { buffer: stageEvent } },
      { binding: 3, resource: { buffer: cardType } },
      { binding: 4, resource: { buffer: cardValue } },
      { binding: 5, resource: { buffer: inputState } },
      { binding: 6, resource: { buffer: partialBuffer } },
      { binding: 7, resource: { buffer: params } },
    ],
  });

  const started = performance.now();
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroupsPerAction, actionCount);
  pass.end();
  encoder.copyBufferToBuffer(partialBuffer, 0, readBuffer, 0, byteLength);
  const readResult = await submitAndReadU32({ device, encoder, readBuffer, started });
  const summaries = [];
  for (let action = 0; action < actionCount; action++) {
    summaries.push({
      action,
      ...summaryFromPartials(readResult.values, action * workgroupsPerAction, workgroupsPerAction),
    });
  }
  const bestAction = summaries.reduce((best, summary) => (summary.mean > summaries[best].mean ? summary.action : best), 0);

  inputState.destroy();
  partialBuffer.destroy();
  readBuffer.destroy();
  params.destroy();

  return {
    actionCount,
    rolloutCount,
    summaries,
    bestAction,
    elapsedMs: readResult.elapsedMs,
    rolloutsPerSecond: (rolloutCount * actionCount) / (readResult.elapsedMs / 1000),
    adapterInfo: adapter.info,
  };
}

async function prepareGpuReadbackMode({ tables }) {
  await getGpuContext(tables);
  return 'partial';
}

async function runGpu({ tables, sample, action, rolloutCount, seed }) {
  const context = await getGpuContext(tables);
  return runGpuPartial(context, { sample, action, rolloutCount, seed });
}

async function runGpuAllActions({ tables, sample, rolloutCount, seed }) {
  const context = await getGpuContext(tables);
  return runGpuAllActionsPartial(context, { sample, rolloutCount, seed });
}

async function run({ clear = true } = {}) {
  $('run').disabled = true;
  if (clear) $('log').textContent = '';
  $('gpuMean').textContent = '-';
  $('cpuMean').textContent = '-';
  $('gpuSub').textContent = '';
  $('cpuSub').textContent = '';

  try {
    const mode = $('mode').value;
    const seed = Number($('seed').value);
    const action = Number($('action').value);
    const rolloutCount = Number($('rollouts').value);
    const cpuIterations = Number($('cpuIterations').value);

    log('Loading local stage/card tables...');
    const [tables, sample] = await Promise.all([
      fetchJson('/api/tables'),
      fetchJson(`/api/sample-state?mode=${encodeURIComponent(mode)}&seed=${seed}`),
    ]);
    $('stateSummary').textContent =
      `score=${sample.score}, diceUse=${sample.diceUse}, cards=[${sample.cards.join(', ')}], `
      + `episode=${sample.sourceEpisode}, step=${sample.sourceStep}`;

    log(`Running GPU rollouts: action=${action}, rollouts=${rolloutCount}`);
    const gpu = await runGpu({ tables, sample, action, rolloutCount, seed });
    $('gpuMean').textContent = fmt(gpu.mean, 2);
    $('gpuSub').textContent =
      `std=${fmt(gpu.std, 2)}, min=${gpu.min}, max=${gpu.max}, `
      + `${fmt(rolloutCount / (gpu.elapsedMs / 1000), 0)} rollouts/sec, ${fmt(gpu.elapsedMs, 1)}ms`;
    log(`GPU mean=${fmt(gpu.mean, 4)} std=${fmt(gpu.std, 4)} elapsedMs=${fmt(gpu.elapsedMs, 2)}`);

    if (cpuIterations > 0) {
      log(`Running CPU reference on server: iterations=${cpuIterations}`);
      const cpuStarted = performance.now();
      const cpu = await fetchJson('/api/cpu-rollout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: sample.state, action, iterations: cpuIterations, seed }),
      });
      const cpuElapsed = performance.now() - cpuStarted;
      $('cpuMean').textContent = fmt(cpu.mean, 2);
      $('cpuSub').textContent =
        `std=${fmt(cpu.std, 2)}, min=${cpu.min}, max=${cpu.max}, `
        + `${fmt(cpu.iterations / (cpuElapsed / 1000), 0)} rollouts/sec, ${fmt(cpuElapsed, 1)}ms`;
      log(`CPU mean=${fmt(cpu.mean, 4)} std=${fmt(cpu.std, 4)} elapsedMs=${fmt(cpuElapsed, 2)}`);
      log(`Mean delta GPU-CPU=${fmt(gpu.mean - cpu.mean, 4)}`);
    }
  } catch (error) {
    log(String(error.stack || error));
  } finally {
    $('run').disabled = false;
  }
}

window.gpuRolloutWorkbench = {
  fetchJson,
  prepareGpuReadbackMode,
  resetGpuContext,
  runGpu,
  runGpuAllActions,
};

if ($('run')) {
  $('run').addEventListener('click', run);

  const query = new URLSearchParams(location.search);
  for (const id of ['mode', 'seed', 'action', 'rollouts', 'cpuIterations']) {
    if (query.has(id)) $(id).value = query.get(id);
  }

  if (!navigator.gpu) {
    log('WebGPU is not available in this browser/runtime. Start the server and open the page in Chrome/Edge.');
  }

  if (query.get('autorun') === '1') {
    const repeat = Math.max(1, Number(query.get('repeat') || 1));
    (async () => {
      for (let i = 0; i < repeat; i++) {
        await run({ clear: i === 0 });
      }
    })();
  }
}