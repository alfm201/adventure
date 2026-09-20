import { Board } from "../environment/board.js";
import { snapshot, restore } from "../environment/state.js";
import {
  tiles,
  cards,
  FULL_DECK,
  BOARD_SIZE,
  STAGE_COUNT,
  stageStarts,
  clampPosition,
} from "../rules/index.js";
import {
  resolveLanding,
  rawDestination,
  nextStageRaw,
  popcount,
} from "../environment/tables.js";
import { cardLabels } from "../content/cards.js";
import { diagnostics } from "../platform/report.js";
export class Session extends EventTarget {
  constructor(random = Math.random) {
    super();
    this.board = new Board(() => {
      const value = random();
      if (this.commandDraws && this.commandDraws.length < 128) this.commandDraws.push(value);
      return value;
    });
    this.mode = "manual";
    this.revision = 0;
    this.highScore = 1;
    this.edited = false;
  }
  get state() {
    return snapshot(this.board);
  }
  get view() {
    return {
      state: this.state,
      mode: this.mode,
      revision: this.revision,
      highScore: this.highScore,
      edited: this.edited,
      terminal: this.board.terminal,
    };
  }
  execute(type, value, source = "pointer") {
    const before = this.view, draws = this.commandDraws = [];
    const command = { type, value: typeof value === "number" ? value :
      type === "card" && value ? { slot: value.slot, sum: value.sum } : undefined, source };
    try {
      const changed = this.applyCommand(type, value, source);
      diagnostics.record("game.command", { command, changed, before, after: this.view, random: draws });
      return changed;
    } catch (error) {
      diagnostics.capture(error, "game.command", { command, before, attempted: this.state, random: draws });
      restore(this.board, before.state); this.mode = before.mode; this.edited = before.edited;
      this.highScore = before.highScore; this.revision = before.revision;
      throw error;
    } finally { this.commandDraws = null; }
  }
  applyCommand(type, value, source) {
    const b = this.board,
      automatic = this.mode === "automatic";
    const integer = (n, min, max) => {
      if (!Number.isInteger(n) || n < min || n > max)
        throw RangeError(`${min}~${max} 사이 정수를 입력하세요.`);
    };
    const land = (position) => {
      b.score = resolveLanding(clampPosition(position));
      if (automatic && tiles[b.score - 1].event === 2) b.getCard();
    };
    const add = (id) => {
      integer(id, 1, 30);
      if (automatic || b.cardCount >= 5) return false;
      b.cards |= id << (b.cardCount++ * 5);
      b.deckMask &= ~(1 << (id - 1));
      if (!b.deckMask) b.deckMask = FULL_DECK;
      b.deckCount = popcount(b.deckMask);
      return true;
    };
    if (type === "reset") {
      b.resetBoard();
      this.edited = false;
    } else if (type === "mode") {
      this.mode = automatic ? "manual" : "automatic";
      this.edited = true;
    } else if (type === "roll") {
      if (automatic) b.step(0);
      else b.isDouble = !b.isDouble;
    } else if (type === "dice") {
      if (automatic || b.terminal) return false;
      integer(value, 2, 12);
      if (b.isDouble) b.isDouble = false;
      else b.diceUse++;
      b.score = resolveLanding(rawDestination(b.score, value, true));
    } else if (type === "card") {
      const slot = typeof value === "number" ? value : value?.slot;
      integer(slot, 1, b.cardCount);
      if (b.terminal) return false;
      if (automatic) b.step(slot);
      else {
        const card = cards[(b.cards >>> ((slot - 1) * 5)) & 31],
          start = b.score;
        if (card.type === 2) integer(value?.sum, 2, 12);
        b.removeCard(slot);
        if (card.type === 2) {
          b.score = resolveLanding(start + value.sum * card.value);
          if (b.isDouble) b.isDouble = false;
          else b.diceUse++;
        } else
          b.score = resolveLanding(
            card.type === 3 ? nextStageRaw[start] : start + card.value,
          );
      }
    } else if (type === "discard") {
      integer(value, 1, b.cardCount);
      b.removeCard(value);
      this.edited = true;
    } else if (type === "position") {
      if (source === "keyboard" && automatic) return false;
      integer(value, 1, BOARD_SIZE);
      land(value);
      this.edited = true;
    } else if (type === "drag") {
      if (automatic) return false;
      integer(value, 1, BOARD_SIZE);
      if (tiles[value - 1].stage !== tiles[b.score - 1].stage) return false;
      land(value);
      this.edited = true;
    } else if (type === "diceUsed") {
      if (source === "keyboard" && automatic) return false;
      integer(value, 0, 100);
      b.diceUse = value;
      this.edited = true;
    } else if (type === "stage") {
      integer(value, -1, 1);
      const stage = Math.max(
        1,
        Math.min(STAGE_COUNT, tiles[b.score - 1].stage + value),
      );
      land(stageStarts[stage]);
      this.edited = true;
    } else if (type === "acquire") {
      if (!add(value)) return false;
      this.edited = true;
    } else if (type === "search") {
      if (
        automatic ||
        b.cardCount >= 5 ||
        typeof value !== "string" ||
        !value.trim()
      )
        return false;
      let query = value
        .trim()
        .replace("+", "앞으로 ")
        .replace("-", "뒤로 ")
        .replace("*", "주사위 ")
        .replace(/^>.*/, "다음 스테이지");
      const index = cardLabels.findIndex(
        (name, i) => name.includes(query) && b.deckMask & (1 << i),
      );
      if (index < 0) throw Error("획득 가능한 일치 카드가 없습니다.");
      add(index + 1);
      this.edited = true;
    } else if (type === "obtained") {
      integer(value, 1, 30);
      const bit = 1 << (value - 1);
      // Preserve the legacy asymmetry: automatic may unmark, but cannot mark.
      if (automatic && b.deckMask & bit) return false;
      b.deckMask ^= bit;
      if (!b.deckMask) b.deckMask = FULL_DECK;
      b.deckCount = popcount(b.deckMask);
      this.edited = true;
    } else throw Error("Unknown command");
    restore(b, snapshot(b));
    this.highScore = Math.max(this.highScore, b.score);
    this.revision++;
    this.dispatchEvent(new CustomEvent("change", { detail: { type } }));
    return true;
  }
}
