const $ = id => document.getElementById(id);
const GPU_WORKGROUP_SIZE = 64;
const GPU_PARTIAL_STRIDE = 5;

function log(line) {
  if ($('log')) $('log').textContent += `${line}\n`;
}

function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

function shaderSource() {
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

fn next_rand(rng: ptr<function, u32>) -> u32 {
  var t = (*rng) + 0x6D2B79F5u;
  (*rng) = t;
  var r = (t ^ (t >> 15u)) * (1u | t);
  r = r ^ (r + ((r ^ (r >> 7u)) * 61u));
  return r ^ (r >> 14u);
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
  let val1 = i32(next_rand(rng) % 6u) + 1;
  let val2 = i32(next_rand(rng) % 6u) + 1;
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

  let pickedOffset = next_rand(rng) % remaining;
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

fn same_stage_count50(score: i32) -> i32 {
  var cnt = 0;
  for (var pos = min(2897, score + 1); pos < min(2897, score + 50); pos = pos + 1) {
    if (stage_id_at(pos) == stage_id_at(score - 1)) { cnt = cnt + 1; }
  }
  return cnt;
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

fn current_best_roll_value_x36(score: i32, handCount: i32) -> i32 {
  let canGainCard = handCount < 5;
  var total = 0;
  for (var diceSum = 2; diceSum <= 12; diceSum = diceSum + 1) {
    let landing = raw_landing_after_move(score, diceSum, true);
    let eventType = stage_event_at(landing - 1);
    var value = 0;
    if (eventType == 2 && canGainCard) {
      value = value + 179;
    } else if (eventType == 4) {
      value = value + max(0, stage_move_at(landing - 1)) * 2;
      if (canGainCard) {
        let projected = projected_score_after_move(score, diceSum, true);
        if (projected >= 1 && projected <= 2898 && stage_event_at(projected - 1) == 2) {
          value = value + 299;
        }
      }
    }
    total = total + dice_sum_weight(diceSum) * value;
  }
  return total;
}

fn current_best_card_post_x36(diceUse: i32, handCount: i32) -> i32 {
  var value = 0;
  if (handCount == 5 || diceUse + handCount >= 100) { value = value + 98 * 36; }
  if (diceUse >= 70) { value = value + 3 * 36; }
  return value;
}

fn current_best_move_value_x36(score: i32, diceUse: i32, action: u32, hand: ptr<function, array<i32, 5>>, handCount: i32, cValue: i32) -> i32 {
  let landing = raw_landing_after_move(score, cValue, false);
  let eventType = stage_event_at(landing - 1);
  var total = current_best_card_post_x36(diceUse, handCount) - 80 * 36;
  if (eventType == 2) {
    total = total + 139 * 36;
  } else if (eventType == 4) {
    total = total + max(0, stage_move_at(landing - 1)) * 2 * 36;
    let projected = projected_score_after_move(score, cValue, false);
    if (projected >= 1 && projected <= 2898 && stage_event_at(projected - 1) == 2) {
      total = total + 101 * 36;
    }
  }
  if (move_chain_card_option(score, action, hand, handCount)) {
    total = total + 37 * 36;
  }
  return total;
}

fn current_best_mult_value_x36(score: i32, diceUse: i32, handCount: i32, cValue: i32) -> i32 {
  var total = current_best_card_post_x36(diceUse, handCount) - 20 * 36;
  for (var diceSum = 2; diceSum <= 12; diceSum = diceSum + 1) {
    let rawValue = diceSum * cValue;
    let landing = raw_landing_after_move(score, rawValue, false);
    let eventType = stage_event_at(landing - 1);
    var value = 0;
    if (eventType == 2) {
      value = value + 142;
    } else if (eventType == 4) {
      value = value + max(0, stage_move_at(landing - 1)) * 2;
      let projected = projected_score_after_move(score, rawValue, false);
      if (projected >= 1 && projected <= 2898 && stage_event_at(projected - 1) == 2) {
        value = value + 141;
      }
    }
    total = total + dice_sum_weight(diceSum) * value;
  }
  return total;
}

fn current_best_stage_value_x36(score: i32, diceUse: i32, handCount: i32, cValue: i32) -> i32 {
  let rawValue = stage_card_move(score, cValue);
  let landing = raw_landing_after_move(score, rawValue, false);
  var total = current_best_card_post_x36(diceUse, handCount) - 2 * 36 + same_stage_count50(score) * 36;
  if (stage_event_at(landing - 1) == 4) {
    total = total + max(0, stage_move_at(landing - 1)) * 2 * 36;
  }
  return total;
}

fn current_best_card_value_x36(score: i32, diceUse: i32, action: u32, hand: ptr<function, array<i32, 5>>, handCount: i32) -> i32 {
  let cardId = u32((*hand)[action - 1u]);
  let cType = cardType[cardId];
  let cValue = cardValue[cardId];
  if (cType == 1) { return current_best_move_value_x36(score, diceUse, action, hand, handCount, cValue); }
  if (cType == 2) { return current_best_mult_value_x36(score, diceUse, handCount, cValue); }
  if (cType == 3) { return current_best_stage_value_x36(score, diceUse, handCount, cValue); }
  return -2147483648;
}

fn choose_action(score: i32, diceUse: i32, hand: ptr<function, array<i32, 5>>, handCount: i32) -> u32 {
  var bestAction = 0u;
  var bestValue = current_best_roll_value_x36(score, handCount);
  let actionCount = u32(handCount + 1);
  for (var action = 1u; action < actionCount; action = action + 1u) {
    let value = current_best_card_value_x36(score, diceUse, action, hand, handCount);
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
      let action = choose_action(score, diceUse, &hand, handCount);
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
    const shader = device.createShaderModule({ code: shaderSource() });
    const pipelineDescriptor = {
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    };
    const pipeline = typeof device.createComputePipelineAsync === 'function'
      ? await device.createComputePipelineAsync(pipelineDescriptor)
      : device.createComputePipeline(pipelineDescriptor);
    return {
      adapter,
      device,
      pipeline,
      stageId: createStorageBuffer(device, new Int32Array(tables.stageId)),
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
  for (let record = 0; record < recordCount; record += 1) {
    let base = (recordOffset + record) * GPU_PARTIAL_STRIDE;
    let partialCount = partials[base];
    if (partialCount === 0) continue;
    count += partialCount;
    sum += partials[base + 1];
    sumSq += partials[base + 2];
    min = Math.min(min, partials[base + 3]);
    max = Math.max(max, partials[base + 4]);
  }
  if (count === 0) return { count: 0, mean: 0, std: 0, min: 0, max: 0 };
  let mean = sum / count;
  let variance = Math.max(0, sumSq / count - mean * mean);
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
  const readResult = await submitAndReadU32({
    device,
    encoder,
    readBuffer,
    started,
  });
  const summary = summaryFromPartials(readResult.values, 0, recordCount);

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
  const readResult = await submitAndReadU32({
    device,
    encoder,
    readBuffer,
    started,
  });
  const summaries = [];
  for (let action = 0; action < actionCount; action += 1) {
    summaries.push({
      action,
      ...summaryFromPartials(readResult.values, action * workgroupsPerAction, workgroupsPerAction),
    });
  }
  const bestAction = summaries.reduce((best, summary) => (summary.mean > summaries[best].mean ? summary.action : best), 0);

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
      for (let i = 0; i < repeat; i += 1) {
        await run({ clear: i === 0 });
      }
    })();
  }
}
