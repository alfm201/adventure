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
      this.score,                     // 현재 점수
      stage[this.score - 1][1],       // 현재 스테이지 ID
      stage[this.score - 1][2],       // 현재 스페이스 ID
      this.diceUse,                   // 주사위 사용 횟수
      this.isDouble ? 1 : 0,          // 더블 상태
      // this.cards.length,              // 보유한 카드 수
      ...Array(5).fill(0).map((_, i) => this.cards[i] ? this.cards[i][0] : 0), // cardIds 패딩 (최대 5개)
      ...this.cardInfo.map(card => card[3]) // 모든 카드의 cardGetYN 상태 (고정 길이 30)
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
    const handCount = this.cards.length;
    const score = this.score;
    const diceUse = this.diceUse;

    const stageIdAt = index => index < 0 || index >= 2898 ? 0 : Number(stage[index][1] || 0);
    const stageMoveAt = index => index < 0 || index >= 2898 ? 0 : Number(stage[index][4] || 0);
    const stageEventAt = index => index < 0 || index >= 2898 ? 0 : Number(stage[index][5] || 0);

    const diceSumWeight = sum => {
      if (sum === 2 || sum === 12) return 1;
      if (sum === 3 || sum === 11) return 2;
      if (sum === 4 || sum === 10) return 3;
      if (sum === 5 || sum === 9) return 4;
      if (sum === 6 || sum === 8) return 5;
      if (sum === 7) return 6;
      return 0;
    };

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
        const eventType = stageEventAt(projected - 1);
        if (eventType === 4) {
          projected = Math.min(2898, projected + stageMoveAt(projected - 1));
          continue;
        }
        break;
      }
      return projected;
    };

    const stageCardMove = cValue => {
      const targetStage = stageIdAt(score - 1) + cValue;
      let value = targetStage;
      for (let i = score; i < 2897; i++) {
        if (stageIdAt(i) === targetStage) {
          value = i - score + 1;
          break;
        }
      }
      return value;
    };

    const sameStageCount50 = () => {
      let count = 0;
      for (let pos = Math.min(2897, score + 1); pos < Math.min(2897, score + 50); pos++) {
        if (stageIdAt(pos) === stageIdAt(score - 1)) count++;
      }
      return count;
    };

    const cardOrJumpCardOption = (landing, projected) => {
      const eventType = stageEventAt(landing - 1);
      if (eventType === 2) return true;
      return eventType === 4 && projected >= 1 && projected <= 2898 && stageEventAt(projected - 1) === 2;
    };

    const moveChainCardOption = action => {
      if (action === 0 || action > handCount) return false;
      const card = this.cards[action - 1];
      if (!card || card[1] !== 1) return false;
      const firstValue = card[2];
      const firstLanding = rawLandingAfterMove(score, firstValue, false);
      const firstProjected = projectedScoreAfterMove(score, firstValue, false);
      if (stageEventAt(firstLanding - 1) === 4 && cardOrJumpCardOption(firstLanding, firstProjected)) return true;
      for (let i = 0; i < handCount; i++) {
        if (i === action - 1) continue;
        const nextCard = this.cards[i];
        if (nextCard && nextCard[1] === 1) {
          const secondLanding = rawLandingAfterMove(firstProjected, nextCard[2], false);
          const secondProjected = projectedScoreAfterMove(firstProjected, nextCard[2], false);
          if (cardOrJumpCardOption(secondLanding, secondProjected)) return true;
        }
      }
      return false;
    };

    const rollValueX36 = () => {
      const canGainCard = handCount < 5;
      let total = 0;
      for (let diceSum = 2; diceSum <= 12; diceSum++) {
        const landing = rawLandingAfterMove(score, diceSum, true);
        const eventType = stageEventAt(landing - 1);
        let value = 0;
        if (eventType === 2 && canGainCard) {
          value += 179;
        } else if (eventType === 4) {
          value += Math.max(0, stageMoveAt(landing - 1)) * 2;
          if (canGainCard) {
            const projected = projectedScoreAfterMove(score, diceSum, true);
            if (projected >= 1 && projected <= 2898 && stageEventAt(projected - 1) === 2) value += 299;
          }
        }
        total += diceSumWeight(diceSum) * value;
      }
      return total;
    };

    const cardPostX36 = () => {
      let value = 0;
      if (handCount === 5 || diceUse + handCount >= 100) value += 98 * 36;
      if (diceUse >= 70) value += 3 * 36;
      return value;
    };

    const moveValueX36 = (action, cValue) => {
      const landing = rawLandingAfterMove(score, cValue, false);
      const eventType = stageEventAt(landing - 1);
      let total = cardPostX36() - 80 * 36;
      if (eventType === 2) {
        total += 139 * 36;
      } else if (eventType === 4) {
        total += Math.max(0, stageMoveAt(landing - 1)) * 2 * 36;
        const projected = projectedScoreAfterMove(score, cValue, false);
        if (projected >= 1 && projected <= 2898 && stageEventAt(projected - 1) === 2) total += 101 * 36;
      }
      if (moveChainCardOption(action)) total += 37 * 36;
      return total;
    };

    const multValueX36 = cValue => {
      let total = cardPostX36() - 20 * 36;
      for (let diceSum = 2; diceSum <= 12; diceSum++) {
        const rawValue = diceSum * cValue;
        const landing = rawLandingAfterMove(score, rawValue, false);
        const eventType = stageEventAt(landing - 1);
        let value = 0;
        if (eventType === 2) {
          value += 142;
        } else if (eventType === 4) {
          value += Math.max(0, stageMoveAt(landing - 1)) * 2;
          const projected = projectedScoreAfterMove(score, rawValue, false);
          if (projected >= 1 && projected <= 2898 && stageEventAt(projected - 1) === 2) value += 141;
        }
        total += diceSumWeight(diceSum) * value;
      }
      return total;
    };

    const stageValueX36 = cValue => {
      const rawValue = stageCardMove(cValue);
      const landing = rawLandingAfterMove(score, rawValue, false);
      let total = cardPostX36() - 2 * 36 + sameStageCount50() * 36;
      if (stageEventAt(landing - 1) === 4) total += Math.max(0, stageMoveAt(landing - 1)) * 2 * 36;
      return total;
    };

    let bestAction = 0;
    let bestValue = rollValueX36();
    for (let action = 1; action <= handCount; action++) {
      const card = this.cards[action - 1];
      if (!card) continue;
      let value = -2147483648;
      if (card[1] === 1) value = moveValueX36(action, card[2]);
      else if (card[1] === 2) value = multValueX36(card[2]);
      else if (card[1] === 3) value = stageValueX36(card[2]);
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
