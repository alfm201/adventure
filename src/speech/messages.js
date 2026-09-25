import { cards } from "../rules/index.js";

const numbers = {
  ko: ["영", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
  ja: ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"],
  zh: ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"],
};
const slots = { ko: ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째"], en: ["first", "second", "third", "fourth", "fifth"], ja: ["一番目", "二番目", "三番目", "四番目", "五番目"], zh: ["第一", "第二", "第三", "第四", "第五"] };
const phrases = {
  calculating: ["추천 행동을 계산하고 있습니다.", "Calculating the recommended action.", "おすすめの行動を計算しています。"],
  roll: ["주사위를 굴려주세요.", "Please roll the dice.", "サイコロを振ってください。"],
  preview: ["음성 안내를 시작합니다. 첫 번째 카드 슬롯, 앞으로 여덟 칸 이동 카드를 사용하세요.", "Voice guidance is ready. Use the first card slot, the move forward eight spaces card.", "音声ガイドを開始します。一番目のカード、八マス進むカードを使ってください。"],
  disconnected: ["화면 공유가 끝났습니다. 게임 화면을 다시 연결해 주세요.", "Screen sharing has ended. Please reconnect the game screen.", "画面共有が終了しました。ゲーム画面を接続し直してください。"],
  window: ["게임 창 전체가 보이도록 해주세요.", "Please show the entire game window.", "ゲーム画面全体が見えるようにしてください。"],
  small: ["게임 창을 조금 더 크게 보여주세요.", "Please make the game window larger.", "ゲーム画面を少し大きくしてください。"],
  stale: ["게임 화면이 멈춰 있습니다. 공유 중인 창을 다시 표시해 주세요.", "The game screen is paused. Please bring the shared window back into view.", "ゲーム画面が止まっています。共有しているウィンドウを表示してください。"],
  covered: ["게임 화면을 가리는 팝업을 닫아주세요.", "Please close the popup covering the game.", "ゲーム画面を隠しているポップアップを閉じてください。"],
  reader: ["화면 인식을 시작하지 못했습니다. 게임 화면을 다시 연결해 주세요.", "Screen recognition could not start. Please reconnect the game screen.", "画面認識を開始できませんでした。ゲーム画面を接続し直してください。"],
  "deck-open": ["물음표 버튼을 눌러 카드 이력 창을 열어주세요.", "Click the question mark button to open card history.", "はてなボタンを押してカード履歴を開いてください。"],
  "deck-up": ["위로 스크롤해 주세요.", "Please scroll up.", "上にスクロールしてください。"],
  "deck-down": ["아래로 스크롤해 주세요.", "Please scroll down.", "下にスクロールしてください。"],
  "deck-scan": ["천천히 스크롤해 주세요.", "Please scroll slowly.", "ゆっくりスクロールしてください。"],
  "deck-adjust": ["조금만 스크롤해 주세요.", "Please scroll slightly.", "少しだけスクロールしてください。"],
  "deck-hold": ["잠시 스크롤을 멈춰주세요.", "Please pause scrolling.", "スクロールを止めてください。"],
  "deck-ready": ["확인이 완료되었습니다.", "Verification complete.", "確認が完了しました。"],
  "deck-ingame": ["웹 화면이 아닌 실제 게임 화면의 물음표 버튼을 눌러주세요.", "Please click the question mark button in the actual game window.", "ブラウザではなくゲーム画面内の？ボタンを押してください。"],
  score: ["현재 점수가 가려져 있습니다.", "Current score is covered.", "現在のスコアが隠れています。"],
  dice: ["주사위 횟수가 가려져 있습니다.", "Dice count is covered.", "サイコロの使用回数が隠れています。"],
  hand: ["보유 카드가 가려져 있습니다.", "Your cards are covered.", "手持ちのカードが隠れています。"],
  bonus: ["주사위 버튼이 가려져 있습니다.", "Dice button is covered.", "サイコロボタンが隠れています。"],
};
const chinese = {
  calculating: "正在计算推荐操作，请稍等。", roll: "请掷骰子。", preview: "语音指引已开启。请使用第一个卡槽中，前进八格的卡牌。",
  disconnected: "屏幕共享已结束，请重新连接游戏画面。", window: "请完整显示游戏窗口。", small: "请把游戏窗口放大一些。",
  stale: "游戏画面已暂停，请重新显示正在共享的窗口。", covered: "请关闭遮挡画面的弹窗。", reader: "无法开始识别画面，请重新连接游戏画面。",
  "deck-open": "请点击问号按钮打开卡牌记录。", "deck-up": "请向上滚动。",
  "deck-down": "请向下滚动。", "deck-scan": "请缓慢滚动。",
  "deck-adjust": "请稍微滚动一下。", "deck-hold": "请暂停滚动。", "deck-ready": "确认已完成。", "deck-ingame": "请点击实际游戏画面内的问号按钮。",
  score: "当前分数被遮挡，请移开窗口。", dice: "骰子次数被遮挡，请移开窗口。",
  hand: "手中卡牌被遮挡，请移开窗口。", bonus: "骰子按钮被遮挡，请移开窗口。",
};
export function phrase(key, language = "ko") { return language === "zh" ? chinese[key] || "" : phrases[key]?.[{ ko: 0, en: 1, ja: 2 }[language] ?? 0] || ""; }

export function recommendationId(action, hand) {
  if (action === 0) return "roll";
  const card = cards[hand[action - 1]];
  return card && action >= 1 && action <= 5 ? `card-${action}-${card.type}-${card.value}` : null;
}

export const ROLL_VARIATIONS = ["roll", "roll-1", "roll-2", "roll-3", "roll-4"];

export function phraseCatalog(language) {
  const entries = Object.fromEntries(Object.keys(phrases).map(key => [key, phrase(key, language)]));
  for (let i = 1; i < ROLL_VARIATIONS.length; i++) entries[ROLL_VARIATIONS[i]] = phrase("roll", language);
  for (const card of cards.slice(1)) for (let slot = 1; slot <= 5; slot++) {
    const hand = Array(5).fill(card.id);
    entries[recommendationId(slot, hand)] = recommendation(slot, hand, language);
  }
  return entries;
}

export function recommendation(action, hand, language = "ko") {
  if (action === 0) return phrase("roll", language);
  const card = cards[hand[action - 1]], slot = slots[language]?.[action - 1];
  if (!card || !slot) return "";
  const value = numbers[language][Math.abs(card.value)];
  if (language === "ko") {
    const name = card.type === 3 ? "다음 스테이지로 이동" : card.type === 2 ? `주사위 ${value} 배` : `${card.value > 0 ? "앞으로" : "뒤로"} ${value} 칸 이동`;
    return `${slot} 카드 슬롯, ${name} 카드를 사용하세요.`;
  }
  if (language === "ja") {
    const name = card.type === 3 ? "次のステージに進む" : card.type === 2 ? `サイコロ${value}倍の` : `${value}マス${card.value > 0 ? "進む" : "戻る"}`;
    return `${slot}のカード、${name}カードを使ってください。`;
  }
  if (language === "zh") {
    const name = card.type === 3 ? "前往下一关" : card.type === 2 ? `骰子点数乘以${value}` : `${card.value > 0 ? "前进" : "后退"}${value}格`;
    return `请使用第${["一", "二", "三", "四", "五"][action - 1]}个卡槽中，${name}的卡牌。`;
  }
  const name = card.type === 3 ? "advance to the next stage" : card.type === 2 ? `${value}-times dice` : `move ${card.value > 0 ? "forward" : "back"} ${value} ${Math.abs(card.value) === 1 ? "space" : "spaces"}`;
  return `Use the ${slot} card slot, the ${name} card.`;
}

export function recommendationParts(action, hand, language = "ko") {
  const full = recommendation(action, hand, language);
  const boundary = language === "en" ? ", " : language === "ja" ? "、" : language === "zh" ? "，" : ", ";
  const at = full.indexOf(boundary);
  if (at < 0) throw Error("Invalid recommendation");
  return [full.slice(0, at + boundary.length), full.slice(at + boundary.length)];
}

export function requestCue(assist) {
  if (!assist.stream) return { key: "disconnected", delay: 1200 };
  const issue = assist.status === "paused" ? "stale" : assist.reading.issue;
  if (assist.reading.ready && assist.status !== "paused" || !issue || ["waiting", "settling"].includes(issue)) return null;
  const key = issue === "deck-reopen" ? "deck-open" : issue;
  if (!phrases[key]) return null;
  const delay = key === "covered" ? 6000 : key === "deck-hold" ? 1800 : ["score", "dice", "hand", "bonus"].includes(key) ? 3000 : 900;
  return { key, delay };
}
