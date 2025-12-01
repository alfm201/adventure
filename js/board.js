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

  updateScore(value, stop = false) {
    if (stop) {
      value = this.checkStop(value);
    }
    this.score = Math.min(2898, this.score + value);
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
    this.score = state[2];
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
    let len = this.cards.length;
    if (len === 0) {
      return 0;
    }

    for (let i = 0; i < len; i++) {
      // 칸수 행운카드 사용시 1칸 이상 점프하여 행운카드 획득
      if (this.cards[i][1] === 1 && this.score + this.cards[i][2] - 1 < 2898 && stage[this.score + this.cards[i][2] - 1][4] > 0 && stage[this.score + this.cards[i][2] + stage[this.score + this.cards[i][2] - 1][4] - 1][5] === 2) {
        return i + 1;
      }
    }

    for (let i = 0; i < len; i++) {
      // 칸수 행운카드 사용시 행운카드 획득
      if (this.cards[i][1] === 1 && this.score + this.cards[i][2] - 1 < 2898 && stage[this.score + this.cards[i][2] - 1][5] === 2) {
        return i + 1;
      }
    }

    for (let i = 0; i < len; i++) {
      // 칸수 행운카드 사용시 29칸 이상 점프
      if (this.cards[i][1] === 1 && this.score + this.cards[i][2] - 1 < 2898 && stage[this.score + this.cards[i][2] - 1][4] >= 29) {
        return i + 1;
      }
    }

    for (let i = this.score, end = Math.min(2897, this.score + 8); i < end; i++) {
      // +8칸 내에 stop 이벤트 존재하면
      if (stage[i][5] === 6 || stage[i][5] === 9) {
        // 배수 행운카드 사용
        for (let j = 0; j < len; j++) {
          if (this.cards[j][1] == 2) {
            return j + 1;
          }
        }
      }
    }

    let cnt = 0;
    for (let i = Math.min(2897, this.score + 1), end = Math.min(2897, this.score + 50); i < end; i++) {
      if (stage[i][1] === stage[this.score - 1][1]) {
        cnt++;
      }
    }

    for (let i = 0; i < len; i++) {
      // 스테이지 행운카드 사용하여 26칸 이상 이동
      if (this.cards[i][1] === 3 && cnt >= 26) {
        return i + 1;
      }
    }

    if (len === 5 || this.diceUse + len >= 100) {
      // 카드 보유수가 5개이거나 주사위 사용횟수 + 카드 보유수가 100 이상일 경우
      for (let i = 0; i < len; i++) {
        // 스테이지 행운카드 사용하여 20칸 이상 이동
        if (this.cards[i][1] === 3 && cnt >= 20) {
          return i + 1;
        }
      }

      for (let i = 0; i < len; i++) {
        // 배수 행운카드 사용
        if (this.cards[i][1] === 2) {
          return i + 1;
        }
      }

      for (let i = 0; i < len; i++) {
        for (let j = 0; j < len; j++) {
          // 칸수 행운카드 2개 사용하여 행운카드 획득
          if (i !== j && this.cards[i][1] === 1 && this.cards[j][1] === 1 && this.score + this.cards[i][2] + this.cards[j][2] - 1 < 2898 && this.score + this.cards[i][2] - 1 < 2898 &&
            (stage[this.score + this.cards[i][2] - 1][4] > 0 && stage[this.score + this.cards[i][2] + this.cards[j][2] - 1][5] === 2)) {
            return i + 1;
          }
        }
      }

      // 없으면 칸수 행운카드 사용
      for (let i = 0; i < len; i++) {
        if (this.cards[i][1] === 1 && this.score + this.cards[i][2] - 1 < 2898 && Math.sign(stage[this.score + this.cards[i][2] - 1][4]) !== -1) {
          return i + 1;
        }
      }

      // 없으면 배수 or 다음 스테이지 행운카드 사용
      for (let i = 0; i < len; i++) {
        if (this.cards[i][1] !== 1) {
          return i + 1;
        }
      }
    }

    // 모두 미해당시 주사위 굴리기
    return 0;
  }

  copy() {
    return JSON.parse(JSON.stringify(this));
  }

  changeMode() {
    this.autoProcess = !this.autoProcess;
    this.rankReg = true;
  }
}
