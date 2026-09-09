// Environment backend; validated against the CPU transition contract.
export const environmentShader = `fn next_rand(rng: ptr<function, u32>) -> u32 {
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

  (*score) = clamp((*score) + value, 1, 2898);

  for (var guard = 0; guard < 16; guard = guard + 1) {
    let eventType = stage_event_at((*score) - 1);
    if (eventType == 2) {
      draw_card(hand, handCount, obtained, rng);
      break;
    }
    if (eventType == 4) {
      (*score) = clamp((*score) + stage_move_at((*score) - 1), 1, 2898);
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
}`;
