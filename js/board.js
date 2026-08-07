const X36_WEIGHTS = Object.freeze({
  rollCard: 234.154,
  rollJump: 2.474,
  rollJumpCard: 187.074,
  handPressure: 96.072,
  lateBonus: 4.423,
  lateThreshold: 70,
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
  stageJump: 2,
  handQualityRetention: 102.989,
  nextCardPressure: -30,
  terminalContinuous: -0.176,
  chainLatePenalty: 17.906,
  stageAltMovePenalty: 2.372,
  stageActualMove: 0.485,
  stageDestination: -43.919,
  poolQualityCard: 0.325,
});

const X36_DICE_SUM_WEIGHT = Object.freeze({
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
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
  const nextCardProbability = new Float64Array(size + 1);
  const localQuality = new Float64Array(size + 1);
  const sameStage50 = new Uint8Array(size + 1);
  const staticCardQuality = new Float64Array(31);
  let totalCardQuality = 0;

  const stageIdAt = index => index < 0 || index >= size ? 0 : Number(stage[index][1] || 0);
  const stageMoveAt = index => index < 0 || index >= size ? 0 : Number(stage[index][4] || 0);
  const stageEventAt = index => index < 0 || index >= size ? 0 : Number(stage[index][5] || 0);

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
      if (eventType === 2 || (eventType === 4 && stageEventAt(projected - 1) === 2)) {
        nextCard += weight;
      }
      if (eventType === 2) {
        local += weight;
      } else if (eventType === 4) {
        local += weight * (
          Math.max(0, stageMoveAt(landing - 1)) / 12
          + (stageEventAt(projected - 1) === 2 ? 1 : 0)
        );
      }
    }
    nextCardProbability[score] = nextCard / 36;
    localQuality[score] = local / 36;

    let count = 0;
    for (let pos = Math.min(2897, score + 1); pos < Math.min(2897, score + 50); pos++) {
      if (stageIdAt(pos) === stageIdAt(score - 1)) count++;
    }
    sameStage50[score] = count;
  }

  return {
    nextCardProbability,
    localQuality,
    sameStage50,
    staticCardQuality,
    totalCardQuality,
  };
}

function getX36CpuLuts() {
  if (!x36CpuLutCache) x36CpuLutCache = buildX36CpuLuts();
  return x36CpuLutCache;
}

class Board {
  constructor() {
    this.score = 1;
    this.reward = 0;
    this.diceUse = 0;
    this.isDouble = false;
    this.cards = [];
    this.exScores = new Array(6).fill(0);
    this.exValues = { min: new Array(6).fill(0), max: new Array(6).fill(0), std: new Array(6).fill(0), mid: new Array(6).fill(0) };
    this.exScore = Infinity;
    this.exAction = undefined;
    this.autoProcess = false;
    this.rankReg = false;
    this.cardIndex = new Array(30);
    for (let i = 0, len = cardInfo.length; i < len; i++) {
      this.cardIndex[i] = i;
    }
    this.cardInfo = JSON.parse(JSON.stringify(cardInfo));
    this.cardInfoScrollOffset = 0;
  }

  resetCardInfo() {
    this.cardIndex = new Array(30);
    for (let i = 0, len = cardInfo.length; i < len; i++) {
      this.cardIndex[i] = i;
    }
    this.cardInfo = JSON.parse(JSON.stringify(cardInfo));
  }

  getRandom() {
    let val1 = Math.floor(Math.random() * 6 + 1);
    let val2 = Math.floor(Math.random() * 6 + 1);
    if (this.isDouble || !this.autoProcess) {
      this.isDouble = false;
    } else {
      this.isDouble = val1 === val2;
      this.diceUse++;
    }
    return val1 + val2;
  }

  getCard(index, pushYN = true) {
    if (pushYN && this.cards.length >= 5) return;
    if (index === undefined) {
      if (!this.autoProcess) return;
      var rnd = Math.floor(Math.random() * this.cardIndex.length);
      var index = this.cardIndex[rnd];
    } else {
      if (this.autoProcess) return;
      this.rankReg = true;
      var rnd = this.cardIndex.indexOf(index);
    }
    if (this.cardInfo[index][3] === 0) {
      this.cardIndex.splice(rnd, 1);
    }
    let row = this.cardInfo[index];
    row[3] = 1;
    if (this.cards.length < 5 && pushYN) {
      this.cards.push(row);
    }
    if (this.cardIndex.length === 0) {
      this.resetCardInfo();
    }
  }

  clampScore(score) {
    return Math.max(1, Math.min(2898, Number(score) || 1));
  }

  getMoveCardTargetIndex(card, extraMove = 0) {
    const targetIndex = this.score + card[2] + extraMove - 1;
    return targetIndex >= 0 && targetIndex < 2898 ? targetIndex : null;
  }

  updateScore(value, stop = false) {
    if (stop) {
      value = this.checkStop(value);
    }
    this.score = this.clampScore(this.score + value);
    this.checkEvent();
  }

  checkStop(value) {
    let startIndex = this.score;
    let endIndex = Math.min(2897, this.score + value - 1);
    for (let i = startIndex; i < endIndex; i++) {
      if (stage[i][5] === 6 || stage[i][5] === 9) {
        value = i - this.score + 1;
        break;
      }
    }
    return value;
  }

  checkEvent() {
    this.score = this.clampScore(this.score);
    let eventType = stage[this.score - 1][5];
    switch (eventType) {
      case 2:
        this.getCard();
        break;
      case 4:
        this.updateScore(stage[this.score - 1][4], false);
        break;
      default:
        break;
    }
  }

  step(n) {
    if (this.diceUse >= 100 && !this.isDouble) {
      return true;
    }

    if (n === 0) {
      this.updateScore(this.getRandom(), true);
    } else {
      this.useCard(n);
    }

    return this.diceUse >= 100 && !this.isDouble;
  }

  useCard(n) {
    if (n > this.cards.length) return
    n--;
    let cardType = this.cards[n][1];
    let cardValue = this.cards[n][2];
    this.cards.splice(n, 1);
    switch (cardType) {
      case 1:
        this.updateScore(cardValue, false);
        break;
      case 2:
        this.updateScore(this.getRandom() * cardValue, false);
        break;
      case 3:
        let value = stage[this.score - 1][1] + cardValue;
        for (let i = this.score, len = stage.length - 1; i < len; i++) {
          if (stage[i][1] === value) {
            value = i - this.score + 1;
            break;
          }
        }
        this.updateScore(value, false);
        break;
      default:
        break;
    }
  }
  
  moveStage(v) {
    let value = Math.max(1, Math.min(75, stage[this.score - 1][1] + v));
    let score = this.score;
    for (let i = 0, len = stage.length - 1; i < len; i++) {
      if (stage[i][1] === value && stage[i][2] === 1) {
        score = i - this.score + 1;
        break;
      }
    }
    this.updateScore(score, false);
  }

  resetBoard() {
    this.score = 1;
    this.reward = 0;
    this.diceUse = 0;
    this.isDouble = false;
    this.cards = [];
    this.exScores = new Array(6).fill(0);
    this.exScore = Infinity;
    this.exAction = undefined;
    this.rankReg = false;
    this.resetCardInfo();
  }

  getState() {
    return [
      this.rankReg,
      this.autoProcess,
      this.score,
      stage[this.score - 1][1],
      stage[this.score - 1][2],
      this.diceUse,
      this.isDouble ? 1 : 0,
      ...Array(5).fill(0).map((_, i) => this.cards[i] ? this.cards[i][0] : 0),
      ...this.cardInfo.map(card => card[3])
    ];
  }

  setState(state) {
    this.autoProcess = false;
    this.score = this.clampScore(state[2]);
    this.diceUse = state[5];
    this.isDouble = state[6] === 1;

    this.cards = [];
    for (let i = 7; i < 12; i++) {
      if (state[i] !== 0) {
        this.cards.push(this.cardInfo[state[i] - 1]);
      }
    }

    this.resetCardInfo();
    for (let i = 12; i < 42; i++) {
      if (state[i] === 1) {
        this.getCard(i - 12, false);
      }
    }

    this.rankReg = state[0];
    this.autoProcess = state[1];
  }

  chooseAction() {
    return Board.rolloutPolicy === 'quality' ? this.chooseActionQuality() : this.chooseActionFast();
  }

  chooseActionFast() {
    let len = this.cards.length;
    if (len === 0) return 0;

    for (let i = 0; i < len; i++) {
      const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
      const jump = targetIndex === null ? 0 : stage[targetIndex][4];
      const jumpTargetIndex = targetIndex === null ? null : targetIndex + jump;
      if (targetIndex !== null && jump > 0 && jumpTargetIndex >= 0 && jumpTargetIndex < 2898 && stage[jumpTargetIndex][5] === 2) return i + 1;
    }

    for (let i = 0; i < len; i++) {
      const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
      if (targetIndex !== null && stage[targetIndex][5] === 2) return i + 1;
    }

    for (let i = 0; i < len; i++) {
      const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
      if (targetIndex !== null && stage[targetIndex][4] >= 29) return i + 1;
    }

    for (let i = this.score, end = Math.min(2897, this.score + 8); i < end; i++) {
      if (stage[i][5] === 6 || stage[i][5] === 9) {
        for (let j = 0; j < len; j++) {
          if (this.cards[j][1] === 2) return j + 1;
        }
      }
    }

    let cnt = 0;
    for (let i = Math.min(2897, this.score + 1), end = Math.min(2897, this.score + 50); i < end; i++) {
      if (stage[i][1] === stage[this.score - 1][1]) cnt++;
    }

    for (let i = 0; i < len; i++) {
      if (this.cards[i][1] === 3 && cnt >= 31) return i + 1;
    }

    if (len === 5 || this.diceUse + len >= 100) {
      for (let i = 0; i < len; i++) {
        if (this.cards[i][1] === 3 && cnt >= 16) return i + 1;
      }

      for (let i = 0; i < len; i++) {
        if (this.cards[i][1] === 2) return i + 1;
      }

      for (let i = 0; i < len; i++) {
        for (let j = 0; j < len; j++) {
          const firstTargetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
          const combinedTargetIndex = (this.cards[i][1] === 1 && this.cards[j][1] === 1) ? this.getMoveCardTargetIndex(this.cards[i], this.cards[j][2]) : null;
          if (i !== j && firstTargetIndex !== null && combinedTargetIndex !== null &&
            stage[firstTargetIndex][4] > 0 && stage[combinedTargetIndex][5] === 2) {
            return i + 1;
          }
        }
      }

      for (let i = 0; i < len; i++) {
        const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
        if (targetIndex !== null && Math.sign(stage[targetIndex][4]) !== -1) return i + 1;
      }

      for (let i = 0; i < len; i++) {
        if (this.cards[i][1] !== 1) return i + 1;
      }
    }

    return 0;
  }

  chooseActionQuality() {
    const W = X36_WEIGHTS;
    const luts = getX36CpuLuts();
    const cards = this.cards;
    const handCount = cards.length;
    const score = this.score;
    const diceUse = this.diceUse;

    const stageIdAt = index => index < 0 || index >= 2898 ? 0 : Number(stage[index][1] || 0);
    const stageMoveAt = index => index < 0 || index >= 2898 ? 0 : Number(stage[index][4] || 0);
    const stageEventAt = index => index < 0 || index >= 2898 ? 0 : Number(stage[index][5] || 0);

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

    const cardOrJumpCardOption = (landing, projected) => (
      stageEventAt(landing - 1) === 2
      || (stageEventAt(landing - 1) === 4 && stageEventAt(projected - 1) === 2)
    );

    const moveChainCardOption = action => {
      if (action === 0 || action > handCount) return false;
      const card = cards[action - 1];
      if (!card || card[1] !== 1) return false;
      const firstLanding = rawLandingAfterMove(score, card[2], false);
      const firstProjected = projectedScoreAfterMove(score, card[2], false);
      if (stageEventAt(firstLanding - 1) === 4 && cardOrJumpCardOption(firstLanding, firstProjected)) {
        return true;
      }
      for (let i = 0; i < handCount; i++) {
        if (i === action - 1 || cards[i][1] !== 1) continue;
        const secondLanding = rawLandingAfterMove(firstProjected, cards[i][2], false);
        const secondProjected = projectedScoreAfterMove(firstProjected, cards[i][2], false);
        if (cardOrJumpCardOption(secondLanding, secondProjected)) return true;
      }
      return false;
    };

    let remainingQuality = luts.totalCardQuality;
    let remainingCount = 30;
    for (let i = 0; i < 30; i++) {
      if (this.cardInfo[i][3]) {
        remainingQuality -= luts.staticCardQuality[i + 1];
        remainingCount--;
      }
    }
    const poolQuality = remainingCount > 0 ? remainingQuality / remainingCount : 0;

    let handQuality = 0;
    if (handCount > 0) {
      for (let i = 0; i < handCount; i++) handQuality += luts.staticCardQuality[cards[i][0]];
      handQuality /= handCount;
    }

    const canGainCard = handCount < 5;
    let rollValue = 0;
    for (let diceSum = 2; diceSum <= 12; diceSum++) {
      const weight = X36_DICE_SUM_WEIGHT[diceSum];
      const landing = rawLandingAfterMove(score, diceSum, true);
      const projected = projectedScoreAfterMove(score, diceSum, true);
      const eventType = stageEventAt(landing - 1);
      if (eventType === 2 && canGainCard) {
        rollValue += weight * (W.rollCard + (poolQuality - 0.75) * W.poolQualityCard);
      } else if (eventType === 4) {
        rollValue += weight * Math.max(0, stageMoveAt(landing - 1)) * W.rollJump;
        if (canGainCard && stageEventAt(projected - 1) === 2) {
          rollValue += weight * (W.rollJumpCard + (poolQuality - 0.75) * W.poolQualityCard);
        }
      }
    }

    if (handCount === 0) return 0;

    let cardPost = 0;
    if (handCount === 5 || diceUse + handCount >= 100) cardPost += 36 * W.handPressure;
    if (diceUse >= W.lateThreshold) cardPost += 36 * W.lateBonus;
    if (handCount === 5) {
      cardPost -= 36 * handQuality * W.handQualityRetention;
      cardPost += 36 * luts.nextCardProbability[score] * W.nextCardPressure;
    }
    const terminalT = Math.max(0, Math.min(1, diceUse / 100));
    cardPost += 36 * terminalT * terminalT * terminalT * terminalT * W.terminalContinuous;

    let positiveMoveCount = 0;
    for (let i = 0; i < handCount; i++) {
      if (cards[i][1] === 1 && cards[i][2] > 0) positiveMoveCount++;
    }

    let bestAction = 0;
    let bestValue = rollValue;

    for (let action = 1; action <= handCount; action++) {
      const card = cards[action - 1];
      let value = -Infinity;

      if (card[1] === 1) {
        const landing = rawLandingAfterMove(score, card[2], false);
        const eventType = stageEventAt(landing - 1);
        value = cardPost - 36 * W.moveCost;
        if (eventType === 2) {
          value += 36 * W.moveCard;
        } else if (eventType === 4) {
          value += 36 * Math.max(0, stageMoveAt(landing - 1)) * W.moveJump;
          const projected = projectedScoreAfterMove(score, card[2], false);
          if (stageEventAt(projected - 1) === 2) value += 36 * W.moveJumpCard;
        }
        if (moveChainCardOption(action)) {
          value += 36 * W.chain;
          value -= 36 * Math.max(0, (diceUse - 70) / 30) * W.chainLatePenalty;
        }
      } else if (card[1] === 2) {
        value = cardPost - 36 * W.multCost;
        for (let diceSum = 2; diceSum <= 12; diceSum++) {
          const weight = X36_DICE_SUM_WEIGHT[diceSum];
          const rawValue = diceSum * card[2];
          const landing = rawLandingAfterMove(score, rawValue, false);
          const projected = projectedScoreAfterMove(score, rawValue, false);
          const eventType = stageEventAt(landing - 1);
          if (eventType === 2) {
            value += weight * W.multCard;
          } else if (eventType === 4) {
            value += weight * Math.max(0, stageMoveAt(landing - 1)) * W.multJump;
            if (stageEventAt(projected - 1) === 2) value += weight * W.multJumpCard;
          }
        }
      } else if (card[1] === 3) {
        const targetStage = stageIdAt(score - 1) + card[2];
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
        value += 36 * luts.sameStage50[score] * W.stageSame50;
        if (stageEventAt(landing - 1) === 4) {
          value += 36 * Math.max(0, stageMoveAt(landing - 1)) * W.stageJump;
        }
        value -= 36 * positiveMoveCount * W.stageAltMovePenalty;
        value += 36 * Math.max(0, projected - score) * W.stageActualMove;
        value += 36 * luts.localQuality[projected] * W.stageDestination;
      }

      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    return bestAction;
  }

  copy() {
    return JSON.parse(JSON.stringify(this));
  }

  changeMode() {
    this.autoProcess = !this.autoProcess;
    this.rankReg = true;
  }
}
