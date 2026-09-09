import {
  policyStage as stage,
  policyCards as cardInfo,
} from "../../rules/index.js";
const X36_POLICY_VERSION = "X36-G3";
const X36_WEIGHTS = Object.freeze({
  rollCard: 234.154,
  rollJump: 2.474,
  rollJumpCard: 187.074,
  handPressure: 96.072,
  lateBonus: 4.423,
  lateThreshold: 70,
  lateFamilyThreshold: 95,
  lateMove: 52.506,
  lateMult: 59.091,
  lateStage: 44.838,
  moveCost: 79.155,
  moveCard: 137.845,
  moveJump: 2.733,
  moveJumpCard: 83.176,
  chain: 36.783,
  multCost: 18.355,
  multCard: 128.161,
  multJump: 2.787,
  multJumpCard: 83.883,
  stageCost: 4.55,
  stageSame50: 1.74,
  handQualityRetention: 102.989,
  nextCardPressure: -30,
  terminalContinuous: -0.176,
  chainLatePenalty: 0,
  stageAltMovePenalty: 2.372,
  stageActualMove: 0,
  stageDestination: -43.919,
  poolQualityCard: 0.325,
  futureCardP3: 133.78,
});

const X36_DICE_SUM_WEIGHT = Object.freeze({
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
});

let x36CpuLutCache = null;

function x36StaticCardQuality(cardId) {
  const card = cardInfo[cardId - 1];
  if (!card) return 0;
  if (card[1] === 1) return Math.max(-0.3, Math.min(1.3, Number(card[2]) / 10));
  if (card[1] === 2) return Math.min(1.5, Number(card[2]) / 8);
  return 0.8;
}

function buildX36CpuLuts() {
  const size = 2898;
  const stride = size + 1;
  const nextCardProbability = new Float64Array(size + 1);
  const localQuality = new Float64Array(size + 1);
  const sameStage50 = new Uint8Array(size + 1);
  const staticCardQuality = new Float64Array(31);
  const rollProjected = new Uint16Array((size + 1) * 11);
  const rollGainsCard = new Uint8Array((size + 1) * 11);
  let futureCardP3 = new Float32Array(8 * stride);
  let totalCardQuality = 0;

  const stageIdAt = (index) =>
    index < 0 || index >= size ? 0 : Number(stage[index][1] || 0);
  const stageMoveAt = (index) =>
    index < 0 || index >= size ? 0 : Number(stage[index][4] || 0);
  const stageEventAt = (index) =>
    index < 0 || index >= size ? 0 : Number(stage[index][5] || 0);

  const rawLandingAfterMove = (fromScore, rawValue, stop) => {
    let value = rawValue;
    if (stop) {
      const endIndex = Math.min(2897, fromScore + value - 1);
      for (let i = fromScore; i < endIndex; i++) {
        const eventType = stageEventAt(i);
        if (eventType === 6 || eventType === 9) {
          value = i - fromScore + 1;
          break;
        }
      }
    }
    return Math.min(2898, Math.max(1, fromScore + value));
  };

  const projectedScoreAfterMove = (fromScore, rawValue, stop) => {
    let projected = rawLandingAfterMove(fromScore, rawValue, stop);
    for (let guard = 0; guard < 16; guard++) {
      if (stageEventAt(projected - 1) !== 4) break;
      projected = Math.min(2898, projected + stageMoveAt(projected - 1));
    }
    return projected;
  };

  for (let id = 1; id <= 30; id++) {
    const quality = x36StaticCardQuality(id);
    staticCardQuality[id] = quality;
    totalCardQuality += quality;
  }

  for (let score = 1; score <= size; score++) {
    let nextCard = 0;
    let local = 0;
    for (let diceSum = 2; diceSum <= 12; diceSum++) {
      const weight = X36_DICE_SUM_WEIGHT[diceSum];
      const landing = rawLandingAfterMove(score, diceSum, true);
      const projected = projectedScoreAfterMove(score, diceSum, true);
      const eventType = stageEventAt(landing - 1);
      const rollIndex = score * 11 + diceSum - 2;
      rollProjected[rollIndex] = projected;
      if (
        eventType === 2 ||
        (eventType === 4 && stageEventAt(projected - 1) === 2)
      ) {
        nextCard += weight;
        rollGainsCard[rollIndex] = 1;
      }
      if (eventType === 2) {
        local += weight;
      } else if (eventType === 4) {
        local +=
          weight *
          (Math.max(0, stageMoveAt(landing - 1)) / 12 +
            (stageEventAt(projected - 1) === 2 ? 1 : 0));
      }
    }
    nextCardProbability[score] = nextCard / 36;
    localQuality[score] = local / 36;

    let count = 0;
    for (
      let pos = Math.min(2897, score + 1);
      pos < Math.min(2897, score + 50);
      pos++
    ) {
      if (stageIdAt(pos) === stageIdAt(score - 1)) count++;
    }
    sameStage50[score] = count;
  }

  const futureIndex = (remainingPaid, isDouble, score) =>
    (remainingPaid * 2 + isDouble) * stride + score;
  let previous = new Float32Array(8 * stride);
  for (let depth = 1; depth <= 3; depth++) {
    const current = new Float32Array(8 * stride);
    for (let remainingPaid = 0; remainingPaid <= 3; remainingPaid++) {
      for (let isDouble = 0; isDouble <= 1; isDouble++) {
        if (remainingPaid === 0 && isDouble === 0) continue;
        for (let score = 1; score <= size; score++) {
          let probability = 0;
          for (let die1 = 1; die1 <= 6; die1++) {
            for (let die2 = 1; die2 <= 6; die2++) {
              const rollIndex = score * 11 + die1 + die2 - 2;
              const projected = rollProjected[rollIndex];
              const gained = rollGainsCard[rollIndex] !== 0;
              const nextRemaining = isDouble
                ? remainingPaid
                : Math.max(0, remainingPaid - 1);
              const nextDouble = isDouble ? 0 : die1 === die2 ? 1 : 0;
              probability += gained
                ? 1
                : previous[futureIndex(nextRemaining, nextDouble, projected)];
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

  return {
    nextCardProbability,
    localQuality,
    sameStage50,
    staticCardQuality,
    totalCardQuality,
    futureCardP3,
  };
}

function getX36CpuLuts() {
  if (!x36CpuLutCache) x36CpuLutCache = buildX36CpuLuts();
  return x36CpuLutCache;
}
export { X36_WEIGHTS, X36_POLICY_VERSION, getX36CpuLuts };
