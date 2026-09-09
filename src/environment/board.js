import {
  cardSpec,
  landing,
  nextStage,
  rollTable,
  offset,
  pop,
  select,
} from "./tables.js";
// Evolved from the user's compact kernel. No policy, application mode or UI state.
export class Board {
  constructor(random = Math.random) {
    this.random = random;
    this.resetBoard();
  }
  resetBoard() {
    this.score = 1;
    this.diceUse = 0;
    this.isDouble = false;
    this.cards = 0;
    this.cardCount = 0;
    this.deckMask = 0x3fffffff;
    this.deckCount = 30;
  }
  get terminal() {
    return this.diceUse >= 100 && !this.isDouble;
  }
  getRandom() {
    const a = (this.random() * 6 + 1) | 0,
      b = (this.random() * 6 + 1) | 0;
    if (this.isDouble) this.isDouble = false;
    else {
      this.isDouble = a === b;
      this.diceUse++;
    }
    return a + b;
  }
  getCard() {
    if (this.cardCount >= 5) return;
    let k = (this.random() * this.deckCount) | 0,
      bits = this.deckMask,
      shift = 0;
    let count = pop[bits & 255] + pop[(bits >>> 8) & 255];
    if (k >= count) {
      k -= count;
      bits >>>= 16;
      shift = 16;
    }
    count = pop[bits & 255];
    if (k >= count) {
      k -= count;
      bits >>>= 8;
      shift += 8;
    }
    const index = shift + select[((bits & 255) << 3) + k];
    this.deckMask &= ~(1 << index);
    this.cards |= (index + 1) << (this.cardCount++ * 5);
    if (--this.deckCount === 0) {
      this.deckMask = 0x3fffffff;
      this.deckCount = 30;
    }
  }
  _land(code) {
    this.score = code & 4095;
    if (code & 4096) this.getCard();
  }
  roll() {
    this._land(rollTable[this.score * 11 + this.getRandom() - 2]);
  }
  removeCard(n) {
    const shift = (n - 1) * 5,
      id = (this.cards >>> shift) & 31;
    this.cards =
      (this.cards & ((1 << shift) - 1)) |
      ((this.cards >>> (shift + 5)) << shift);
    this.cardCount--;
    return id;
  }
  useCard(n) {
    if (!Number.isInteger(n) || n < 1 || n > this.cardCount) return;
    const spec = cardSpec[this.removeCard(n)],
      type = spec & 3;
    this._land(
      type === 3
        ? nextStage[this.score]
        : landing[
            this.score +
              (spec >> 2) * (type === 2 ? this.getRandom() : 1) +
              offset
          ],
    );
  }
  step(n) {
    if (this.terminal) return true;
    if (!Number.isInteger(n) || n < 0 || n > this.cardCount)
      throw new RangeError("Invalid action");
    if (n === 0) this.roll();
    else this.useCard(n);
    return this.terminal;
  }
}
