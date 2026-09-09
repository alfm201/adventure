import { buildX36PoolQualityWgsl } from "./gpu-tables.js";
export function policyShader(tables) {
  const poolQualityWgsl = buildX36PoolQualityWgsl(tables);
  return `const X36_NEXT_OFFSET: u32 = 2898u;
const X36_LOCAL_OFFSET: u32 = 5797u;
const X36_SAME50_OFFSET: u32 = 8696u;
const X36_FUTURE_P3_OFFSET: u32 = 11595u;
const X36_FUTURE_STRIDE: u32 = 2899u;

const X36_WEIGHT_SCALE: i32 = 1000;
const W_ROLL_CARD: i32 = 234154;
const W_ROLL_JUMP: i32 = 2474;
const W_ROLL_JUMP_CARD: i32 = 187074;
const W_HAND_PRESSURE: i32 = 96072;
const W_LATE_BONUS: i32 = 4423;
const W_LATE_THRESHOLD: i32 = 70000;
const W_LATE_FAMILY_THRESHOLD: i32 = 95000;
const W_LATE_MOVE: i32 = 52506;
const W_LATE_MULT: i32 = 59091;
const W_LATE_STAGE: i32 = 44838;
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
const W_HAND_QUALITY_RETENTION: i32 = 102989;
const W_NEXT_CARD_PRESSURE: i32 = -30000;
const W_TERMINAL_CONTINUOUS: i32 = -176;
const W_CHAIN_LATE_PENALTY: i32 = 0;
const W_STAGE_ALT_MOVE_PENALTY: i32 = 2372;
const W_STAGE_ACTUAL_MOVE: i32 = 0;
const W_STAGE_DESTINATION: i32 = -43919;
const W_POOL_QUALITY_CARD: i32 = 325;
const W_FUTURE_CARD_P3: i32 = 133780;

fn x36_w(value: i32) -> f32 {
  return f32(value);
}

fn late_family_t_x36(diceUse: i32) -> f32 {
  let numerator = max(0, diceUse * X36_WEIGHT_SCALE - W_LATE_FAMILY_THRESHOLD);
  let denominator = max(1, 100 * X36_WEIGHT_SCALE - W_LATE_FAMILY_THRESHOLD);
  return f32(numerator) / f32(denominator);
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

fn future_card_p3_x36(score: i32, remainingPaid: i32, isDouble: i32) -> f32 {
  let remaining = u32(clamp(remainingPaid, 0, 3));
  let doubleIndex = u32(select(0, 1, isDouble != 0));
  let block = remaining * 2u + doubleIndex;
  return bitcast<f32>(
    stageId[X36_FUTURE_P3_OFFSET + block * X36_FUTURE_STRIDE + x36_score_index(score)]
  );
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

fn future_card_p3_at_successor_x36(score: i32, diceUse: i32, isDouble: i32) -> f32 {
  return future_card_p3_x36(score, max(0, 100 - diceUse), isDouble);
}

fn successor_future_card_p3_x36(
  score: i32,
  diceUse: i32,
  isDouble: i32,
  action: u32,
  hand: ptr<function, array<i32, 5>>,
) -> f32 {
  var total = 0.0;
  if (action == 0u) {
    for (var die1 = 1; die1 <= 6; die1 = die1 + 1) {
      for (var die2 = 1; die2 <= 6; die2 = die2 + 1) {
        let position = projected_score_after_move(score, die1 + die2, true);
        let nextDiceUse = select(diceUse + 1, diceUse, isDouble != 0);
        let nextDouble = select(select(0, 1, die1 == die2), 0, isDouble != 0);
        total = total + future_card_p3_at_successor_x36(position, nextDiceUse, nextDouble);
      }
    }
    return total;
  }

  let cardId = u32((*hand)[action - 1u]);
  let cardKind = cardType[cardId];
  let cardAmount = cardValue[cardId];
  if (cardKind == 2) {
    for (var die1 = 1; die1 <= 6; die1 = die1 + 1) {
      for (var die2 = 1; die2 <= 6; die2 = die2 + 1) {
        let position = projected_score_after_move(score, (die1 + die2) * cardAmount, false);
        let nextDiceUse = select(diceUse + 1, diceUse, isDouble != 0);
        let nextDouble = select(select(0, 1, die1 == die2), 0, isDouble != 0);
        total = total + future_card_p3_at_successor_x36(position, nextDiceUse, nextDouble);
      }
    }
    return total;
  }

  var rawValue = cardAmount;
  if (cardKind == 3) { rawValue = stage_card_move(score, cardAmount); }
  let position = projected_score_after_move(score, rawValue, false);
  return 36.0 * future_card_p3_at_successor_x36(position, diceUse, isDouble);
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

fn current_best_roll_value_x36(
  score: i32,
  diceUse: i32,
  isDouble: i32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  obtained: u32,
) -> f32 {
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
  total = total + successor_future_card_p3_x36(score, diceUse, isDouble, 0u, hand)
    * x36_w(W_FUTURE_CARD_P3);
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
  total = total + 36.0 * late_family_t_x36(diceUse) * x36_w(W_LATE_MOVE);
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
  total = total + 36.0 * late_family_t_x36(diceUse) * x36_w(W_LATE_MULT);
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
  total = total + 36.0 * late_family_t_x36(diceUse) * x36_w(W_LATE_STAGE);
  total = total + 36.0 * f32(same_stage_count50(score)) * x36_w(W_STAGE_SAME50);
  total = total - 36.0 * f32(positiveMoveCount) * x36_w(W_STAGE_ALT_MOVE_PENALTY);
  total = total + 36.0 * f32(max(0, projected - score)) * x36_w(W_STAGE_ACTUAL_MOVE);
  total = total + 36.0 * local_quality_x36(projected) * x36_w(W_STAGE_DESTINATION);
  return total;
}

fn current_best_card_value_x36(
  score: i32,
  diceUse: i32,
  isDouble: i32,
  action: u32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  positiveMoveCount: i32,
) -> f32 {
  let cardId = u32((*hand)[action - 1u]);
  let cType = cardType[cardId];
  let cValue = cardValue[cardId];
  var total = -3.402823466e+38;
  if (cType == 1) { total = current_best_move_value_x36(score, diceUse, action, hand, handCount, cValue); }
  if (cType == 2) { total = current_best_mult_value_x36(score, diceUse, hand, handCount, cValue); }
  if (cType == 3) { total = current_best_stage_value_x36(score, diceUse, hand, handCount, cValue, positiveMoveCount); }
  return total + successor_future_card_p3_x36(score, diceUse, isDouble, action, hand)
    * x36_w(W_FUTURE_CARD_P3);
}

fn choose_action(
  score: i32,
  diceUse: i32,
  isDouble: i32,
  hand: ptr<function, array<i32, 5>>,
  handCount: i32,
  obtained: u32,
) -> u32 {
  var bestAction = 0u;
  var bestValue = current_best_roll_value_x36(score, diceUse, isDouble, hand, handCount, obtained);
  if (handCount <= 0) { return 0u; }
  let positiveMoveCount = positive_move_count_x36(hand, handCount);
  let actionCount = u32(handCount + 1);
  for (var action = 1u; action < actionCount; action = action + 1u) {
    let value = current_best_card_value_x36(score, diceUse, isDouble, action, hand, handCount, positiveMoveCount);
    if (value > bestValue) {
      bestValue = value;
      bestAction = action;
    }
  }
  return bestAction;
}
`;
}
