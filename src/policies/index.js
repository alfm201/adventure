import { policyCards } from "../rules/index.js";
import { chooseG3 } from "./g3/select.js";
export { POLICY_VERSION } from "./versions.js";
// Reused scratch view. Policy state never lives on the environment instance.
export function createPolicy() {
  const view = {
    score: 1,
    diceUse: 0,
    isDouble: false,
    cards: [],
    cardInfo: policyCards.map((c) => [...c]),
  };
  return (board) => {
    if (board.terminal) return null;
    view.score = board.score;
    view.diceUse = board.diceUse;
    view.isDouble = board.isDouble;
    view.cards.length = board.cardCount;
    for (let i = 0; i < board.cardCount; i++)
      view.cards[i] = policyCards[((board.cards >>> (i * 5)) & 31) - 1];
    for (let i = 0; i < 30; i++)
      view.cardInfo[i][3] = board.deckMask & (1 << i) ? 0 : 1;
    return chooseG3(view);
  };
}
