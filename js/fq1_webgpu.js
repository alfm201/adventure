(function (root, factory) {
  'use strict';
  root.FQ1WebGPUEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WIDTH = 576;
  const HEADS = 8;
  const HEAD_WIDTH = 72;
  const TOKENS = 7;
  const ACTIONS = 6;
  const ACTION_FEATURES = 51;
  const STATE_FEATURES = 42;
  const FF_WIDTH = 2304;
  const QKV_WIDTH = 1728;
  const LANE_STRIDE = 48;
  const WORKGROUP = 64;
  const FULL_DECK_MASK = 0x3fffffff;
  const DEFAULT_LANES = 128;
  const DEFAULT_CHECK_INTERVAL = 2;
  const MAX_CONTINUATION_STEPS = 512;

  const FLOAT_TENSORS = [
    'feature.normalization_mean',
    'feature.normalization_std',
    'global_encoder.0.weight',
    'global_encoder.0.bias',
    'global_encoder.2.weight',
    'global_encoder.2.bias',
    'action_encoder.0.weight',
    'action_encoder.0.bias',
    'action_encoder.2.weight',
    'action_encoder.2.bias',
    'final_norm.weight',
    'final_norm.bias',
    'advantage.0.weight',
    'advantage.0.bias',
    'advantage.2.weight',
    'advantage.2.bias',
    ...Array.from({ length: 4 }, (_, layer) => {
      const prefix = `interaction.layers.${layer}.`;
      return [
        `${prefix}norm1.weight`,
        `${prefix}norm1.bias`,
        `${prefix}self_attn.in_proj_weight`,
        `${prefix}self_attn.in_proj_bias`,
        `${prefix}self_attn.out_proj.weight`,
        `${prefix}self_attn.out_proj.bias`,
        `${prefix}norm2.weight`,
        `${prefix}norm2.bias`,
        `${prefix}linear1.weight`,
        `${prefix}linear1.bias`,
        `${prefix}linear2.weight`,
        `${prefix}linear2.bias`,
      ];
    }).flat(),
  ];

  const INT_TENSORS = [
    'feature.stage_event',
    'feature.stage_move',
    'feature.stage_id',
    'feature.closure_score',
    'feature.closure_draw',
    'feature.closure_hops',
    'feature.stop_delta',
    'feature.stage_delta',
    'feature.card_types',
    'feature.card_values',
    'feature.pair_sums',
    'feature.pair_double',
  ];

  function ceilDiv(value, divisor) {
    return Math.ceil(value / divisor);
  }

  function clampInt(value, min, max) {
    value = Math.trunc(Number(value) || 0);
    return Math.max(min, Math.min(max, value));
  }

  function mixSeed(seed) {
    let value = seed >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return value >>> 0;
  }

  function makeBuffer(device, label, size, usage) {
    const aligned = Math.max(4, Math.ceil(size / 4) * 4);
    return device.createBuffer({ label, size: aligned, usage });
  }

  function uploadTypedArray(device, label, typedArray, usage) {
    const buffer = device.createBuffer({
      label,
      size: Math.max(4, Math.ceil(typedArray.byteLength / 4) * 4),
      usage,
      mappedAtCreation: true,
    });
    const ctor = typedArray.constructor;
    const mapped = new ctor(buffer.getMappedRange());
    mapped.set(typedArray);
    buffer.unmap();
    return buffer;
  }

  function packFloatTensors(policy) {
    const offsets = Object.create(null);
    let total = 0;
    for (const name of FLOAT_TENSORS) {
      const tensor = policy.tensors[name];
      if (!tensor) throw new Error(`FQ1 float tensor missing: ${name}`);
      offsets[name] = total;
      total += tensor.data.length;
    }
    const data = new Float32Array(total);
    for (const name of FLOAT_TENSORS) {
      const tensor = policy.tensors[name];
      data.set(Float32Array.from(tensor.data, Number), offsets[name]);
    }
    return { offsets, data };
  }

  function packIntTensors(policy, stageRows) {
    const offsets = Object.create(null);
    const sources = Object.create(null);
    let total = 0;
    for (const name of INT_TENSORS) {
      const tensor = policy.tensors[name];
      if (!tensor) throw new Error(`FQ1 integer tensor missing: ${name}`);
      const data = Int32Array.from(tensor.data, Number);
      sources[name] = data;
      offsets[name] = total;
      total += data.length;
    }
    const stageSpace = new Int32Array(2899);
    for (let score = 1; score <= 2898; score++) {
      stageSpace[score] = Number(stageRows?.[score - 1]?.[2] || 0);
    }
    sources['feature.stage_space'] = stageSpace;
    offsets['feature.stage_space'] = total;
    total += stageSpace.length;

    const data = new Int32Array(total);
    for (const [name, source] of Object.entries(sources)) {
      data.set(source, offsets[name]);
    }
    return { offsets, data };
  }

  const laneStruct = `
struct Lane {
  score: i32,
  diceUse: i32,
  isDouble: i32,
  handCount: i32,
  hand: array<i32, 5>,
  acquired: u32,
  rng: u32,
  done: u32,
}

struct Params {
  laneCount: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
}
`;

  const geluWgsl = `
fn erf_approx(x: f32) -> f32 {
  let sign = select(1.0, -1.0, x < 0.0);
  let a = abs(x);
  let t = 1.0 / (1.0 + 0.3275911 * a);
  let y = 1.0 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * exp(-a * a));
  return sign * y;
}

fn gelu(x: f32) -> f32 {
  return 0.5 * x * (1.0 + erf_approx(x / 1.4142135623730951));
}
`;

  function featureShaderSource(floatOffsets, intOffsets, qualityScale) {
    const f = name => `${floatOffsets[name]}u`;
    const i = name => `${intOffsets[name]}u`;
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> ints: array<i32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> stateFeatures: array<f32>;
@group(0) @binding(5) var<storage, read_write> actionFeatures: array<f32>;
@group(0) @binding(6) var<storage, read_write> legalMask: array<u32>;

const O_NORM_MEAN: u32 = ${f('feature.normalization_mean')};
const O_NORM_STD: u32 = ${f('feature.normalization_std')};
const O_STAGE_EVENT: u32 = ${i('feature.stage_event')};
const O_STAGE_MOVE: u32 = ${i('feature.stage_move')};
const O_STAGE_ID: u32 = ${i('feature.stage_id')};
const O_STAGE_SPACE: u32 = ${i('feature.stage_space')};
const O_CLOSURE_SCORE: u32 = ${i('feature.closure_score')};
const O_CLOSURE_DRAW: u32 = ${i('feature.closure_draw')};
const O_CLOSURE_HOPS: u32 = ${i('feature.closure_hops')};
const O_STOP_DELTA: u32 = ${i('feature.stop_delta')};
const O_STAGE_DELTA: u32 = ${i('feature.stage_delta')};
const O_CARD_TYPES: u32 = ${i('feature.card_types')};
const O_CARD_VALUES: u32 = ${i('feature.card_values')};
const O_PAIR_SUMS: u32 = ${i('feature.pair_sums')};
const O_PAIR_DOUBLE: u32 = ${i('feature.pair_double')};

fn stage_event(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_STAGE_EVENT + u32(safe)];
}
fn stage_move(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_STAGE_MOVE + u32(safe)];
}
fn stage_id(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_STAGE_ID + u32(safe)];
}
fn stage_space(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_STAGE_SPACE + u32(safe)];
}
fn closure_score(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_CLOSURE_SCORE + u32(safe)];
}
fn closure_draw(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_CLOSURE_DRAW + u32(safe)];
}
fn closure_hops(score: i32) -> i32 {
  let safe = clamp(score, 1, 2898);
  return ints[O_CLOSURE_HOPS + u32(safe)];
}
fn stop_delta(score: i32, dice: i32) -> i32 {
  return ints[O_STOP_DELTA + u32(score * 13 + dice)];
}
fn stage_delta(score: i32) -> i32 {
  return ints[O_STAGE_DELTA + u32(score)];
}
fn card_type(card: i32) -> i32 {
  return ints[O_CARD_TYPES + u32(clamp(card, 0, 30))];
}
fn card_value(card: i32) -> i32 {
  return ints[O_CARD_VALUES + u32(clamp(card, 0, 30))];
}
fn pair_sum(pair: i32) -> i32 {
  return ints[O_PAIR_SUMS + u32(pair)];
}
fn pair_double(pair: i32) -> i32 {
  return ints[O_PAIR_DOUBLE + u32(pair)];
}
fn dice_weight(sum: i32) -> i32 {
  if (sum == 2 || sum == 12) { return 1; }
  if (sum == 3 || sum == 11) { return 2; }
  if (sum == 4 || sum == 10) { return 3; }
  if (sum == 5 || sum == 9) { return 4; }
  if (sum == 6 || sum == 8) { return 5; }
  if (sum == 7) { return 6; }
  return 0;
}
fn legal(lane: Lane, action: u32) -> bool {
  if (action == 0u) { return true; }
  return action <= 5u && lane.hand[action - 1u] != 0;
}
fn card_option(landing: i32, closure: i32) -> bool {
  return stage_event(landing) == 2 ||
    (stage_event(landing) == 4 && stage_event(closure) == 2);
}
fn move_chain(lane: Lane, action: u32) -> bool {
  if (action == 0u || action > 5u) { return false; }
  let id = lane.hand[action - 1u];
  if (id == 0 || card_type(id) != 1) { return false; }
  let firstLanding = clamp(lane.score + card_value(id), 1, 2898);
  let firstClosure = closure_score(firstLanding);
  if (stage_event(firstLanding) == 4 && card_option(firstLanding, firstClosure)) {
    return true;
  }
  for (var other = 0u; other < 5u; other = other + 1u) {
    if (other == action - 1u) { continue; }
    let nextId = lane.hand[other];
    if (nextId == 0 || card_type(nextId) != 1) { continue; }
    let secondLanding = clamp(firstClosure + card_value(nextId), 1, 2898);
    let secondClosure = closure_score(secondLanding);
    if (card_option(secondLanding, secondClosure)) { return true; }
  }
  return false;
}
fn x36_quality(lane: Lane) -> array<f32, 6> {
  var q: array<f32, 6>;
  for (var a = 0u; a < 6u; a = a + 1u) { q[a] = -1.0e30; }

  var roll = 0;
  for (var dice = 2; dice <= 12; dice = dice + 1) {
    let landing = clamp(lane.score + stop_delta(lane.score, dice), 1, 2898);
    var value = 0;
    if (stage_event(landing) == 2 && lane.handCount < 5) {
      value = value + 179;
    } else if (stage_event(landing) == 4) {
      value = value + max(0, stage_move(landing)) * 2;
      if (lane.handCount < 5 && stage_event(closure_score(landing)) == 2) {
        value = value + 299;
      }
    }
    roll = roll + dice_weight(dice) * value;
  }
  q[0] = f32(roll);

  var post = 0;
  if (lane.handCount == 5 || lane.diceUse + lane.handCount >= 100) {
    post = post + 98 * 36;
  }
  if (lane.diceUse >= 70) { post = post + 3 * 36; }

  for (var slot = 0u; slot < 5u; slot = slot + 1u) {
    let id = lane.hand[slot];
    if (id == 0) { continue; }
    let typeId = card_type(id);
    let cValue = card_value(id);
    var value = -1073741824;

    if (typeId == 1) {
      let landing = clamp(lane.score + cValue, 1, 2898);
      value = -80 * 36;
      if (stage_event(landing) == 2) {
        value = value + 139 * 36;
      } else if (stage_event(landing) == 4) {
        value = value + max(0, stage_move(landing)) * 2 * 36;
        if (stage_event(closure_score(landing)) == 2) {
          value = value + 101 * 36;
        }
      }
      if (move_chain(lane, slot + 1u)) { value = value + 37 * 36; }
    } else if (typeId == 2) {
      value = -20 * 36;
      for (var dice = 2; dice <= 12; dice = dice + 1) {
        let landing = clamp(lane.score + dice * cValue, 1, 2898);
        var branch = 0;
        if (stage_event(landing) == 2) {
          branch = branch + 142;
        } else if (stage_event(landing) == 4) {
          branch = branch + max(0, stage_move(landing)) * 2;
          if (stage_event(closure_score(landing)) == 2) {
            branch = branch + 141;
          }
        }
        value = value + dice_weight(dice) * branch;
      }
    } else if (typeId == 3) {
      let targetStage = stage_id(lane.score) + cValue;
      var delta = targetStage;
      for (var physical = lane.score + 1; physical < 2898; physical = physical + 1) {
        if (stage_id(physical) == targetStage) {
          delta = physical - lane.score;
          break;
        }
      }
      let landing = clamp(lane.score + delta, 1, 2898);
      var same = 0;
      let begin = min(2897, lane.score + 1);
      let end = min(2897, lane.score + 50);
      for (var position = begin; position < end; position = position + 1) {
        if (stage_id(min(2898, position + 1)) == stage_id(lane.score)) {
          same = same + 1;
        }
      }
      value = -2 * 36 + same * 36;
      if (stage_event(landing) == 4) {
        value = value + max(0, stage_move(landing)) * 2 * 36;
      }
    }
    q[slot + 1u] = f32(value + post);
  }
  return q;
}
fn event_slot(eventId: i32) -> i32 {
  if (eventId == 0) { return 0; }
  if (eventId == 1) { return 1; }
  if (eventId == 2) { return 2; }
  if (eventId == 3) { return 3; }
  if (eventId == 4) { return 4; }
  if (eventId == 5) { return 5; }
  if (eventId == 6) { return 6; }
  if (eventId == 9) { return 7; }
  return -1;
}
fn raw_value(lane: Lane, index: u32) -> f32 {
  if (index == 0u) { return 0.0; }
  if (index == 1u) { return 1.0; }
  if (index == 2u) { return f32(lane.score); }
  if (index == 3u) { return f32(stage_id(lane.score)); }
  if (index == 4u) { return f32(stage_space(lane.score)); }
  if (index == 5u) { return f32(lane.diceUse); }
  if (index == 6u) { return f32(lane.isDouble); }
  if (index >= 7u && index < 12u) {
    return f32(lane.hand[index - 7u]);
  }
  let card = index - 12u;
  return select(0.0, 1.0, (lane.acquired & (1u << card)) != 0u);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let laneIndex = gid.x;
  if (laneIndex >= params.laneCount) { return; }
  let lane = lanes[laneIndex];
  if (lane.done != 0u) { return; }

  let stateBase = laneIndex * 42u;
  for (var feature = 0u; feature < 42u; feature = feature + 1u) {
    stateFeatures[stateBase + feature] =
      (raw_value(lane, feature) - weights[O_NORM_MEAN + feature]) /
      weights[O_NORM_STD + feature];
  }

  var qualities = x36_quality(lane);
  var bestAction = 0u;
  for (var action = 0u; action < 6u; action = action + 1u) {
    let isLegal = legal(lane, action);
    legalMask[laneIndex * 6u + action] = select(0u, 1u, isLegal);
    if (action > 0u && isLegal && qualities[action] > qualities[bestAction]) {
      bestAction = action;
    }
  }
  var qualitySum = 0.0;
  var legalCount = 0.0;
  for (var action = 0u; action < 6u; action = action + 1u) {
    if (legal(lane, action)) {
      qualitySum = qualitySum + qualities[action];
      legalCount = legalCount + 1.0;
    }
  }
  let qualityMean = qualitySum / legalCount;

  let acquiredCount = countOneBits(lane.acquired & 0x3fffffffu);
  var availableCount = 30u - acquiredCount;
  let resetDeck = availableCount == 0u;
  if (resetDeck) { availableCount = 30u; }
  var drawType: array<f32, 3>;
  drawType[0] = 0.0;
  drawType[1] = 0.0;
  drawType[2] = 0.0;
  var drawValue = 0.0;
  for (var card = 1u; card <= 30u; card = card + 1u) {
    let obtained = (lane.acquired & (1u << (card - 1u))) != 0u;
    if (!resetDeck && obtained) { continue; }
    let typeId = card_type(i32(card));
    if (typeId >= 1 && typeId <= 3) {
      drawType[u32(typeId - 1)] = drawType[u32(typeId - 1)] + 1.0 / f32(availableCount);
    }
    drawValue = drawValue + f32(card_value(i32(card))) / f32(availableCount);
  }

  for (var action = 0u; action < 6u; action = action + 1u) {
    var id = 0;
    if (action > 0u) { id = lane.hand[action - 1u]; }
    let typeId = card_type(id);
    let cValue = card_value(id);
    let stochastic = action == 0u || typeId == 2;
    let consumed = select(0, 1, action > 0u);
    let postHand = lane.handCount - consumed;
    let canDraw = select(0.0, 1.0, postHand < 5);
    let diceIncrement = select(0, 1, stochastic && lane.isDouble == 0);

    var rawCounts: array<f32, 8>;
    var finalCounts: array<f32, 8>;
    for (var slot = 0u; slot < 8u; slot = slot + 1u) {
      rawCounts[slot] = 0.0;
      finalCounts[slot] = 0.0;
    }

    var deltaSum = 0.0;
    var deltaMin = 1.0e30;
    var deltaMax = -1.0e30;
    var finalDeltaSum = 0.0;
    var jumpSum = 0.0;
    var hopsSum = 0.0;
    var drawSum = 0.0;
    var postDoubleSum = 0.0;
    var terminalSum = 0.0;

    for (var pair = 0; pair < 36; pair = pair + 1) {
      var delta = stage_delta(lane.score);
      if (action == 0u) {
        delta = stop_delta(lane.score, pair_sum(pair));
      } else if (typeId == 2) {
        delta = cValue * pair_sum(pair);
      } else if (typeId == 1) {
        delta = cValue;
      }

      let rawPosition = clamp(lane.score + delta, 1, 2898);
      let finalPosition = closure_score(rawPosition);
      var postDouble = lane.isDouble;
      if (stochastic) {
        postDouble = select(pair_double(pair), 0, lane.isDouble != 0);
      }
      let terminal = select(0, 1, lane.diceUse + diceIncrement >= 100 && postDouble == 0);
      let rawEventSlot = event_slot(stage_event(rawPosition));
      let finalEventSlot = event_slot(stage_event(finalPosition));
      if (rawEventSlot >= 0) {
        rawCounts[u32(rawEventSlot)] = rawCounts[u32(rawEventSlot)] + 1.0;
      }
      if (finalEventSlot >= 0) {
        finalCounts[u32(finalEventSlot)] = finalCounts[u32(finalEventSlot)] + 1.0;
      }

      deltaSum = deltaSum + f32(delta);
      deltaMin = min(deltaMin, f32(delta));
      deltaMax = max(deltaMax, f32(delta));
      finalDeltaSum = finalDeltaSum + f32(finalPosition - lane.score);
      jumpSum = jumpSum + f32(finalPosition - rawPosition);
      hopsSum = hopsSum + f32(closure_hops(rawPosition));
      drawSum = drawSum + f32(closure_draw(rawPosition));
      postDoubleSum = postDoubleSum + f32(postDouble);
      terminalSum = terminalSum + f32(terminal);
    }

    let drawProbability = drawSum / 36.0 * canDraw;
    let base = (laneIndex * 6u + action) * 51u;
    actionFeatures[base + 0u] = deltaSum / 36.0 / 120.0;
    actionFeatures[base + 1u] = deltaMin / 120.0;
    actionFeatures[base + 2u] = deltaMax / 120.0;
    actionFeatures[base + 3u] = finalDeltaSum / 36.0 / 160.0;
    actionFeatures[base + 4u] = jumpSum / 36.0 / 100.0;
    actionFeatures[base + 5u] = hopsSum / 36.0 / 4.0;
    actionFeatures[base + 6u] = drawProbability;
    actionFeatures[base + 7u] = postDoubleSum / 36.0;
    actionFeatures[base + 8u] = f32(diceIncrement);
    actionFeatures[base + 9u] = terminalSum / 36.0;
    actionFeatures[base + 10u] = f32(consumed);
    actionFeatures[base + 11u] = select(0.0, 1.0, action == bestAction);
    actionFeatures[base + 12u] = f32(postHand) / 5.0;
    actionFeatures[base + 13u] = select(0.0, 1.0, postHand == 5);
    actionFeatures[base + 14u] = select(0.0, 0.2, typeId == 3);
    actionFeatures[base + 15u] = select(0.0, 1.0, typeId == 0);
    actionFeatures[base + 16u] = select(0.0, 1.0, typeId == 1);
    actionFeatures[base + 17u] = select(0.0, 1.0, typeId == 2);
    actionFeatures[base + 18u] = select(0.0, 1.0, typeId == 3);
    actionFeatures[base + 19u] = f32(cValue) / 12.0;
    actionFeatures[base + 20u] = f32(id) / 30.0;
    for (var eventIndex = 0u; eventIndex < 8u; eventIndex = eventIndex + 1u) {
      actionFeatures[base + 21u + eventIndex] = rawCounts[eventIndex] / 36.0;
      actionFeatures[base + 29u + eventIndex] = finalCounts[eventIndex] / 36.0;
    }
    actionFeatures[base + 37u] = drawProbability * drawType[0];
    actionFeatures[base + 38u] = drawProbability * drawType[1];
    actionFeatures[base + 39u] = drawProbability * drawType[2];
    actionFeatures[base + 40u] = drawProbability * drawValue / 12.0;
    actionFeatures[base + 41u] = f32(lane.score) / 2898.0;
    actionFeatures[base + 42u] = f32(lane.diceUse) / 100.0;
    actionFeatures[base + 43u] = f32(lane.isDouble);
    actionFeatures[base + 44u] = f32(lane.handCount) / 5.0;
    actionFeatures[base + 45u] = f32(acquiredCount) / 30.0;
    actionFeatures[base + 46u] = select(0.0, 1.0, lane.handCount == 5);
    actionFeatures[base + 47u] = select(0.0, 1.0, lane.diceUse >= 80);
    actionFeatures[base + 48u] = f32(stage_id(lane.score)) / 75.0;
    actionFeatures[base + 49u] = f32(stage_space(lane.score)) / 50.0;
    actionFeatures[base + 50u] = select(
      0.0,
      (qualities[action] - qualityMean) / ${qualityScale},
      legal(lane, action)
    );
  }
}
`;
  }

  function encoderShaderSource(config) {
    const {
      inputWidth,
      rowsPerLane,
      weightOffset,
      biasOffset,
      normWeightOffset,
      normBiasOffset,
    } = config;
    return `
${laneStruct}
${geluWgsl}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> inputData: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> outputData: array<f32>;

const INPUT_WIDTH: u32 = ${inputWidth}u;
const ROWS_PER_LANE: u32 = ${rowsPerLane}u;
const W_OFFSET: u32 = ${weightOffset}u;
const B_OFFSET: u32 = ${biasOffset}u;
const NW_OFFSET: u32 = ${normWeightOffset}u;
const NB_OFFSET: u32 = ${normBiasOffset}u;

var<workgroup> values: array<f32, 576>;
var<workgroup> scratch: array<f32, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>
) {
  let row = workgroup.x;
  let laneIndex = row / ROWS_PER_LANE;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  let lid = local.x;
  let inputBase = row * INPUT_WIDTH;

  for (var outIndex = lid; outIndex < 576u; outIndex = outIndex + 64u) {
    var sum = weights[B_OFFSET + outIndex];
    let weightBase = W_OFFSET + outIndex * INPUT_WIDTH;
    for (var inIndex = 0u; inIndex < INPUT_WIDTH; inIndex = inIndex + 1u) {
      sum = sum + inputData[inputBase + inIndex] * weights[weightBase + inIndex];
    }
    values[outIndex] = gelu(sum);
  }
  workgroupBarrier();

  var localSum = 0.0;
  for (var index = lid; index < 576u; index = index + 64u) {
    localSum = localSum + values[index];
  }
  scratch[lid] = localSum;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride = stride / 2u) {
    if (lid < stride) { scratch[lid] = scratch[lid] + scratch[lid + stride]; }
    workgroupBarrier();
  }
  let mean = scratch[0] / 576.0;

  var localVariance = 0.0;
  for (var index = lid; index < 576u; index = index + 64u) {
    let delta = values[index] - mean;
    localVariance = localVariance + delta * delta;
  }
  scratch[lid] = localVariance;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride = stride / 2u) {
    if (lid < stride) { scratch[lid] = scratch[lid] + scratch[lid + stride]; }
    workgroupBarrier();
  }
  let inverse = inverseSqrt(scratch[0] / 576.0 + 1.0e-5);
  let outputBase = row * 576u;
  for (var index = lid; index < 576u; index = index + 64u) {
    outputData[outputBase + index] =
      (values[index] - mean) * inverse * weights[NW_OFFSET + index] +
      weights[NB_OFFSET + index];
  }
}
`;
  }

  function combineShaderSource() {
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> globalTokens: array<f32>;
@group(0) @binding(2) var<storage, read> actionTokens: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> tokens: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  let perLane = 7u * 576u;
  let laneIndex = index / perLane;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  let within = index % perLane;
  let token = within / 576u;
  let dimension = within % 576u;
  if (token == 0u) {
    tokens[index] = globalTokens[laneIndex * 576u + dimension];
  } else {
    tokens[index] = actionTokens[(laneIndex * 6u + token - 1u) * 576u + dimension];
  }
}
`;
  }

  function normShaderSource(weightOffset, biasOffset) {
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> inputData: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> outputData: array<f32>;

const NW_OFFSET: u32 = ${weightOffset}u;
const NB_OFFSET: u32 = ${biasOffset}u;
var<workgroup> scratch: array<f32, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>
) {
  let row = workgroup.x;
  let laneIndex = row / 7u;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  let lid = local.x;
  let base = row * 576u;
  var localSum = 0.0;
  for (var index = lid; index < 576u; index = index + 64u) {
    localSum = localSum + inputData[base + index];
  }
  scratch[lid] = localSum;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride = stride / 2u) {
    if (lid < stride) { scratch[lid] = scratch[lid] + scratch[lid + stride]; }
    workgroupBarrier();
  }
  let mean = scratch[0] / 576.0;

  var localVariance = 0.0;
  for (var index = lid; index < 576u; index = index + 64u) {
    let delta = inputData[base + index] - mean;
    localVariance = localVariance + delta * delta;
  }
  scratch[lid] = localVariance;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride = stride / 2u) {
    if (lid < stride) { scratch[lid] = scratch[lid] + scratch[lid + stride]; }
    workgroupBarrier();
  }
  let inverse = inverseSqrt(scratch[0] / 576.0 + 1.0e-5);
  for (var index = lid; index < 576u; index = index + 64u) {
    outputData[base + index] =
      (inputData[base + index] - mean) * inverse * weights[NW_OFFSET + index] +
      weights[NB_OFFSET + index];
  }
}
`;
  }

  function linearShaderSource(config) {
    const {
      inputWidth,
      outputWidth,
      rowsPerLane,
      weightOffset,
      biasOffset,
      activation = false,
      residual = false,
    } = config;
    return `
${laneStruct}
${activation ? geluWgsl : ''}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> inputData: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> outputData: array<f32>;
${residual ? '@group(0) @binding(5) var<storage, read> residualData: array<f32>;' : ''}

const INPUT_WIDTH: u32 = ${inputWidth}u;
const OUTPUT_WIDTH: u32 = ${outputWidth}u;
const ROWS_PER_LANE: u32 = ${rowsPerLane}u;
const W_OFFSET: u32 = ${weightOffset}u;
const B_OFFSET: u32 = ${biasOffset}u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let flat = gid.x;
  let row = flat / OUTPUT_WIDTH;
  let outIndex = flat % OUTPUT_WIDTH;
  let laneIndex = row / ROWS_PER_LANE;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  let inputBase = row * INPUT_WIDTH;
  let weightBase = W_OFFSET + outIndex * INPUT_WIDTH;
  var sum = weights[B_OFFSET + outIndex];
  for (var inIndex = 0u; inIndex < INPUT_WIDTH; inIndex = inIndex + 1u) {
    sum = sum + inputData[inputBase + inIndex] * weights[weightBase + inIndex];
  }
  ${activation ? 'sum = gelu(sum);' : ''}
  ${residual ? 'sum = sum + residualData[row * OUTPUT_WIDTH + outIndex];' : ''}
  outputData[row * OUTPUT_WIDTH + outIndex] = sum;
}
`;
  }

  function attentionShaderSource() {
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> qkv: array<f32>;
@group(0) @binding(2) var<storage, read> legalMask: array<u32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> outputData: array<f32>;

var<workgroup> scratch: array<f32, 64>;
var<workgroup> scores: array<f32, 7>;
var<workgroup> probabilities: array<f32, 7>;

fn token_legal(laneIndex: u32, token: u32) -> bool {
  if (token == 0u) { return true; }
  return legalMask[laneIndex * 6u + token - 1u] != 0u;
}

@compute @workgroup_size(64)
fn main(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>
) {
  let group = workgroup.x;
  let laneIndex = group / 56u;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  let within = group % 56u;
  let head = within / 7u;
  let query = within % 7u;
  let lid = local.x;
  let queryRow = laneIndex * 7u + query;
  let qBase = queryRow * 1728u + head * 72u;

  for (var key = 0u; key < 7u; key = key + 1u) {
    let keyRow = laneIndex * 7u + key;
    let kBase = keyRow * 1728u + 576u + head * 72u;
    var partial = 0.0;
    for (var dimension = lid; dimension < 72u; dimension = dimension + 64u) {
      partial = partial + qkv[qBase + dimension] * qkv[kBase + dimension];
    }
    scratch[lid] = partial;
    workgroupBarrier();
    for (var stride = 32u; stride > 0u; stride = stride / 2u) {
      if (lid < stride) { scratch[lid] = scratch[lid] + scratch[lid + stride]; }
      workgroupBarrier();
    }
    if (lid == 0u) {
      scores[key] = select(-1.0e30, scratch[0] * 0.11785113019775793, token_legal(laneIndex, key));
    }
    workgroupBarrier();
  }

  if (lid == 0u) {
    var maximum = -1.0e30;
    for (var key = 0u; key < 7u; key = key + 1u) {
      maximum = max(maximum, scores[key]);
    }
    var denominator = 0.0;
    for (var key = 0u; key < 7u; key = key + 1u) {
      let value = select(0.0, exp(scores[key] - maximum), token_legal(laneIndex, key));
      probabilities[key] = value;
      denominator = denominator + value;
    }
    for (var key = 0u; key < 7u; key = key + 1u) {
      probabilities[key] = probabilities[key] / denominator;
    }
  }
  workgroupBarrier();

  for (var dimension = lid; dimension < 72u; dimension = dimension + 64u) {
    var value = 0.0;
    for (var key = 0u; key < 7u; key = key + 1u) {
      let keyRow = laneIndex * 7u + key;
      let vBase = keyRow * 1728u + 1152u + head * 72u;
      value = value + probabilities[key] * qkv[vBase + dimension];
    }
    outputData[(laneIndex * 7u + query) * 576u + head * 72u + dimension] = value;
  }
}
`;
  }

  function advantageHiddenShaderSource(weightOffset, biasOffset) {
    return `
${laneStruct}
${geluWgsl}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> tokens: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> hidden: array<f32>;

const W_OFFSET: u32 = ${weightOffset}u;
const B_OFFSET: u32 = ${biasOffset}u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let flat = gid.x;
  let row = flat / 576u;
  let outIndex = flat % 576u;
  let laneIndex = row / 6u;
  let action = row % 6u;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  let weightBase = W_OFFSET + outIndex * 1152u;
  let actionBase = (laneIndex * 7u + action + 1u) * 576u;
  let globalBase = laneIndex * 7u * 576u;
  var sum = weights[B_OFFSET + outIndex];
  for (var index = 0u; index < 576u; index = index + 1u) {
    sum = sum + tokens[actionBase + index] * weights[weightBase + index];
    sum = sum + tokens[globalBase + index] * weights[weightBase + 576u + index];
  }
  hidden[row * 576u + outIndex] = gelu(sum);
}
`;
  }

  function argmaxShaderSource(weightOffset, biasOffset) {
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> hidden: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<storage, read> legalMask: array<u32>;
@group(0) @binding(4) var<uniform> params: Params;
@group(0) @binding(5) var<storage, read_write> actions: array<u32>;

const W_OFFSET: u32 = ${weightOffset}u;
const B_OFFSET: u32 = ${biasOffset}u;
var<workgroup> logits: array<f32, 8>;

@compute @workgroup_size(8)
fn main(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>
) {
  let laneIndex = workgroup.x;
  let action = local.x;
  if (laneIndex >= params.laneCount || lanes[laneIndex].done != 0u) { return; }
  if (action < 6u) {
    var value = weights[B_OFFSET];
    let base = (laneIndex * 6u + action) * 576u;
    for (var index = 0u; index < 576u; index = index + 1u) {
      value = value + hidden[base + index] * weights[W_OFFSET + index];
    }
    logits[action] = select(-1.0e30, value, legalMask[laneIndex * 6u + action] != 0u);
  } else {
    logits[action] = -1.0e30;
  }
  workgroupBarrier();
  if (action == 0u) {
    var best = 0u;
    for (var candidate = 1u; candidate < 6u; candidate = candidate + 1u) {
      if (logits[candidate] > logits[best]) { best = candidate; }
    }
    actions[laneIndex] = best;
  }
}
`;
  }

  function environmentShaderSource(intOffsets) {
    const i = name => `${intOffsets[name]}u`;
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read_write> lanes: array<Lane>;
@group(0) @binding(1) var<storage, read> ints: array<i32>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read> actions: array<u32>;
struct DoneCounter { value: atomic<u32>, }
@group(0) @binding(4) var<storage, read_write> doneCounter: DoneCounter;

const O_STAGE_EVENT: u32 = ${i('feature.stage_event')};
const O_STAGE_MOVE: u32 = ${i('feature.stage_move')};
const O_STAGE_ID: u32 = ${i('feature.stage_id')};
const O_STOP_DELTA: u32 = ${i('feature.stop_delta')};
const O_CARD_TYPES: u32 = ${i('feature.card_types')};
const O_CARD_VALUES: u32 = ${i('feature.card_values')};

fn stage_event(score: i32) -> i32 {
  return ints[O_STAGE_EVENT + u32(clamp(score, 1, 2898))];
}
fn stage_move(score: i32) -> i32 {
  return ints[O_STAGE_MOVE + u32(clamp(score, 1, 2898))];
}
fn stage_id(score: i32) -> i32 {
  return ints[O_STAGE_ID + u32(clamp(score, 1, 2898))];
}
fn stop_delta(score: i32, dice: i32) -> i32 {
  return ints[O_STOP_DELTA + u32(score * 13 + dice)];
}
fn card_type(card: i32) -> i32 {
  return ints[O_CARD_TYPES + u32(clamp(card, 0, 30))];
}
fn card_value(card: i32) -> i32 {
  return ints[O_CARD_VALUES + u32(clamp(card, 0, 30))];
}
fn next_rand(lane: ptr<function, Lane>) -> u32 {
  let t = (*lane).rng + 0x6d2b79f5u;
  (*lane).rng = t;
  var r = (t ^ (t >> 15u)) * (1u | t);
  r = r ^ (r + ((r ^ (r >> 7u)) * 61u));
  return r ^ (r >> 14u);
}
fn roll_dice(lane: ptr<function, Lane>) -> i32 {
  let first = i32(next_rand(lane) % 6u) + 1;
  let second = i32(next_rand(lane) % 6u) + 1;
  if ((*lane).isDouble != 0) {
    (*lane).isDouble = 0;
  } else {
    (*lane).isDouble = select(0, 1, first == second);
    (*lane).diceUse = (*lane).diceUse + 1;
  }
  return first + second;
}
fn draw_card(lane: ptr<function, Lane>) {
  if ((*lane).handCount >= 5) { return; }
  var remaining = 0u;
  for (var card = 0u; card < 30u; card = card + 1u) {
    if (((*lane).acquired & (1u << card)) == 0u) { remaining = remaining + 1u; }
  }
  if (remaining == 0u) {
    (*lane).acquired = 0u;
    remaining = 30u;
  }
  let wanted = next_rand(lane) % remaining;
  var seen = 0u;
  var picked = 0u;
  for (var card = 0u; card < 30u; card = card + 1u) {
    if (((*lane).acquired & (1u << card)) != 0u) { continue; }
    if (seen == wanted) {
      picked = card;
      break;
    }
    seen = seen + 1u;
  }
  (*lane).acquired = (*lane).acquired | (1u << picked);
  (*lane).hand[u32((*lane).handCount)] = i32(picked) + 1;
  (*lane).handCount = (*lane).handCount + 1;
  if (remaining == 1u) { (*lane).acquired = 0u; }
}
fn update_score(lane: ptr<function, Lane>, delta: i32) {
  (*lane).score = clamp((*lane).score + delta, 1, 2898);
  for (var guard = 0; guard < 16; guard = guard + 1) {
    let eventId = stage_event((*lane).score);
    if (eventId == 2) {
      draw_card(lane);
      break;
    }
    if (eventId == 4) {
      (*lane).score = clamp((*lane).score + stage_move((*lane).score), 1, 2898);
      continue;
    }
    break;
  }
}
fn remove_hand(lane: ptr<function, Lane>, slot: i32) -> i32 {
  let id = (*lane).hand[u32(slot)];
  for (var index = slot; index < 4; index = index + 1) {
    (*lane).hand[u32(index)] = (*lane).hand[u32(index + 1)];
  }
  (*lane).hand[4] = 0;
  (*lane).handCount = max(0, (*lane).handCount - 1);
  return id;
}
fn stage_card_delta(score: i32, cValue: i32) -> i32 {
  let targetStage = stage_id(score) + cValue;
  var delta = targetStage;
  for (var physical = score + 1; physical < 2898; physical = physical + 1) {
    if (stage_id(physical) == targetStage) {
      delta = physical - score;
      break;
    }
  }
  return delta;
}
fn mark_done(lane: ptr<function, Lane>) {
  if ((*lane).done == 0u) {
    (*lane).done = 1u;
    atomicAdd(&doneCounter.value, 1u);
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let laneIndex = gid.x;
  if (laneIndex >= params.laneCount) { return; }
  var lane = lanes[laneIndex];
  if (lane.done != 0u) { return; }
  if (lane.diceUse >= 100 && lane.isDouble == 0) {
    mark_done(&lane);
    lanes[laneIndex] = lane;
    return;
  }

  let action = actions[laneIndex];
  if (action == 0u) {
    let dice = roll_dice(&lane);
    update_score(&lane, stop_delta(lane.score, dice));
  } else if (i32(action) <= lane.handCount) {
    let id = remove_hand(&lane, i32(action) - 1);
    let typeId = card_type(id);
    let cValue = card_value(id);
    if (typeId == 1) {
      update_score(&lane, cValue);
    } else if (typeId == 2) {
      update_score(&lane, roll_dice(&lane) * cValue);
    } else if (typeId == 3) {
      update_score(&lane, stage_card_delta(lane.score, cValue));
    }
  }

  if (lane.diceUse >= 100 && lane.isDouble == 0) { mark_done(&lane); }
  lanes[laneIndex] = lane;
}
`;
  }

  function extractShaderSource() {
    return `
${laneStruct}
@group(0) @binding(0) var<storage, read> lanes: array<Lane>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> scores: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let laneIndex = gid.x;
  if (laneIndex >= params.laneCount) { return; }
  scores[laneIndex] = u32(max(0, lanes[laneIndex].score));
}
`;
  }

  class Engine {
    static async create(policy, options = {}) {
      const engine = new Engine(policy, options);
      await engine.initialize();
      return engine;
    }

    constructor(policy, options) {
      if (!policy || policy.width !== WIDTH || policy.heads !== HEADS) {
        throw new Error('FQ1 WebGPU engine requires the audited width-576, 8-head checkpoint.');
      }
      this.policy = policy;
      this.options = options || {};
      this.stageRows = this.options.stage || globalThis.stage;
      this.laneCapacity = clampInt(
        this.options.laneCapacity ?? new URLSearchParams(location.search).get('fq1Batch') ?? DEFAULT_LANES,
        16,
        256,
      );
      this.checkInterval = clampInt(
        this.options.checkInterval ?? new URLSearchParams(location.search).get('fq1Check') ?? DEFAULT_CHECK_INTERVAL,
        1,
        16,
      );
      this.device = null;
      this.adapter = null;
      this.destroyed = false;
      this.lostInfo = null;
      this.floatOffsets = null;
      this.intOffsets = null;
      this.buffers = Object.create(null);
      this.pipelines = Object.create(null);
      this.bindGroups = Object.create(null);
      this.layerPasses = [];
      this.paramsData = new Uint32Array(4);
      this.initialStateBytes = new ArrayBuffer(this.laneCapacity * LANE_STRIDE);
      this.rootActions = new Uint32Array(this.laneCapacity);
      this.totalGpuBytes = 0;
    }

    async initialize() {
      if (!navigator.gpu) throw new Error('WebGPU를 지원하는 브라우저가 필요합니다.');
      this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!this.adapter) throw new Error('WebGPU 어댑터를 찾지 못했습니다.');

      const packedFloat = packFloatTensors(this.policy);
      const packedInt = packIntTensors(this.policy, this.stageRows);
      this.floatOffsets = packedFloat.offsets;
      this.intOffsets = packedInt.offsets;

      const requiredStorage = Math.max(packedFloat.data.byteLength, packedInt.data.byteLength);
      if (requiredStorage > this.adapter.limits.maxStorageBufferBindingSize) {
        throw new Error(
          `FQ1 weight buffer ${Math.ceil(requiredStorage / 1048576)}MB exceeds WebGPU storage binding limit ` +
          `${Math.floor(this.adapter.limits.maxStorageBufferBindingSize / 1048576)}MB.`
        );
      }
      const requiredLimits = {};
      if (requiredStorage > 128 * 1024 * 1024) {
        requiredLimits.maxStorageBufferBindingSize = requiredStorage;
        requiredLimits.maxBufferSize = Math.max(requiredStorage, this.adapter.limits.maxBufferSize);
      }
      this.device = await this.adapter.requestDevice(
        Object.keys(requiredLimits).length ? { requiredLimits } : undefined
      );
      this.device.lost.then(info => {
        this.lostInfo = info;
        console.error('FQ1 WebGPU device lost.', info);
      });

      this.createBuffers(packedFloat.data, packedInt.data);
      await this.createPipelines();
      this.createBindGroups();
    }

    trackBuffer(name, buffer) {
      this.buffers[name] = buffer;
      this.totalGpuBytes += Number(buffer.size) || 0;
      return buffer;
    }

    createBuffers(floatData, intData) {
      const d = this.device;
      const U = GPUBufferUsage;
      this.trackBuffer('weights', uploadTypedArray(d, 'FQ1 packed weights', floatData, U.STORAGE));
      this.trackBuffer('ints', uploadTypedArray(d, 'FQ1 feature tables', intData, U.STORAGE));
      this.trackBuffer('lanes', makeBuffer(d, 'FQ1 lanes', this.laneCapacity * LANE_STRIDE, U.STORAGE | U.COPY_DST));
      this.trackBuffer('params', makeBuffer(d, 'FQ1 params', 16, U.UNIFORM | U.COPY_DST));
      this.trackBuffer('stateFeatures', makeBuffer(d, 'FQ1 state features', this.laneCapacity * 42 * 4, U.STORAGE));
      this.trackBuffer('actionFeatures', makeBuffer(d, 'FQ1 action features', this.laneCapacity * 6 * 51 * 4, U.STORAGE));
      this.trackBuffer('legal', makeBuffer(d, 'FQ1 legal mask', this.laneCapacity * 6 * 4, U.STORAGE));
      this.trackBuffer('global', makeBuffer(d, 'FQ1 global tokens', this.laneCapacity * 576 * 4, U.STORAGE));
      this.trackBuffer('actionTokens', makeBuffer(d, 'FQ1 action tokens', this.laneCapacity * 6 * 576 * 4, U.STORAGE));
      this.trackBuffer('tokenA', makeBuffer(d, 'FQ1 token A', this.laneCapacity * 7 * 576 * 4, U.STORAGE));
      this.trackBuffer('tokenB', makeBuffer(d, 'FQ1 token B', this.laneCapacity * 7 * 576 * 4, U.STORAGE));
      this.trackBuffer('norm', makeBuffer(d, 'FQ1 norm scratch', this.laneCapacity * 7 * 576 * 4, U.STORAGE));
      this.trackBuffer('qkv', makeBuffer(d, 'FQ1 QKV', this.laneCapacity * 7 * 1728 * 4, U.STORAGE));
      this.trackBuffer('attended', makeBuffer(d, 'FQ1 attention output', this.laneCapacity * 7 * 576 * 4, U.STORAGE));
      this.trackBuffer('ff', makeBuffer(d, 'FQ1 feed-forward scratch', this.laneCapacity * 7 * 2304 * 4, U.STORAGE));
      this.trackBuffer('advHidden', makeBuffer(d, 'FQ1 advantage hidden', this.laneCapacity * 6 * 576 * 4, U.STORAGE));
      this.trackBuffer('actions', makeBuffer(d, 'FQ1 actions', this.laneCapacity * 4, U.STORAGE | U.COPY_SRC | U.COPY_DST));
      this.trackBuffer('doneCount', makeBuffer(d, 'FQ1 done counter', 4, U.STORAGE | U.COPY_SRC | U.COPY_DST));
      this.trackBuffer('scores', makeBuffer(d, 'FQ1 scores', this.laneCapacity * 4, U.STORAGE | U.COPY_SRC));
      this.trackBuffer('countReadback', makeBuffer(d, 'FQ1 count readback', 4, U.COPY_DST | U.MAP_READ));
      this.trackBuffer('scoreReadback', makeBuffer(d, 'FQ1 score readback', this.laneCapacity * 4, U.COPY_DST | U.MAP_READ));
    }

    async createPipeline(label, source) {
      const module = this.device.createShaderModule({ label: `${label} shader`, code: source });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter(message => message.type === 'error');
      if (errors.length) {
        const detail = errors.map(error => `${error.lineNum}:${error.linePos} ${error.message}`).join('\n');
        throw new Error(`${label} WGSL compilation failed:\n${detail}`);
      }
      return this.device.createComputePipelineAsync({
        label,
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });
    }

    async createPipelines() {
      const f = name => this.floatOffsets[name];
      const jobs = [];

      jobs.push(this.createPipeline('FQ1 feature', featureShaderSource(this.floatOffsets, this.intOffsets, Number(this.policy.header.feature.x36_quality_scale)))
        .then(pipeline => { this.pipelines.feature = pipeline; }));
      jobs.push(this.createPipeline('FQ1 global encoder', encoderShaderSource({
        inputWidth: 42,
        rowsPerLane: 1,
        weightOffset: f('global_encoder.0.weight'),
        biasOffset: f('global_encoder.0.bias'),
        normWeightOffset: f('global_encoder.2.weight'),
        normBiasOffset: f('global_encoder.2.bias'),
      })).then(pipeline => { this.pipelines.global = pipeline; }));
      jobs.push(this.createPipeline('FQ1 action encoder', encoderShaderSource({
        inputWidth: 51,
        rowsPerLane: 6,
        weightOffset: f('action_encoder.0.weight'),
        biasOffset: f('action_encoder.0.bias'),
        normWeightOffset: f('action_encoder.2.weight'),
        normBiasOffset: f('action_encoder.2.bias'),
      })).then(pipeline => { this.pipelines.action = pipeline; }));
      jobs.push(this.createPipeline('FQ1 combine tokens', combineShaderSource())
        .then(pipeline => { this.pipelines.combine = pipeline; }));
      jobs.push(this.createPipeline('FQ1 attention', attentionShaderSource())
        .then(pipeline => { this.pipelines.attention = pipeline; }));
      jobs.push(this.createPipeline('FQ1 final norm', normShaderSource(
        f('final_norm.weight'), f('final_norm.bias')
      )).then(pipeline => { this.pipelines.finalNorm = pipeline; }));
      jobs.push(this.createPipeline('FQ1 advantage hidden', advantageHiddenShaderSource(
        f('advantage.0.weight'), f('advantage.0.bias')
      )).then(pipeline => { this.pipelines.advHidden = pipeline; }));
      jobs.push(this.createPipeline('FQ1 argmax', argmaxShaderSource(
        f('advantage.2.weight'), f('advantage.2.bias')
      )).then(pipeline => { this.pipelines.argmax = pipeline; }));
      jobs.push(this.createPipeline('FQ1 environment', environmentShaderSource(this.intOffsets))
        .then(pipeline => { this.pipelines.environment = pipeline; }));
      jobs.push(this.createPipeline('FQ1 extract', extractShaderSource())
        .then(pipeline => { this.pipelines.extract = pipeline; }));

      for (let layer = 0; layer < 4; layer++) {
        const prefix = `interaction.layers.${layer}.`;
        const target = {};
        this.layerPasses[layer] = target;
        jobs.push(this.createPipeline(`FQ1 layer ${layer} norm1`, normShaderSource(
          f(`${prefix}norm1.weight`), f(`${prefix}norm1.bias`)
        )).then(pipeline => { target.norm1 = pipeline; }));
        jobs.push(this.createPipeline(`FQ1 layer ${layer} qkv`, linearShaderSource({
          inputWidth: 576,
          outputWidth: 1728,
          rowsPerLane: 7,
          weightOffset: f(`${prefix}self_attn.in_proj_weight`),
          biasOffset: f(`${prefix}self_attn.in_proj_bias`),
        })).then(pipeline => { target.qkv = pipeline; }));
        jobs.push(this.createPipeline(`FQ1 layer ${layer} out`, linearShaderSource({
          inputWidth: 576,
          outputWidth: 576,
          rowsPerLane: 7,
          weightOffset: f(`${prefix}self_attn.out_proj.weight`),
          biasOffset: f(`${prefix}self_attn.out_proj.bias`),
          residual: true,
        })).then(pipeline => { target.out = pipeline; }));
        jobs.push(this.createPipeline(`FQ1 layer ${layer} norm2`, normShaderSource(
          f(`${prefix}norm2.weight`), f(`${prefix}norm2.bias`)
        )).then(pipeline => { target.norm2 = pipeline; }));
        jobs.push(this.createPipeline(`FQ1 layer ${layer} ff1`, linearShaderSource({
          inputWidth: 576,
          outputWidth: 2304,
          rowsPerLane: 7,
          weightOffset: f(`${prefix}linear1.weight`),
          biasOffset: f(`${prefix}linear1.bias`),
          activation: true,
        })).then(pipeline => { target.ff1 = pipeline; }));
        jobs.push(this.createPipeline(`FQ1 layer ${layer} ff2`, linearShaderSource({
          inputWidth: 2304,
          outputWidth: 576,
          rowsPerLane: 7,
          weightOffset: f(`${prefix}linear2.weight`),
          biasOffset: f(`${prefix}linear2.bias`),
          residual: true,
        })).then(pipeline => { target.ff2 = pipeline; }));
      }

      await Promise.all(jobs);
    }

    bind(pipeline, buffers) {
      return this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: buffers.map((buffer, binding) => ({
          binding,
          resource: { buffer },
        })),
      });
    }

    createBindGroups() {
      const b = this.buffers;
      this.bindGroups.feature = this.bind(this.pipelines.feature, [
        b.lanes, b.ints, b.weights, b.params, b.stateFeatures, b.actionFeatures, b.legal,
      ]);
      this.bindGroups.global = this.bind(this.pipelines.global, [
        b.lanes, b.stateFeatures, b.weights, b.params, b.global,
      ]);
      this.bindGroups.action = this.bind(this.pipelines.action, [
        b.lanes, b.actionFeatures, b.weights, b.params, b.actionTokens,
      ]);
      this.bindGroups.combine = this.bind(this.pipelines.combine, [
        b.lanes, b.global, b.actionTokens, b.params, b.tokenA,
      ]);
      this.bindGroups.attention = this.bind(this.pipelines.attention, [
        b.lanes, b.qkv, b.legal, b.params, b.attended,
      ]);
      this.bindGroups.finalNorm = this.bind(this.pipelines.finalNorm, [
        b.lanes, b.tokenA, b.weights, b.params, b.norm,
      ]);
      this.bindGroups.advHidden = this.bind(this.pipelines.advHidden, [
        b.lanes, b.norm, b.weights, b.params, b.advHidden,
      ]);
      this.bindGroups.argmax = this.bind(this.pipelines.argmax, [
        b.lanes, b.advHidden, b.weights, b.legal, b.params, b.actions,
      ]);
      this.bindGroups.environment = this.bind(this.pipelines.environment, [
        b.lanes, b.ints, b.params, b.actions, b.doneCount,
      ]);
      this.bindGroups.extract = this.bind(this.pipelines.extract, [
        b.lanes, b.params, b.scores,
      ]);

      for (let layer = 0; layer < 4; layer++) {
        const p = this.layerPasses[layer];
        p.norm1Bind = this.bind(p.norm1, [b.lanes, b.tokenA, b.weights, b.params, b.norm]);
        p.qkvBind = this.bind(p.qkv, [b.lanes, b.norm, b.weights, b.params, b.qkv]);
        p.outBind = this.bind(p.out, [b.lanes, b.attended, b.weights, b.params, b.tokenB, b.tokenA]);
        p.norm2Bind = this.bind(p.norm2, [b.lanes, b.tokenB, b.weights, b.params, b.norm]);
        p.ff1Bind = this.bind(p.ff1, [b.lanes, b.norm, b.weights, b.params, b.ff]);
        p.ff2Bind = this.bind(p.ff2, [b.lanes, b.ff, b.weights, b.params, b.tokenA, b.tokenB]);
      }
    }

    ensureAvailable() {
      if (this.destroyed) throw new Error('FQ1 WebGPU engine has been destroyed.');
      if (this.lostInfo) throw new Error(`WebGPU device lost: ${this.lostInfo.message || this.lostInfo.reason}`);
    }

    writeParams(laneCount) {
      this.paramsData[0] = laneCount >>> 0;
      this.paramsData[1] = 0;
      this.paramsData[2] = 0;
      this.paramsData[3] = 0;
      this.device.queue.writeBuffer(this.buffers.params, 0, this.paramsData);
    }

    fillStateBuffer(rawStates, seedBase = 1, seedOptions = null) {
      const bytes = new Uint8Array(this.initialStateBytes);
      bytes.fill(0);
      const view = new DataView(this.initialStateBytes);
      for (let lane = 0; lane < rawStates.length; lane++) {
        const raw = rawStates[lane];
        const base = lane * LANE_STRIDE;
        const score = clampInt(raw[2], 1, 2898);
        const cards = raw.slice(7, 12).map(value => clampInt(value, 0, 30));
        let handCount = 0;
        for (const card of cards) if (card) handCount++;
        let acquired = 0;
        for (let card = 0; card < 30; card++) {
          if (raw[12 + card]) acquired |= (1 << card);
        }
        view.setInt32(base + 0, score, true);
        view.setInt32(base + 4, clampInt(raw[5], 0, 100000), true);
        view.setInt32(base + 8, raw[6] ? 1 : 0, true);
        view.setInt32(base + 12, handCount, true);
        for (let slot = 0; slot < 5; slot++) {
          view.setInt32(base + 16 + slot * 4, cards[slot], true);
        }
        view.setUint32(base + 36, acquired >>> 0, true);
        const rng = seedOptions
          ? (
              (seedOptions.seed >>> 0) +
              Math.imul((seedOptions.rolloutOffset + lane) >>> 0, 747796405) +
              Math.imul((seedOptions.rootAction || 0) >>> 0, 9173) +
              2891336453
            ) >>> 0
          : mixSeed((seedBase + Math.imul(lane + 1, 0x9e3779b9)) >>> 0);
        view.setUint32(base + 40, rng, true);
        view.setUint32(base + 44, 0, true);
      }
      this.device.queue.writeBuffer(
        this.buffers.lanes,
        0,
        this.initialStateBytes,
        0,
        rawStates.length * LANE_STRIDE,
      );
      this.device.queue.writeBuffer(this.buffers.doneCount, 0, new Uint32Array([0]));
      this.writeParams(rawStates.length);
    }

    fillRepeatedState(rawState, count, seedBase, rootAction = 0, rolloutOffset = 0) {
      const states = new Array(count);
      for (let index = 0; index < count; index++) states[index] = rawState;
      this.fillStateBuffer(states, seedBase, { seed: seedBase, rootAction, rolloutOffset });
    }

    dispatch(pass, pipeline, bindGroup, workgroups) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.max(1, workgroups));
    }

    encodeInference(pass, laneCount) {
      this.dispatch(pass, this.pipelines.feature, this.bindGroups.feature, ceilDiv(laneCount, 64));
      this.dispatch(pass, this.pipelines.global, this.bindGroups.global, laneCount);
      this.dispatch(pass, this.pipelines.action, this.bindGroups.action, laneCount * 6);
      this.dispatch(pass, this.pipelines.combine, this.bindGroups.combine, ceilDiv(laneCount * 7 * 576, 64));

      for (let layer = 0; layer < 4; layer++) {
        const p = this.layerPasses[layer];
        this.dispatch(pass, p.norm1, p.norm1Bind, laneCount * 7);
        this.dispatch(pass, p.qkv, p.qkvBind, ceilDiv(laneCount * 7 * 1728, 64));
        this.dispatch(pass, this.pipelines.attention, this.bindGroups.attention, laneCount * 56);
        this.dispatch(pass, p.out, p.outBind, ceilDiv(laneCount * 7 * 576, 64));
        this.dispatch(pass, p.norm2, p.norm2Bind, laneCount * 7);
        this.dispatch(pass, p.ff1, p.ff1Bind, ceilDiv(laneCount * 7 * 2304, 64));
        this.dispatch(pass, p.ff2, p.ff2Bind, ceilDiv(laneCount * 7 * 576, 64));
      }

      this.dispatch(pass, this.pipelines.finalNorm, this.bindGroups.finalNorm, laneCount * 7);
      this.dispatch(pass, this.pipelines.advHidden, this.bindGroups.advHidden, ceilDiv(laneCount * 6 * 576, 64));
      this.dispatch(pass, this.pipelines.argmax, this.bindGroups.argmax, laneCount);
    }

    encodeEnvironment(pass, laneCount) {
      this.dispatch(pass, this.pipelines.environment, this.bindGroups.environment, ceilDiv(laneCount, 64));
    }

    async readDoneCount() {
      await this.buffers.countReadback.mapAsync(GPUMapMode.READ);
      const count = new Uint32Array(this.buffers.countReadback.getMappedRange())[0];
      this.buffers.countReadback.unmap();
      return count;
    }

    async readScores(count) {
      await this.buffers.scoreReadback.mapAsync(GPUMapMode.READ);
      const mapped = new Uint32Array(this.buffers.scoreReadback.getMappedRange(), 0, count);
      const result = Int32Array.from(mapped, Number);
      this.buffers.scoreReadback.unmap();
      return result;
    }

    async predictActions(rawStates) {
      this.ensureAvailable();
      const output = new Uint32Array(rawStates.length);
      for (let start = 0; start < rawStates.length; start += this.laneCapacity) {
        const batch = rawStates.slice(start, start + this.laneCapacity);
        this.fillStateBuffer(batch, 0x51f10000 + start);
        const encoder = this.device.createCommandEncoder({ label: 'FQ1 predict actions' });
        const pass = encoder.beginComputePass();
        this.encodeInference(pass, batch.length);
        pass.end();
        encoder.copyBufferToBuffer(this.buffers.actions, 0, this.buffers.scoreReadback, 0, batch.length * 4);
        this.device.queue.submit([encoder.finish()]);
        await this.buffers.scoreReadback.mapAsync(GPUMapMode.READ);
        const values = new Uint32Array(this.buffers.scoreReadback.getMappedRange(), 0, batch.length);
        output.set(values, start);
        this.buffers.scoreReadback.unmap();
      }
      return output;
    }

    async run(rawState, rootAction, rolloutCount, seed, options = {}) {
      this.ensureAvailable();
      const total = clampInt(rolloutCount, 1, 1 << 24);
      const result = new Int32Array(total);
      let completed = 0;
      while (completed < total) {
        if (options.isCancelled?.()) throw new Error('FQ1 WebGPU calculation cancelled.');
        const count = Math.min(this.laneCapacity, total - completed);
        const chunk = await this.runChunk(
          rawState,
          rootAction,
          count,
          seed >>> 0,
          completed,
          options,
        );
        result.set(chunk, completed);
        completed += count;
        options.onProgress?.(completed, total);
      }
      return result;
    }

    async runChunk(rawState, rootAction, count, seed, rolloutOffset, options) {
      this.ensureAvailable();
      this.fillRepeatedState(rawState, count, seed, rootAction, rolloutOffset);
      this.rootActions.fill(rootAction >>> 0, 0, count);
      this.device.queue.writeBuffer(this.buffers.actions, 0, this.rootActions, 0, count * 4);

      let continuationSteps = 0;
      let done = 0;
      let includeRoot = true;
      while (continuationSteps < MAX_CONTINUATION_STEPS && done < count) {
        if (options.isCancelled?.()) throw new Error('FQ1 WebGPU calculation cancelled.');
        const stepsThisBlock = Math.min(this.checkInterval, MAX_CONTINUATION_STEPS - continuationSteps);
        const encoder = this.device.createCommandEncoder({ label: 'FQ1 rollout block' });
        const pass = encoder.beginComputePass();
        if (includeRoot) {
          this.encodeEnvironment(pass, count);
          includeRoot = false;
        }
        for (let index = 0; index < stepsThisBlock; index++) {
          this.encodeInference(pass, count);
          this.encodeEnvironment(pass, count);
        }
        pass.end();
        encoder.copyBufferToBuffer(this.buffers.doneCount, 0, this.buffers.countReadback, 0, 4);
        this.device.queue.submit([encoder.finish()]);
        done = await this.readDoneCount();
        continuationSteps += stepsThisBlock;
        options.onStep?.(continuationSteps, count - done, count);
      }

      const encoder = this.device.createCommandEncoder({ label: 'FQ1 extract scores' });
      const pass = encoder.beginComputePass();
      this.dispatch(pass, this.pipelines.extract, this.bindGroups.extract, ceilDiv(count, 64));
      pass.end();
      encoder.copyBufferToBuffer(this.buffers.scores, 0, this.buffers.scoreReadback, 0, count * 4);
      this.device.queue.submit([encoder.finish()]);
      return this.readScores(count);
    }

    async verifyParity(states, options = {}) {
      const actual = Array.from(await this.predictActions(states));
      const failures = [];
      for (let index = 0; index < states.length; index++) {
        const prediction = this.policy.predict(states[index]);
        if (prediction.action === actual[index]) continue;
        const legalValues = prediction.qValues
          .map((value, action) => ({ value, action }))
          .filter(item => Number.isFinite(item.value))
          .sort((left, right) => right.value - left.value);
        const margin = legalValues.length > 1 ? legalValues[0].value - legalValues[1].value : Infinity;
        const failure = {
          index,
          expected: prediction.action,
          actual: actual[index],
          margin,
          qValues: prediction.qValues,
        };
        failures.push(failure);
        if (margin > (options.allowedNearTieMargin ?? 0.05)) {
          throw new Error(
            `FQ1 WebGPU parity failed at case ${index}: CPU=${prediction.action}, GPU=${actual[index]}, margin=${margin}`
          );
        }
      }
      if (failures.length) console.warn('FQ1 WebGPU near-tie parity warnings.', failures);
      return { ok: true, failures };
    }

    diagnostics() {
      return {
        backend: 'raw-webgpu',
        laneCapacity: this.laneCapacity,
        checkInterval: this.checkInterval,
        allocatedBytes: this.totalGpuBytes,
        allocatedMiB: this.totalGpuBytes / 1048576,
        adapter: this.adapter?.info || null,
        limits: this.adapter?.limits || null,
        deviceLost: this.lostInfo || null,
      };
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const buffer of Object.values(this.buffers)) {
        try { buffer.destroy(); } catch (_) {}
      }
      this.buffers = Object.create(null);
      try { this.device?.destroy(); } catch (_) {}
    }
  }

  return Engine;
});
