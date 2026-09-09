import { environmentShader } from "../../environment/wgsl.js";
import { policyShader } from "../../policies/g3/wgsl.js";
const bindings = `struct Params {
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
const PARTIAL_STRIDE = 6u;`;
const reduction = `var<workgroup> partialTruncated: array<u32, 64>;
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
  var actionIndex = params.action;
  if (params.mode == 1u) {
    actionIndex = workgroupId.y;
  } else if (params.mode == 2u) {
    actionIndex = u32(inputState[42u + workgroupId.y]);
  }

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
      let action = choose_action(score, diceUse, isDouble, &hand, handCount, obtained);
      done = step_once(&score, &diceUse, &isDouble, &hand, &handCount, &obtained, &rng, action);
    }
    let scoreValue = u32(score);
    partialTruncated[lane] = select(1u, 0u, done);
    partialCount[lane] = 1u;
    partialSum[lane] = scoreValue;
    partialSumSq[lane] = scoreValue * scoreValue;
    partialMin[lane] = scoreValue;
    partialMax[lane] = scoreValue;
  } else {
    partialTruncated[lane] = 0u;
    partialCount[lane] = 0u;
    partialSum[lane] = 0u;
    partialSumSq[lane] = 0u;
    partialMin[lane] = 4294967295u;
    partialMax[lane] = 0u;
  }

  workgroupBarrier();

  for (var offset = WORKGROUP_SIZE / 2u; offset > 0u; offset = offset / 2u) {
    if (lane < offset) {
      partialTruncated[lane] += partialTruncated[lane + offset];
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
    let actionOffset = select(0u, workgroupId.y * workgroupsPerAction, params.mode != 0u);
    let base = (actionOffset + workgroupId.x) * PARTIAL_STRIDE;
    partials[base + 0u] = partialCount[0];
    partials[base + 1u] = partialSum[0];
    partials[base + 2u] = partialSumSq[0];
    partials[base + 3u] = select(0u, partialMin[0], partialCount[0] > 0u);
    partials[base + 4u] = partialMax[0];
    partials[base + 5u] = partialTruncated[0];
  }
}`;
export const shaderSource = (tables) =>
  [bindings, environmentShader, policyShader(tables), reduction].join(`
`);
