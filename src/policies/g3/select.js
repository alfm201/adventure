// G3 Full-E (A+C+D+H): Float64 lookup tables preserve accumulation order.
// Provenance and parity gates: docs/CPU_ENGINE_UPDATE.md
import {policyStage as stage} from '../../rules/index.js';
import {X36_WEIGHTS,getX36CpuLuts} from './tables.js';
const X36_DICE_SUM_WEIGHT={2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1};
const luts = getX36CpuLuts();
const size = 2898;
const stride = size + 1;

const stageIdAt = (index) => (index < 0 || index >= size ? 0 : Number(stage[index][1] || 0));
const stageMoveAt = (index) => (index < 0 || index >= size ? 0 : Number(stage[index][4] || 0));
const stageEventAt = (index) => (index < 0 || index >= size ? 0 : Number(stage[index][5] || 0));

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

const MULT_MAP = { 2: 1, 3: 2, 5: 3, 7: 4, 8: 5, 10: 6 };
const MULT_VALUES = [1, 2, 3, 5, 7, 8, 10];

// === Precomputed LUTs ===============================================
// (A) Expected futureCardP3 LUT
// shape: 7 families x 2 isDouble x 4 effRemaining x 2899 scores
// eff: isDouble ? clamp(0,3, 100-diceUse) : clamp(0,3, 99-diceUse)
// Phase transition semantics (운영 successorFutureCardP3의 lookup과 정확히 일치):
//   isDouble=true  -> nextRemaining = clamp(100 - diceUse) = eff
//   isDouble=false -> nextRemaining = clamp(99 - diceUse)  = eff
// 즉, paid roll 후에도 nextRemaining = eff (board.js의 futureCardP3 build의 max(0, phase-1)와 다른 운영 의미).
const expectedFutureP3Lut = new Float64Array(7 * 2 * 4 * stride);

function expectedFutureLutIndex(family, isDouble, effRemaining, score) {
  return ((family * 2 + isDouble) * 4 + effRemaining) * stride + score;
}

for (let family = 0; family < 7; family++) {
  const mult = MULT_VALUES[family];
  const stop = family === 0;
  for (let isDouble = 0; isDouble <= 1; isDouble++) {
    for (let effRemaining = 0; effRemaining <= 3; effRemaining++) {
      for (let score = 1; score <= size; score++) {
        let total = 0;
        for (let die1 = 1; die1 <= 6; die1++) {
          for (let die2 = 1; die2 <= 6; die2++) {
            const rawValue = (die1 + die2) * mult;
            const position = projectedScoreAfterMove(score, rawValue, stop);
            const nextDouble = isDouble ? 0 : (die1 === die2 ? 1 : 0);
            const nextRemaining = effRemaining;
            const fIndex = (nextRemaining * 2 + nextDouble) * stride + position;
            total += Number(luts.futureCardP3[fIndex] || 0);
          }
        }
        expectedFutureP3Lut[expectedFutureLutIndex(family, isDouble, effRemaining, score)] = total;
      }
    }
  }
}

// (D) Roll / Multiplier coefficient LUT
const rollBaseWithCard = new Float64Array(stride);
const rollPoolCoeff = new Float64Array(stride);
const rollBaseNoCard = new Float64Array(stride);

const W = X36_WEIGHTS;

for (let score = 1; score <= size; score++) {
  let baseWith = 0;
  let poolCo = 0;
  let baseNo = 0;
  for (let diceSum = 2; diceSum <= 12; diceSum++) {
    const weight = X36_DICE_SUM_WEIGHT[diceSum];
    const landing = rawLandingAfterMove(score, diceSum, true);
    const projected = projectedScoreAfterMove(score, diceSum, true);
    const eventType = stageEventAt(landing - 1);
    if (eventType === 2) {
      baseWith += weight * W.rollCard;
      poolCo += weight * W.poolQualityCard;
    } else if (eventType === 4) {
      const jumpVal = weight * Math.max(0, stageMoveAt(landing - 1)) * W.rollJump;
      baseWith += jumpVal;
      baseNo += jumpVal;
      if (stageEventAt(projected - 1) === 2) {
        baseWith += weight * W.rollJumpCard;
        poolCo += weight * W.poolQualityCard;
      }
    }
  }
  rollBaseWithCard[score] = baseWith;
  rollPoolCoeff[score] = poolCo;
  rollBaseNoCard[score] = baseNo;
}

const multBaseValue = [
  null,
  new Float64Array(stride),
  new Float64Array(stride),
  new Float64Array(stride),
  new Float64Array(stride),
  new Float64Array(stride),
  new Float64Array(stride),
];

for (let f = 1; f <= 6; f++) {
  const mult = MULT_VALUES[f];
  const arr = multBaseValue[f];
  for (let score = 1; score <= size; score++) {
    let val = 0;
    for (let diceSum = 2; diceSum <= 12; diceSum++) {
      const weight = X36_DICE_SUM_WEIGHT[diceSum];
      const rawValue = diceSum * mult;
      const landing = rawLandingAfterMove(score, rawValue, false);
      const projected = projectedScoreAfterMove(score, rawValue, false);
      const eventType = stageEventAt(landing - 1);
      if (eventType === 2) {
        val += weight * W.multCard;
      } else if (eventType === 4) {
        val += weight * Math.max(0, stageMoveAt(landing - 1)) * W.multJump;
        if (stageEventAt(projected - 1) === 2) val += weight * W.multJumpCard;
      }
    }
    arr[score] = val;
  }
}

// (H) Move transition / chain LUT (move values: -3..12)
const MOVE_OFFSET = 3;
const moveLandingLut = Array.from({ length: 16 }, () => new Uint16Array(stride));
const moveProjectedLut = Array.from({ length: 16 }, () => new Uint16Array(stride));
const moveBaseValueLut = Array.from({ length: 16 }, () => new Float64Array(stride));

for (let m = -3; m <= 12; m++) {
  const idx = m + MOVE_OFFSET;
  for (let score = 1; score <= size; score++) {
    const landing = rawLandingAfterMove(score, m, false);
    const projected = projectedScoreAfterMove(score, m, false);
    moveLandingLut[idx][score] = landing;
    moveProjectedLut[idx][score] = projected;

    const eventType = stageEventAt(landing - 1);
    let val = 0;
    if (eventType === 2) {
      val += 36 * W.moveCard;
    } else if (eventType === 4) {
      val += 36 * Math.max(0, stageMoveAt(landing - 1)) * W.moveJump;
      if (stageEventAt(projected - 1) === 2) val += 36 * W.moveJumpCard;
    }
    moveBaseValueLut[idx][score] = val;
  }
}


export function chooseG3(board) {
  if (board.cards.length === 0) return 0;
  const cards = board.cards;
  const handCount = cards.length;
  const score = board.score;
  const diceUse = board.diceUse;
  const isDouble = board.isDouble ? 1 : 0;
  const effRemaining = Math.max(0, Math.min(3, isDouble ? 100 - diceUse : 99 - diceUse));
  const currentRemaining = Math.max(0, Math.min(3, 100 - diceUse));

  // 풀 계산 (E 미적용)
  let remainingQuality = luts.totalCardQuality;
  let remainingCount = 30;
  for (let i = 0; i < 30; i++) {
    if (board.cardInfo[i][3]) {
      remainingQuality -= luts.staticCardQuality[i + 1];
      remainingCount--;
    }
  }
  const poolQuality = remainingCount > 0 ? remainingQuality / remainingCount : 0;

  const rollFutureVal = expectedFutureP3Lut[expectedFutureLutIndex(0, isDouble, effRemaining, score)];
  let rollValue;
  if (handCount < 5) {
    rollValue = rollBaseWithCard[score] + (poolQuality - 0.75) * rollPoolCoeff[score] + rollFutureVal * W.futureCardP3;
  } else {
    rollValue = rollBaseNoCard[score] + rollFutureVal * W.futureCardP3;
  }

  let handQuality = 0;
  let positiveMoveCount = 0;
  for (let i = 0; i < handCount; i++) {
    const c = cards[i];
    handQuality += luts.staticCardQuality[c[0]];
    if (c[1] === 1 && c[2] > 0) positiveMoveCount++;
  }
  handQuality /= handCount;

  let cardPost = 0;
  if (handCount === 5 || diceUse + handCount >= 100) cardPost += 36 * W.handPressure;
  if (diceUse >= W.lateThreshold) cardPost += 36 * W.lateBonus;
  if (handCount === 5) {
    cardPost -= 36 * handQuality * W.handQualityRetention;
    cardPost += 36 * luts.nextCardProbability[score] * W.nextCardPressure;
  }
  const terminalT = Math.max(0, Math.min(1, diceUse / 100));
  cardPost += 36 * terminalT * terminalT * terminalT * terminalT * W.terminalContinuous;

  let bestAction = 0;
  let bestValue = rollValue;
  const lateFamily = Math.max(0, (diceUse - W.lateFamilyThreshold) / Math.max(0.001, 100 - W.lateFamilyThreshold));

  const cardOrJumpCardOption = (landing, projected) => (
    stageEventAt(landing - 1) === 2
    || (stageEventAt(landing - 1) === 4 && stageEventAt(projected - 1) === 2)
  );

  for (let action = 1; action <= handCount; action++) {
    const card = cards[action - 1];
    let value = -Infinity;
    const cType = card[1];
    const cVal = card[2];

    if (cType === 1) {
      const mIdx = cVal + MOVE_OFFSET;
      const landing = moveLandingLut[mIdx][score];
      const projected = moveProjectedLut[mIdx][score];
      value = cardPost - 36 * W.moveCost;
      value += 36 * lateFamily * W.lateMove;
      value += moveBaseValueLut[mIdx][score];

      const firstIsJump = stageEventAt(landing - 1) === 4;
      if (firstIsJump && cardOrJumpCardOption(landing, projected)) {
        value += 36 * W.chain;
        value -= 36 * Math.max(0, (diceUse - 70) / 30) * W.chainLatePenalty;
      } else {
        let chain = false;
        for (let i = 0; i < handCount; i++) {
          if (i === action - 1 || cards[i][1] !== 1) continue;
          const secondMove = cards[i][2];
          const secondIdx = secondMove + MOVE_OFFSET;
          const secondLanding = moveLandingLut[secondIdx][projected];
          const secondProjected = moveProjectedLut[secondIdx][projected];
          if (cardOrJumpCardOption(secondLanding, secondProjected)) { chain = true; break; }
        }
        if (chain) {
          value += 36 * W.chain;
          value -= 36 * Math.max(0, (diceUse - 70) / 30) * W.chainLatePenalty;
        }
      }

      const fIndex = (currentRemaining * 2 + isDouble) * stride + projected;
      value += 36 * Number(luts.futureCardP3[fIndex] || 0) * W.futureCardP3;
    } else if (cType === 2) {
      const fIdx = MULT_MAP[cVal];
      value = cardPost - 36 * W.multCost;
      value += 36 * lateFamily * W.lateMult;
      value += multBaseValue[fIdx][score];
      const multFutureVal = expectedFutureP3Lut[expectedFutureLutIndex(fIdx, isDouble, effRemaining, score)];
      value += multFutureVal * W.futureCardP3;
    } else if (cType === 3) {
      const targetStage = stageIdAt(score - 1) + cVal;
      let rawValue = targetStage;
      for (let i = score; i < 2897; i++) {
        if (stageIdAt(i) === targetStage) {
          rawValue = i - score + 1;
          break;
        }
      }
      const landing = rawLandingAfterMove(score, rawValue, false);
      const projected = projectedScoreAfterMove(score, rawValue, false);
      value = cardPost - 36 * W.stageCost;
      value += 36 * lateFamily * W.lateStage;
      value += 36 * luts.sameStage50[score] * W.stageSame50;
      value -= 36 * positiveMoveCount * W.stageAltMovePenalty;
      value += 36 * Math.max(0, projected - score) * W.stageActualMove;
      value += 36 * luts.localQuality[projected] * W.stageDestination;
      const fIndex = (currentRemaining * 2 + isDouble) * stride + projected;
      value += 36 * Number(luts.futureCardP3[fIndex] || 0) * W.futureCardP3;
    }

    if (value > bestValue) {
      bestValue = value;
      bestAction = action;
    }
  }
  return bestAction;
}