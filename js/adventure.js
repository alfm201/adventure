const canvas = document.querySelector('#game_screen');
const _canvas = document.querySelector('#temp_canvas');
const ctx = canvas.getContext('2d');
const _ctx = _canvas.getContext('2d');
const DICE_OVERLAY_CONFIG = {
  btnWidth: 46,
  btnHeight: 24,
  gap: 4,
  margin: 8,
}

let backgroundImages = [];
let scores = [];
let maxScore = 0;
let userIndex = 2;
let env;
let done = false;
let showCardInfoYN = false;
let showCardPos = -1;
let keyDownCtrl = false;
let tooltipIndex = -1;
let tooltipInfo = { x: 0, y: 0, w: 0, h: 0, text: '' };
let showDiceOverlay = false;
let diceOverlayHoverIndex = -1;
let regionCurrentCharacter = { x1: 0, y1: 0, x2: 0, y2: 0 };

setup();

function setup() {
  getBoardInfo();
}

function imagesPreload() {
  for (let i = 1; i < 82; i++) {
    const img = new Image();
    img.src = `./img/${i}.png`;
    backgroundImages.push(img);
  }
  backgroundImages[80].onload = () => {
    calcEx();
    eventSetup();
    // updateBoard();
  }
}

function updateBoard() {
  // console.time('Update Board');
  drawMainScreen();
  // console.timeEnd('Update Board');
}

function drawMainScreen() {
  let stageIndex = stage[env.score - 1][1];
  ctx.fillStyle = 'white';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, 1234, 694);
  drawBackground(stageIndex);
  drawEvents(stageIndex);
  drawCounter();
  drawUsers();
  maxScore = env.score > maxScore ? env.score : maxScore;
  drawStatusBar();
  if (showCardInfoYN) drawCardInfo();
  drawExScores();
  if (tooltipIndex >= 0 && tooltipIndex <= 6) {
    drawTooltip(tooltipInfo.x, tooltipInfo.y, tooltipInfo.text);
  }
  drawDiceOverlay();
  showCardPos = -1;
}

function drawExScores() {
  if (env.exScores[0] >= env.exScore) {
    drawText(`주사위: ${formatValue(env.exScores[0])}`, 14, 328, 'red', 14, 'left');
  } else {
    drawText(`주사위: ${formatValue(env.exScores[0])}`, 14, 328, 'black', 14, 'left');
  }
  for (let i = 0; i < 5; i++) {
    if (env.exScores[i + 1] >= env.exScore) {
      drawText(`${i + 1}번카드: ${formatValue(env.exScores[i + 1])}`, 14, 346 + i * 18, 'red', 14, 'left');
    } else {
      drawText(`${i + 1}번카드: ${formatValue(env.exScores[i + 1])}`, 14, 346 + i * 18, 'black', 14, 'left');
    }
  }
}

function drawTooltip(x, y, text, size = 14, lineHeight = 18) {
  let textMetrics = measureMultilineText(ctx, text, lineHeight);
  let width = textMetrics.width;
  let height = textMetrics.height;
  x = x + 4;
  y = y - 4 - height;
  if (x + width > canvas.width) {
    x = x - 8 - width;
  }

  if (y < 0) {
    y = y + 8 + height;
  }
  drawRadiusRect(x, y, width, height, 4, 1, 'rgb(103, 98, 166)');
  drawRadiusRect(x + 2, y + 2, width - 4, height - 4, 4, 1, 'white');
  let lines = text.split('\n');
  lines.forEach((line, index) => {
    drawText(line, x + 8, y + 15 + (index * lineHeight), 'black', size, 'left');
  });
}

function formatValue(value) {
  if (typeof value === 'number') {
    return value.toFixed(3) + '점';
  } else {
    return value;
  }
}

function drawCardPos(moveValue) {
  if (stage[env.score - 1][1] === stage[env.score + moveValue - 1][1]) {
    drawCanvas(79, 2, 923, ((stage[env.score + moveValue - 1][6] - 1) % 10) * 96 + 244, parseInt((stage[env.score + moveValue - 1][6] - 1) / 10) * 96 + 60, 92, 92);
  }
}

function drawBackground(index) {
  _ctx.clearRect(0, 0, 1234, 694);
  _ctx.drawImage(backgroundImages[index - 1], 0, 0);
  ctx.drawImage(_canvas, 0, 0, 1024, 694, 210, 0, 1024, 694);
}

function drawStatusBar() {
  drawRadiusRect(x = 0, y = 0, width = 208, height = 694, radius = 10, opacity = 0.5, color = 'black');
  drawRadiusRect(x = 8, y = 7, width = 193, height = 272, radius = 16, opacity = 1, color = 'white');
  drawRadiusRect(x = 12, y = 11, width = 185, height = 264, radius = 16, opacity = 1, color = 'rgb(30, 58, 84)', 'rgb(119, 90, 186)');
  ctx.drawImage(backgroundImages[76], (userIndex - 1) * 90, 0, 90, 120, 59, 82, 90, 120);
  drawRadiusRect(x = 57, y = 44, width = 95, height = 24, radius = 10, opacity = 0.5, color = 'black');
  let stageNum = stage[env.score - 1][1];
  drawText(`${stageNum}.${stageNames[stageNum - 1]}`, 104, 210, 'white', 12, 'center');
  drawText(env.score, 122, 57, 'white', 12, 'right');
  drawText('칸', 130, 57, 'rgb(255, 240, 140)', 12, 'left');
  drawRadiusRect(x = 70, y = 228, width = 65, height = 19, radius = 8, opacity = 0.1, 'black');
  drawText(stage[env.score - 1][2], 104, 238, 'rgb(255, 240, 140)', 12, 'center');
  drawRadiusRect(x = 9, y = 286, width = 192, height = 145, radius = 4, opacity = 1, color = 'white');
  drawRadiusRect(x = 11, y = 288, width = 188, height = 25, radius = 4, opacity = 1, color = 'rgb(159, 252, 243)');
  drawRadiusRect(x = 12, y = 289, width = 186, height = 11, radius = 2, opacity = 0.4, color = 'white');
  drawText('예상 점수', 105, 301, 'rgb(34, 82, 96)', 12, 'center');
  drawRadiusRect(x = 8, y = 436, width = 193, height = 81, radius = 4, opacity = 1, color = 'white');
  drawRadiusRect(x = 12, y = 439, width = 186, height = 22, radius = 4, opacity = 1, color = 'rgb(62, 136, 171)');
  drawText('주사위 충전', 19, 451, 'white', 12, 'left');
  drawRadiusRect(x = 12, y = 463, width = 186, height = 51, radius = 4, opacity = 1, color = 'rgb(89, 119, 128)');
  drawRadiusRect(x = 9, y = 525, width = 192, height = 97, radius = 18, opacity = 1, color = 'white');
  if (env.isDouble) {
    drawRadiusRect(x = 15, y = 531, width = 180, height = 85, radius = 10, opacity = 1, color = 'rgb(56, 123, 214)', 'rgb(121, 238, 199)');
  } else {
    drawRadiusRect(x = 15, y = 531, width = 180, height = 85, radius = 10, opacity = 1, color = 'rgb(255, 138, 44)', 'rgb(255, 225, 110)');
  }
  drawRadiusRect(x = 20, y = 536, width = 170, height = 16, radius = 4, opacity = 0.15, color = 'white');
  drawRadiusRect(x = 10, y = 631, width = 190, height = 26, radius = 8, opacity = 1, color = 'rgb(209, 57, 73)');
  drawRadiusRect(x = 10, y = 660, width = 190, height = 26, radius = 8, opacity = 1, color = 'rgb(48, 66, 101)');
  drawText('주사위 보유 :', 19, 645, 'white', 12, 'left');
  let textDiceUse = `주사위 사용 횟수${' '.repeat(12)}/ 100`;
  let textDiceUseWidth = ctx.measureText(textDiceUse).width;
  drawText(textDiceUse, 19, 674, 'white', 12, 'left');
  drawText(`${env.diceUse}`, textDiceUseWidth - 16, 674, 'rgb(144, 202, 247)', 12, 'right');
  drawRadiusRect(x = 216, y = 634, width = 1011, height = 53, radius = 10, opacity = 0.5, color = 'black');
  drawRadiusRect(x = 223, y = 646, width = 190, height = 31, radius = 8, opacity = 1, color = 'black');
  drawText(`최고 기록:`, 240, 662, 'rgb(254, 245, 187)', 12, 'left');
  drawText(`${maxScore} 칸`, 396, 662, 'rgb(255, 175, 136)', 12, 'right');
  for (let i = 0; i < 5; i++) {
    drawRadiusRect(x = 420 + i * 44, y = 640, width = 42, height = 42, radius = 10, opacity = 1, color = 'rgb(149, 191, 203)');
    drawRadiusRect(x = 423 + i * 44, y = 643, width = 36, height = 36, radius = 8, opacity = 1, color = 'rgb(42, 88, 114)', colorEnd = 'rgb(38, 151, 172)');
    drawArc(x = 431 + i * 44, y = 651, r = 11, opacity = 0.2, color = 'white');
  }
  drawCards();
  drawRadiusRect(x = 640, y = 640, width = 42, height = 42, radius = 10, opacity = 1, color = 'rgb(255, 174, 0)', 'rgb(255, 231, 167)');
  drawRadiusRect(x = 643, y = 643, width = 36, height = 36, radius = 8, opacity = 1, color = 'rgb(74, 45, 48)');
  drawTopLeftTriangle(x = 643, y = 643, width = 23, height = 21, opacity = 0.2, color = 'white');
  ctx.font = 'bold 32px "Arial Rounded MT Bold"';
  const gradient = ctx.createLinearGradient(661, 661, 661, 693);
  gradient.addColorStop(0, 'rgb(255, 255, 255)');
  gradient.addColorStop(0.5, 'rgb(255, 205, 72)');
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgb(217, 147, 11)';
  ctx.shadowBlur = 10;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 661, 661);
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  drawBtn(btnText = '재시작', x = 690, y = 642, width = 90, height = 38, radius = 12, opacity = 1, lineColor = 'rgb(53, 79, 108)', fillColor = 'rgb(45, 137, 195)');
  drawBtn(btnText = '모드변경', x = 788, y = 642, width = 90, height = 38, radius = 12, opacity = 1, lineColor = 'rgb(53, 79, 108)', fillColor = 'rgb(45, 137, 195)');
  drawBtn(btnText = '도움말', x = 886, y = 642, width = 90, height = 38, radius = 12, opacity = 1, lineColor = 'rgb(53, 79, 108)', fillColor = 'rgb(45, 137, 195)');
}

function drawDiceOverlay() {
  if (!showDiceOverlay) return;
  if (env.autoProcess) return;

  const rect = getDiceOverlayRect();
  if (!rect) return;

  const cfg = DICE_OVERLAY_CONFIG;
  const baseY = rect[0].y1;

  for (let i = 0; i < 11; i++) {
    const value = i + 2;
    const x = rect[0].x1 + (i % 6) * (cfg.btnWidth + cfg.gap);
    const y = baseY + Math.floor(i / 6) * (cfg.btnHeight + cfg.gap);

    const isHover = (diceOverlayHoverIndex === i);

    const lineColor = isHover ? 'rgb(255, 210, 140)' : 'rgb(60, 86, 120)';
    const fillColor = isHover ? 'rgb(255, 170, 80)'  : 'rgb(70, 160, 220)';
    const textColor = 'white';

    drawBtn(`+${value}`, x, y, cfg.btnWidth, cfg.btnHeight, 10, 1, lineColor, fillColor, textColor, 11);
  }
}

function getDiceOverlayRect() {
  if (!REGION_STEP) return null;
  const cfg = DICE_OVERLAY_CONFIG;

  const x1 = REGION_STEP.x1;
  const y1 = REGION_STEP.y1 - cfg.margin - cfg.gap - cfg.btnHeight * 2;
  const w1  = 6 * cfg.btnWidth + 5 * cfg.gap;
  const h1 = cfg.btnHeight;
  
  const x2 = REGION_STEP.x1;
  const y2 = REGION_STEP.y1 - cfg.margin - cfg.gap - cfg.btnHeight;
  const w2  = 5 * cfg.btnWidth + 4 * cfg.gap;
  const h2 = cfg.btnHeight + cfg.gap + cfg.margin;
  
  return [
    { x1: x1, x2: x1 + w1, y1: y1, y2: y1 + h1 },
    { x1: x2, x2: x2 + w2, y1: y2, y2: y2 + h2 },
    REGION_STEP
  ];
}

function getDiceOverlayButtonIndex(x, y) {
  const r = getDiceOverlayRect();
  if (!r) return -1;

  if (r.every(rect => (x < rect.x1 || x > rect.x2 || y < rect.y1 || y > rect.y2) === false)) return -1;

  const cfg = DICE_OVERLAY_CONFIG;
  const localX = x - r[0].x1;
  const localY = y - r[0].y1;

  const cell = 6 * Math.floor(localY / (cfg.btnHeight + cfg.gap)) + Math.floor(localX / (cfg.btnWidth + cfg.gap));
  
  if (cell < 0 || cell > 10) return -1;

  const btnX = cell * (cfg.btnWidth + cfg.gap);
  if (localX > btnX + cfg.btnWidth) return -1;
  
  return cell;
}

function drawBtn(btnText = '', x, y, width, height, radius, opacity, lineColor, fillColor, textColor = 'white', fontSize = 12) {
  drawRadiusRect(x, y, width, height, radius, opacity, lineColor);
  drawRadiusRect(x + 2, y + 2, width - 4, height - 4, radius - 2, opacity, fillColor);
  drawRadiusRect(x + 4, y + 4, width - 10, height / 4, radius, opacity = 0.1, color = 'white');
  drawArc(x + width / 11, y + height / 6, r = 4, opacity = 1, color = 'rgba(255, 255, 255, 0.7', colorEnd = 'rgba(255, 255, 255, 0)');
  drawText(btnText, x + width / 2, y + height / 2, textColor, fontSize, 'center');
}

function drawArc(x, y, r, opacity, color, colorEnd, startAngle = 0, endAngle = Math.PI * 2) {
  if (colorEnd) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, colorEnd);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = color;
  }
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(x, y, r, startAngle, endAngle);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawTopLeftTriangle(x, y, width, height, opacity, color, colorEnd) {
  if (colorEnd) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, colorEnd);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = color;
  }
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRadiusRect(x, y, width, height, radius, opacity, color, colorEnd) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (colorEnd) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, colorEnd);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = color;
  }
  ctx.globalAlpha = opacity;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCardInfo() {
  drawRadiusRect(x = 222, y = 7, width = 274, height = 616, radius = 10, opacity = 0.5, color = 'black');
  drawRadiusRect(x = 229, y = 15, width = 260, height = 600, radius = 8, opacity = 1, color = 'white');
  for (let i = 0; i < env.cardInfo.length; i++) {
    let y = i * 30 - env.cardInfoScrollOffset;
    if (y >= -15 && y <= 585) {
      if (env.cardInfo[i][3]) {
        drawText(`✔ ${userCardInfo[i][1]}`, 240, y + 30, 'rgb(255, 127, 80)', 12, 'left');
      } else {
        drawText(`■ ${userCardInfo[i][1]}`, 240, y + 30, 'black', 12, 'left');
      }
    }
  }
  showCardInfoYN = true;

  env.scrollbarY = 15 + 500 * (env.cardInfoScrollOffset / 300);

  ctx.fillStyle = `rgba(0, 0, 0, 0.1)`;
  ctx.fillRect(479, 15, 10, 600);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(479, env.scrollbarY, 10, 100);

}

function drawText(text, x, y, color, size, align, line = 'middle', font = 'Ghothic') {
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.font = `normal normal ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = line;
  ctx.fillText(text, x, y);
}

function drawCards() {
  for (let i = 0, len = env.cards.length; i < len; i++) {
    let iconIndex = env.cards[i][4];
    drawCanvas(78, (iconIndex % 31) * 33, Math.trunc(iconIndex / 31) * 33 + 921, 424 + i * 44, 644, 33, 33);
  }
}

function drawCanvas(i, sx, sy, dx, dy, w, h) {
  ctx.drawImage(backgroundImages[i - 1], sx, sy, w, h, dx, dy, w, h);
}

function drawUsers() {
  let userPos = stage[env.score - 1][6]
  let userX = ((userPos - 1) % 10 + 1) * 96 - 96 + 244;
  let userY = parseInt((userPos - 1) / 10) * 96 + 15;
  
  drawCanvas(77, (userIndex - 1) * 90, 0, userX, userY, 90, 120);
  regionCurrentCharacter = { x1: userX, y1: userY, x2: userX + 90, y2: userY + 120}
}

function drawEvents(n) {
  let events = [];
  for (let i = env.score - 60 < 1 ? 1 : env.score - 60, end = env.score + 60 > 2898 ? 2898 : env.score + 60; i < end; i++) {
    if (stage[i][1] === n) {
      events.push(stage[i]);
    }
  }

  for (let i = 0, len = events.length; i < len; i++) {
    let eventId = events[i][3];
    let eventPos = events[i][6];
    let moveValue = events[i][4];

    if (eventId) {
      drawCanvas(76, ((eventId - 1) % 11) * 89, parseInt((eventId - 1) / 11) * 89, ((eventPos - 1) % 10) * 96 + 244, parseInt((eventPos - 1) / 10) * 96 + 36, 89, 89);
    }

    if (moveValue) {
      ctx.fillStyle = 'white';
      ctx.font = 'normal bold 50px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      if (moveValue > 0) {
        ctx.strokeStyle = 'blue';
        ctx.fillText(`+${moveValue}`, ((eventPos - 1) % 10) * 96 + 244, parseInt((eventPos - 1) / 10) * 96 + 106);
        ctx.strokeText(`+${moveValue}`, ((eventPos - 1) % 10) * 96 + 244, parseInt((eventPos - 1) / 10) * 96 + 106);
      } else {
        ctx.strokeStyle = 'red';
        ctx.fillText(`${moveValue}`, ((eventPos - 1) % 10) * 96 + 244, parseInt((eventPos - 1) / 10) * 96 + 106);
        ctx.strokeText(`${moveValue}`, ((eventPos - 1) % 10) * 96 + 244, parseInt((eventPos - 1) / 10) * 96 + 106);
      }
    }
  }
}

function drawCounter() {
  for (let i = 0; i < 12; i++) {
    if (env.score + i < 2897 && stage[env.score - 1][1] === stage[env.score + i + 1][1]) {
      drawCanvas(76, ((i + 19) % 11) * 89, parseInt((i + 19) / 11) * 89, ((stage[env.score + i + 1][6] - 1) % 10) * 96 + 244, parseInt((stage[env.score + i + 1][6] - 1) / 10) * 96 + 60, 89, 89);
    }
  }
}


// 이벤트 처리용 변수
let isDragging = false;
let preventClick = false;
let dragStartY = 0;
let initialScrollOffset = 0;
let isDraggingCharacter = false;
let characterDragTargetScore = null;
let characterDragStartScore = null;

// 이벤트 처리용 함수
function measureMultilineText(ctx, text, lineHeight) {
  const lines = text.split('\n');

  let maxWidth = 0;
  lines.forEach(line => {
    const lineWidth = ctx.measureText(line).width;
    if (lineWidth > maxWidth) {
      maxWidth = lineWidth;
    }
  });

  const height = lines.length * lineHeight;

  return {
    width: maxWidth + 28,
    height: height + 14
  };
}


// 터치 이벤트
canvas.addEventListener('touchstart', function (e) {
  let x = e.touches[0].clientX;
  let y = e.touches[0].clientY;
  const REGION_CARDINFO_SCROLLBAR = { x1: 459, x2: 509, y1: env.scrollbarY, y2: env.scrollbarY + 100 };

  if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO_SCROLLBAR)) {
    isDragging = true;
    preventClick = true;
    dragStartY = y;
    initialScrollOffset = env.cardInfoScrollOffset;
  }
});

canvas.addEventListener('touchmove', function (e) {

  if (isDragging) {
    let x = e.touches[0].clientX;
    let y = e.touches[0].clientY;
    let dragDistance = y - dragStartY;
    let newScrollOffset = initialScrollOffset + (dragDistance / 500) * 300;

    env.cardInfoScrollOffset = Math.max(0, Math.min(newScrollOffset, 300));

    updateBoard();
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
  isDragging = false;
});


// 마우스 이벤트
function eventSetup() {
  canvas.addEventListener('click', eventCanvasClick);
  canvas.addEventListener('wheel', eventCanvasWheel);
  canvas.addEventListener('mousemove', eventCanvasMousemove);
  canvas.addEventListener('contextmenu', eventCanvasRightClick);
  canvas.addEventListener('mousedown', eventCanvasMousedown);
  canvas.addEventListener('mouseup', eventCanvasMouseup);
  canvas.addEventListener('mouseleave', eventCanvasMouseleave);

  let ctrlYn = new URLSearchParams(window.location.search).get('CtrlYn')?.toUpperCase() === 'Y';
  if (ctrlYn) {
    document.addEventListener('keydown', newEventKeydown);
  } else {
    document.addEventListener('keydown', eventKeydown);
  }
  document.addEventListener('keyup', eventKeyup);

  window.addEventListener('blur', eventWindowBlur);
}

const REGION_SCORE = { x1: 57, x2: 152, y1: 44, y2: 68 };
const REGION_DICEUSE = { x1: 10, x2: 200, y1: 660, y2: 686 };
const REGION_STEP = { x1: 9, x2: 201, y1: 525, y2: 623 };
const REGION_CARDS = { x1: 423, x2: 634, y1: 643, y2: 677 };
const REGION_CARDINFO = { x1: 229, x2: 479, y1: 15, y2: 615 };
const REGION_BTN_CARDINFO = { x1: 640, x2: 679, y1: 643, y2: 677 };
const REGION_BTN_RESETBOARD = { x1: 690, x2: 780, y1: 642, y2: 680 };
const REGION_BTN_CHANGEMODE = { x1: 788, x2: 878, y1: 642, y2: 680 };
const REGION_BTN_HELP = { x1: 886, x2: 976, y1: 642, y2: 680 };
const REGION_BTN_ACCURACY = { x1: 11, x2: 199, y1: 288, y2: 313 };
const REGION_BTN_EXSCORE = { x1: 9, x2: 201, y1: 313, y2: 433 };
const REGION_CHARACTER = { x1: 59, x2: 149, y1: 82, y2: 202 };
const REGION_EXSCORES = { x1: 9, x2: 201, y1: 321, y2: 425 };

function eventCanvasMouseup(e) {
  isDragging = false;

  if (isDraggingCharacter) {
    isDraggingCharacter = false;

    if (characterDragTargetScore !== null && characterDragTargetScore !== env.score) {
      env.score = characterDragTargetScore;
      env.checkEvent();
      calcEx();
    } else {
      updateBoard();
    }

    characterDragTargetScore = null;
    characterDragStartScore = null;
  }
  
  setTimeout(function () {
    preventClick = false;
  }, 0);
}

function eventCanvasMouseleave(e) {
  isDragging = false;
  isDraggingCharacter = false;
}

function eventWindowBlur(e) {
  isDragging = false;
  isDraggingCharacter = false;
  tooltipIndex = -1;
  updateBoard();
}

function eventCanvasMousedown(e) {
  const REGION_CARDINFO_SCROLLBAR = { x1: 479, x2: 489, y1: env.scrollbarY, y2: env.scrollbarY + 100 };
  let x = e.offsetX;
  let y = e.offsetY;

  if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO_SCROLLBAR)) {
    isDragging = true;
    preventClick = true;
    dragStartY = y;
    initialScrollOffset = env.cardInfoScrollOffset;
  } else if (!showCardInfoYN && isInsideRegion(x, y, regionCurrentCharacter)) {
    isDraggingCharacter = true;
    preventClick = true;
    characterDragStartScore = env.score;
    characterDragTargetScore = null;
  }
}

function eventCanvasMousemove(e) {
  let x = e.offsetX;
  let y = e.offsetY;

  if (isDraggingCharacter) {
    const targetScore = getScoreFromMousePosition(x, y);
    characterDragTargetScore = targetScore;

    updateBoard();
    if (targetScore !== null && targetScore !== env.score) {
      const moveValue = targetScore - env.score;
      drawCardPos(moveValue);
    }

    return;
  }

  const inStep = isInsideRegion(x, y, REGION_STEP);
  const r = getDiceOverlayRect();
  const inOverlay = r ? r.some(rect => (x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2)) : false;

  if (inStep || inOverlay) {
    if (!showDiceOverlay) {
      showDiceOverlay = true;
      diceOverlayHoverIndex = -1;
      updateBoard();
    }

    const idx = getDiceOverlayButtonIndex(x, y);
    if (diceOverlayHoverIndex !== idx) {
      diceOverlayHoverIndex = idx;
      updateBoard();

      if (idx >= 0) {
        const value = idx + 2;
        const destScore = getStopDestinationScore(env.score, value);

        if (stage[env.score - 1][1] === stage[destScore - 1][1]) {
          const moveValue = destScore - env.score;
          drawCardPos(moveValue);
        }
      }
    }
  } else {
    if (showDiceOverlay) {
      showDiceOverlay = false;
      diceOverlayHoverIndex = -1;
      updateBoard();
    }
  }

  if (isInsideRegion(x, y, REGION_EXSCORES)) {
    tooltipIndex = Math.trunc((y - 321) / (104 / 6));
    let min = env.exValues.min[tooltipIndex];
    let max = env.exValues.max[tooltipIndex];
    let std = env.exValues.std[tooltipIndex];
    let mid = env.exValues.mid[tooltipIndex];
    let avg = env.exScores[tooltipIndex];
    tooltipInfo.text = `최소: ${min}\n최대: ${max}\n중앙값: ${mid}\n표준편차: ${std}\n변동계수: ${isNaN(std / avg) ? 0 : (std / avg).toFixed(6)}`;
    tooltipInfo.x = x;
    tooltipInfo.y = y;

    updateBoard();
  } else if (tooltipIndex >= 0 && tooltipIndex <= 5) {
    tooltipIndex = -1;
    updateBoard();
  }

  if (isDragging) {
    let dragDistance = y - dragStartY;
    let newScrollOffset = initialScrollOffset + (dragDistance / 500) * 300;

    env.cardInfoScrollOffset = Math.max(0, Math.min(newScrollOffset, 300));

    updateBoard();
  } else if (tooltipIndex === 6) {
    tooltipIndex = -1;
    updateBoard();
  } else if (isInsideRegion(x, y, REGION_CARDS)) {
    let cardIndex = Math.trunc((x - 422) / 43);
    if (env.cards[cardIndex] !== undefined) {
      if (showCardPos !== cardIndex) {
        if (env.cards[cardIndex][1] === 1) {
          updateBoard();
          drawCardPos(env.cards[cardIndex][2]);
          showCardPos = cardIndex;
        } else if (showCardPos > -1) {
          updateBoard();
        }
      }
    } else if (showCardPos !== -1) {
      updateBoard();
    }
  } else if (showCardPos !== -1) {
    updateBoard();
  }
}

function eventCanvasWheel(e) {
  let x = e.offsetX;
  let y = e.offsetY;
  if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO)) {
    env.cardInfoScrollOffset += e.deltaY - 10;
    const minOffset = 0;
    const maxOffset = 300;
    if (env.cardInfoScrollOffset < minOffset) env.cardInfoScrollOffset = minOffset;
    if (env.cardInfoScrollOffset > maxOffset) env.cardInfoScrollOffset = maxOffset;
    updateBoard();
    e.preventDefault();
  }
}

function eventCanvasRightClick(e) {
  let x = e.offsetX;
  let y = e.offsetY;
  if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO)) {
    let index = Math.trunc((y - 15 + env.cardInfoScrollOffset) / 30);
    env.getCard(index, true);
    calcEx();
    // updateBoard();
  }
  e.preventDefault();
}

function eventCanvasClick(e) {
  let x = e.offsetX;
  let y = e.offsetY;

  if (preventClick) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (showDiceOverlay) {
    const idx = getDiceOverlayButtonIndex(x, y);
    if (idx >= 0) {
      const value = idx + 2;

      env.updateScore(value, true);
      calcEx();
      return;
    }
  }

  if (isInsideRegion(x, y, REGION_STEP)) {
    if (env.autoProcess) {
      done = env.step(0);
      calcEx();
    } else {
      env.isDouble = !env.isDouble;
      calcEx();
    }
  } else if (isInsideRegion(x, y, REGION_CARDS)) {
    let action = Math.trunc((x - 379) / 43);
    if (env.cards[action - 1] !== undefined) {
      done = env.step(action);
      calcEx();
      // updateBoard();
    }
  } else if (isInsideRegion(x, y, REGION_SCORE)) {
    let n = prompt('이동', env.score);
    if (n === null || n == '') return;
    n = Number(n);
    if (!isNaN(n) && n > 0 && n <= 2898) {
      env.score = n;
      env.rankReg = true;
      env.checkEvent();
      calcEx();
      // updateBoard();
    } else {
      alert('올바른 숫자를 입력하세요.');
    }
  } else if (isInsideRegion(x, y, REGION_DICEUSE)) {
    let n = prompt('주사위 사용 횟수', env.diceUse);
    if (n === null) return;
    n = Number(n);
    if (!isNaN(n) && n >= 0 && n <= 100) {
      env.diceUse = n;
      env.rankReg = true;
      calcEx();
      // updateBoard();
    } else {
      alert('올바른 숫자를 입력하세요.');
    }
  } else if (!showCardInfoYN && isInsideRegion(x, y, REGION_BTN_CARDINFO)) {
    drawCardInfo();
  } else if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO)) {
    let index = Math.trunc((y - 15 + env.cardInfoScrollOffset) / 30);
    if (env.cardInfo[index][3] === 0) {
      env.getCard(index, false);
    } else {
      env.cardInfo[index][3] = 0;
      env.cardIndex.push(index);
    }
    env.rankReg = true;
    calcEx();
    // updateBoard();
  } else if (isInsideRegion(x, y, REGION_BTN_EXSCORE)) {
    calcEx();
  } else if (isInsideRegion(x, y, REGION_BTN_ACCURACY)) {
    let n = prompt('계산 정확도 (빠름: 2천, 보통: 1만, 정확: 10만 이상)', workerIteration);
    if (n === null || n == '') return;
    n = Number(n);
    if (!isNaN(n) && n > 0) {
      workerIteration = n;
      calcEx();
      // updateBoard();
    } else {
      alert('올바른 숫자를 입력하세요.');
    }
  } else if (isInsideRegion(x, y, REGION_BTN_CHANGEMODE)) {
    if (confirm(`동작 모드를 ${env.autoProcess ? '수동' : '자동'}으로 변경하시겠습니까?`)) {
      env.changeMode();
      done = false;
      calcEx();
      if (env.autoProcess) {
        alert('동작 모드가 자동 모드로 변경되었습니다.')
      } else {
        alert('동작 모드가 수동 모드로 변경되었습니다.')
      }
    }
  } else if (isInsideRegion(x, y, REGION_BTN_RESETBOARD)) {
    if (confirm('게임을 다시 시작하시겠습니까?')) {
      env.resetBoard();
      done = false;
      calcEx();
      // updateBoard();
    }
  } else if (isInsideRegion(x, y, REGION_BTN_HELP)) {
    closeCardInfoPanelGlobal();
    initUsageOverlay();
  } else if (showCardInfoYN) {
    showCardInfoYN = false;
    updateBoard();
  }

  if (done && env.autoProcess && !env.rankReg) {
    // postRankingData(env.score);
    env.rankReg = true;
  }
}

function isInsideRegion(x, y, r) {
  return x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2;
}

function eventKeydown(e) {
  if (e.key === 'Control') {
    keyDownCtrl = true;
  } else if (keyDownCtrl && e.key === 'q') {
    e.preventDefault();
    if (!env.autoProcess) {
      let n = prompt('이동', env.score);
      if (n === null || n == '') return;
      n = Number(n);
      if (!isNaN(n) && n > 0 && n < 2898) {
        env.score = n;
        env.rankReg = true;
        env.checkEvent();
        calcEx();
        // updateBoard();
      } else {
        alert('올바른 숫자를 입력하세요.');
      }
      keyDownCtrl = false;
    }
  } else if (keyDownCtrl && e.key === 'e') {
    e.preventDefault();
    if (!env.autoProcess) {
      let n = prompt('주사위 사용 횟수', env.diceUse);
      if (n === null) return;
      n = Number(n);
      if (!isNaN(n) && n >= 0 && n <= 100) {
        env.diceUse = n;
        env.rankReg = true;
        calcEx();
        // updateBoard();
      } else {
        alert('올바른 숫자를 입력하세요.');
      }
      keyDownCtrl = false;
    }
  } else if (keyDownCtrl && e.key === 'r') {
    e.preventDefault();
    calcEx();
  } else if (keyDownCtrl && e.key === 'g') {
    e.preventDefault();
    let name;
    name = prompt('행운카드 이름');
    if (name !== undefined && name !== '') {
      name = name.replace('+', '앞으로 ');
      name = name.replace('-', '뒤로 ');
      name = name.replace('*', '주사위 ');
      name = name.replace(/^>.*/, '다음 스테이지');
      for (let i = 0; i < env.cardInfo.length; i++) {
        if (userCardInfo[i][1].indexOf(name) >= 0 && env.cardInfo[i][3] === 0) {
          env.getCard(i);
          calcEx();
          break;
        }
      }
    }
    keyDownCtrl = false;
  } else if (keyDownCtrl && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    let action = e.key;
    if (env.cards[action - 1] !== undefined) {
      done = env.step(action);
      calcEx();
      // updateBoard();
    }
  } else if (e.key === 'ArrowLeft') {
    env.moveStage(-1);
    calcEx();
  } else if (e.key === 'ArrowRight') {
    env.moveStage(1);
    calcEx();
  }
}

function newEventKeydown(e) {
  if (e.key === 'Control') {
    keyDownCtrl = true;
  } else if (keyDownCtrl && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    let action = e.key;
    if (env.cards[action - 1] !== undefined) {
      done = env.step(action);
      calcEx();
      // updateBoard();
    }
  } else if (e.key === '1') {
    if (!env.autoProcess) {
      let n = prompt('이동', env.score);
      if (n === null || n == '') return;
      n = Number(n);
      if (!isNaN(n) && n > 0 && n < 2898) {
        env.score = n;
        env.rankReg = true;
        env.checkEvent();
        calcEx();
        // updateBoard();
      } else {
        alert('올바른 숫자를 입력하세요.');
      }
    }
  } else if (e.key === '2') {
    if (!env.autoProcess) {
      let n = prompt('주사위 사용 횟수', env.diceUse);
      if (n === null) return;
      n = Number(n);
      if (!isNaN(n) && n >= 0 && n <= 100) {
        env.diceUse = n;
        env.rankReg = true;
        calcEx();
        // updateBoard();
      } else {
        alert('올바른 숫자를 입력하세요.');
      }
    }
  } else if (keyDownCtrl && e.key === 'r') {
    e.preventDefault();
    calcEx();
  } else if (e.key === '3') {
    let name;
    name = prompt('행운카드 이름');
    if (name !== undefined && name !== '') {
      name = name.replace('+', '앞으로 ');
      name = name.replace('-', '뒤로 ');
      name = name.replace('*', '주사위 ');
      name = name.replace(/^>.*/, '다음 스테이지');
      for (let i = 0; i < env.cardInfo.length; i++) {
        if (userCardInfo[i][1].indexOf(name) >= 0 && env.cardInfo[i][3] === 0) {
          env.getCard(i);
          calcEx();
          break;
        }
      }
    }
  }
}

function eventKeyup(e) {
  if (e.key === 'Control') {
    keyDownCtrl = false;
  }
}

function getScoreFromMousePosition(x, y) {
  const boardX = x - 244;
  const boardY = y - 60;

  if (boardX < 0 || boardY < 0) return null;

  const col = Math.floor(boardX / 96);
  const row = Math.floor(boardY / 96);
  if (col < 0 || col > 9 || row < 0) return null;

  const localPos = row * 10 + col + 1;

  const currentStageId = stage[env.score - 1][1];
  const currentScore = Math.max(0, env.score - 60);
  const len = Math.min(2897, env.score + 120);

  for (let i = currentScore; i < len; i++) {
    if (stage[i][1] === currentStageId && stage[i][6] === localPos) {
      return i + 1;
    }
  }

  return null;
}

function getStopDestinationScore(startScore, value) {
  if (value <= 0) return startScore;

  let targetScore = startScore + value;

  let startIndex = startScore;
  let endIndex = Math.min(2897, startScore + value - 1);

  for (let i = startIndex; i < endIndex; i++) {
    if (stage[i][5] === 6 || stage[i][5] === 9) {
      targetScore = i + 1;
      break;
    }
  }

  return Math.min(2898, targetScore);
}





const workerCode = `
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
    this.autoProcess = true;
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

let idx;

onmessage = function (e) {
  idx = e.data.idx;
  stage = e.data.stage;
  cardInfo = e.data.cardInfo;
  state = e.data.state;
  let res = simulation(e.data.iteration, state, e.data.route);
  postMessage({
    res: res,
    idx: idx,
    route: e.data.route,
  });
}

function simulation(iteration = 10000, state, route) {
  let env = new Board();
  env.setState(state);
  env.autoProcess = true;
  if (env.diceUse >= 100 && !env.isDouble) return [-2];
  try {
    let actionSize = env.cards.length + 1;
    let avgScores = new Array(actionSize).fill(0);
    let minScores = new Array(actionSize).fill(0);
    let maxScores = new Array(actionSize).fill(0);
    let stdScores = new Array(actionSize).fill(0);
    let medianScores = new Array(actionSize).fill(0);
    for (let i = 0; i < actionSize; i++) {
      let scores = [];
      if (route !== undefined && route.includes(i)) {
        for (let j = 0; j < iteration; j++) {
          let done = false;
          let sEnv = new Board();
          sEnv.setState(state);
          sEnv.autoProcess = true;

          sEnv.step(i);
          // sEnv.step(Math.trunc(Math.random() * (sEnv.cards.length + 1)));

          while (!done) {
            done = sEnv.step(sEnv.chooseAction());
          }
          scores.push(sEnv.score);
        }
        avgScores[i] = scores.reduce((a, v) => a + v, 0) / scores.length;
        minScores[i] = scores.reduce((min, current) => (current < min ? current : min), scores[0]);
        maxScores[i] = scores.reduce((max, current) => (current > max ? current : max), scores[0]);
        let variance = scores.reduce((a, v) => a + Math.pow(v - avgScores[i], 2), 0) / scores.length;
        stdScores[i] = Math.sqrt(variance);
        let sortedScores = [...scores].sort((a, b) => a - b);
        let median;
        if (sortedScores.length % 2 === 0) {
          median = (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2;
        } else {
          median = sortedScores[Math.floor(sortedScores.length / 2)];
        }
        medianScores[i] = median;
      }
    }
    return [1, { avg: avgScores, min: minScores, max: maxScores, std: stdScores, mid: medianScores }];
  } catch (err) {
    console.error(err);
    return [-1];
  }
}
`;







const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);


let workerIteration = 10000;
let workerReqIndex = 1;
let workers = [];
for (let i = 0; i < 6; i++) {
  workers.push(new Worker(workerUrl));
}
let workerRunnings = new Array(6).fill(false);

function calcEx(r = [0, 1, 2, 3, 4, 5]) {
  env.exScores = new Array(6).fill(0);
  env.exValues = { min: new Array(6).fill(0), max: new Array(6).fill(0), std: new Array(6).fill(0), mid: new Array(6).fill(0) };
  tooltipInfo.text = `최소: 0\n최대: 0\n중앙값: 0\n표준편차: 0\n변동계수: 0`;
  for (let i = 0; i < 6; i++) {
    if (i === 0 || env.cards[i - 1] !== undefined && r.includes(i)) {
      env.exScores[i] = '계산중...';
      env.exValues.min[i] = 0;
      env.exValues.max[i] = 0;
      env.exValues.std[i] = 0;
      env.exValues.mid[i] = 0;

      if (workerRunnings[i]) {
        workers[i].terminate();
        workers[i] = new Worker(workerUrl);
        workerRunnings[i] = false;
      }

      workers[i].postMessage({
        idx: workerReqIndex,
        iteration: workerIteration,
        state: env.getState(),
        stage: stage,
        cardInfo: cardInfo,
        route: [i],
      });
      workerRunnings[i] = true;

      workers[i].onmessage = function (e) {
        if (e.data.idx === workerReqIndex - 1) {
          switch (e.data.res[0]) {
            case undefined:
            case -1:
              // Error
              env.exScores[e.data.route] = String(env.exScores[i]).replace('계산중...', 'Error');
              if (env.exScores.indexOf('계산중...') === -1) {
                console.timeEnd(`${workerIteration} simulation`);
              }
              updateBoard();
              return;
            case -2:
              // GameOver
              env.exScores[e.data.route] = env.score;
              if (env.exScores.indexOf('계산중...') === -1) {
                console.timeEnd(`${workerIteration} simulation`);
              }
              updateBoard();
              return;
          }
          workerRunnings[e.data.route] = false;
          env.exScores[e.data.route] = e.data.res[1].avg[e.data.route];
          env.exValues.min[e.data.route] = e.data.res[1].min[e.data.route];
          env.exValues.max[e.data.route] = e.data.res[1].max[e.data.route];
          env.exValues.mid[e.data.route] = e.data.res[1].mid[e.data.route];
          env.exValues.std[e.data.route] = parseFloat(e.data.res[1].std[e.data.route].toFixed(3));
          if (tooltipIndex === i) {
            let min = env.exValues.min[i];
            let max = env.exValues.max[i];
            let std = env.exValues.std[i];
            let mid = env.exValues.mid[i];
            let avg = env.exScores[i];
            tooltipInfo.text = tooltipInfo.text = `최소: ${min}\n최대: ${max}\n중앙값: ${mid}\n표준편차: ${std}\n변동계수: ${isNaN(std / avg) ? 0 : (std / avg).toFixed(6)}`;
          }
          if (env.exScores.indexOf('계산중...') === -1) {
            let maxValue = Math.max(...env.exScores.filter(el => typeof (el) === 'number'));
            env.exAction = env.exScores.indexOf(maxValue);
            env.exScore = maxValue - calcLoss(workerIteration);
            console.timeEnd(`${workerIteration} simulation`);
          }
          updateBoard();
        }
      }
    }
  }
  console.time(`${workerIteration} simulation`)
  workerReqIndex++;
  env.exAction = undefined;
  env.exScore = Infinity;
  updateBoard();
}

function calcLoss(x) {
  if (x > 999999) return 0;
  const logX = Math.log10(x);
  return 0.25 * Math.pow(logX, 2) - 3.25 * logX + 10.5;
}

function getBoardInfo() {
  env = new Board();
  imagesPreload();
}








// =======================
// 공용: 카드 정보 창 닫기
// =======================
function closeCardInfoPanelGlobal() {
  try {
    if (typeof showCardInfoYN !== 'undefined' && showCardInfoYN) {
      showCardInfoYN = false;
      if (typeof updateBoard === 'function') {
        updateBoard();
      }
    }
  } catch (e) {
    // 실패해도 무시
  }
}

// =======================
// 사용법 안내 가이드
// =======================
function initUsageOverlay() {
  if (!canvas) return;
  // 이미 떠 있으면 중복 생성 방지
  if (document.getElementById('adventure-usage-root')) return;

  var steps = [
    {
      id: 'position',
      title: '현재 위치(칸 수) 이동',
      lines: [
        'Ctrl + Q: 현재 위치(칸 수)를 직접 입력해서 이동할 수 있습니다.',
        '칸 표시 영역을 클릭해도 같은 기능을 사용할 수 있습니다.'
      ],
      region: REGION_SCORE
    },
    {
      id: 'exScore',
      title: '예상 점수와 통계 활용',
      lines: [
        '예상 점수(하늘색 영역): 클릭하면 시뮬레이션 정확도(시행 횟수)를 수정할 수 있습니다.',
        'Ctrl + R: 예상 점수를 재계산할 수 있습니다. 점수 출력 영역을 클릭해도 같은 기능을 사용할 수 있습니다.',
        '점수 출력 영역에 마우스를 올려두면 최소·최대·중앙값·표준편차·변동계수 등 상세 통계를 볼 수 있습니다.',
        '"자세히" 버튼을 눌러 각 통계의 의미와 해석 방법에 대한 간단한 가이드를 확인할 수 있습니다.'
      ],
      region: {
        x1: REGION_BTN_ACCURACY.x1,
        x2: REGION_BTN_EXSCORE.x2,
        y1: REGION_BTN_ACCURACY.y1,
        y2: REGION_BTN_EXSCORE.y2
      },
      detailHtml:
        '<div style="margin-bottom:4px;"><strong style="color:#0f172a;">통계값 의미</strong></div>' +
        '<ul style="margin:0 0 4px 0; padding-left:16px; list-style:disc;">' +
        '<li><span style="font-weight:600;color:#1d4ed8;">최소/최대</span>: 가장 낮은 결과와 가장 높은 결과입니다.</li>' +
        '<li><span style="font-weight:600;color:#1d4ed8;">중앙값</span>: 결과들을 정렬했을 때 정확히 가운데에 오는 값입니다.</li>' +
        '<li><span style="font-weight:600;color:#1d4ed8;">표준편차</span>: 결과들이 평균에서 얼마나 퍼져 있는지를 나타냅니다.</li>' +
        '<li><span style="font-weight:600;color:#1d4ed8;">변동계수</span>: 표준편차를 평균으로 나눈 값으로, 상대적인 변동성을 보여줍니다.</li>' +
        '</ul>' +
        '<div style="margin-top:2px;">' +
        '예를 들어, 평균은 높은데 표준편차와 변동계수가 크면<br><span style="font-weight:600;color:#b91c1c;">운에 따라 결과 편차가 크다</span>는 뜻이고,<br>' +
        '평균이 비슷한 두 선택지에서 변동계수가 더 작은 쪽은<br><span style="font-weight:600;color:#16a34a;">보다 안정적인 선택</span>이라고 볼 수 있습니다.' +
        '</div>'
    },
    {
      id: 'stepButton',
      title: '주사위 버튼과 더블 설정',
      lines: [
        '수동 모드: 주사위 버튼을 클릭하면 다음 주사위 굴림을 더블로 처리할지 여부를 토글할 수 있습니다.',
        '수동 모드에서는 주사위 버튼 위에 마우스를 올려두면 +2부터 +12까지 버튼이 나타나며, 원하는 값을 골라 앞으로 즉시 이동할 수 있습니다.',
        '자동 모드: 주사위 버튼을 클릭하면 실제로 주사위를 굴리며, 필요하다면 자동으로 더블 상태가 적용됩니다.'
      ],
      region: REGION_STEP
    },
    {
      id: 'diceUse',
      title: '주사위 사용 횟수 설정',
      lines: [
        'Ctrl + E: 지금까지 사용한 주사위 횟수를 직접 입력해서 수정할 수 있습니다.',
        '"주사위 사용" 영역을 클릭해도 같은 기능을 사용할 수 있습니다.'
      ],
      region: REGION_DICEUSE
    },
    {
      id: 'characterDrag',
      title: '보드 위 캐릭터 드래그 이동',
      lines: [
        '보드판 위 캐릭터: 마우스로 드래그하여 원하는 칸으로 옮기면, 해당 위치의 칸으로 바로 이동합니다.',
        '드래그를 놓았을 때 도착한 칸 기준으로 이벤트가 다시 적용되며, 이후 예상 점수도 자동으로 다시 계산됩니다.',
        '수동 모드에서 테스트 경로를 빠르게 바꾸고 싶을 때 유용합니다.',
        '키보드 좌/우 방향키를 이용하여 스테이지 단위로 이동합니다.'
      ],
      dynamicRegion: function() {
        if (
          !window.regionCurrentCharacter ||
          (
            regionCurrentCharacter.x1 === 0 &&
            regionCurrentCharacter.x2 === 0 &&
            regionCurrentCharacter.y1 === 0 &&
            regionCurrentCharacter.y2 === 0
          )
        ) {
          return null;
        }
        return {
          x1: regionCurrentCharacter.x1,
          x2: regionCurrentCharacter.x2,
          y1: regionCurrentCharacter.y1,
          y2: regionCurrentCharacter.y2
        };
      }
    },
    {
      id: 'cardsUse',
      title: '행운 카드 사용',
      lines: [
        'Ctrl + 1 ~ 5: 해당 번호의 행운 카드를 바로 사용합니다.',
        '아래 카드 슬롯(1~5번)을 직접 클릭해도 카드를 사용할 수 있습니다.'
      ],
      region: REGION_CARDS
    },
    {
      id: 'cardInfoButton',
      title: '카드 획득 정보 보기',
      lines: [
        '카드 정보 아이콘: 오른쪽 아래 아이콘을 클릭하면 카드 획득 정보를 볼 수 있습니다.'
      ],
      region: REGION_BTN_CARDINFO
    },
    {
      id: 'cardInfoPanel',
      title: '카드 정보 창 사용법',
      lines: [
        '왼쪽 클릭: 해당 카드의 획득 여부를 토글합니다 (체크/해제).',
        '오른쪽 클릭: 해당 카드를 바로 획득 처리합니다.',
        '스크롤/드래그: 목록을 위아래로 움직여 모든 카드를 확인할 수 있습니다.'
      ],
      region: REGION_CARDINFO
    },
    {
      id: 'cardGetByName',
      title: '카드 이름으로 바로 획득',
      lines: [
        'Ctrl + G: 행운 카드 이름의 일부를 입력해서, 그 이름을 포함하는 카드를 바로 획득할 수 있습니다.',
        '예를 들어, "주사위"를 입력하면 이름에 "주사위"가 포함된 카드 중 아직 획득하지 않은 첫 카드를 찾습니다.',
        '정확한 전체 이름이 아니라, 키워드 위주로 입력해도 됩니다.',
        '"자세히" 버튼을 눌러, 특수 키워드를 사용해 더 빠르게 검색하는 방법을 확인할 수 있습니다.'
      ],
      region: REGION_CARDINFO,
      detailHtml:
        '검색용 특수 키워드:<br>' +
        '앞으로 N칸 이동: ' +
          '<span style="font-weight:600;color:#1d4ed8;">+N</span> ' +
          '또는 ' +
          '<span style="font-weight:600;color:#1d4ed8;">N</span><br>' +
        '뒤로 N칸 이동: ' +
          '<span style="font-weight:600;color:#1d4ed8;">-N</span><br>' +
        '주사위 N배: ' +
          '<span style="font-weight:600;color:#1d4ed8;">*N</span><br>' +
        '다음 스테이지: ' +
          '<span style="font-weight:600;color:#1d4ed8;">&gt;</span>'
    },
    {
      id: 'mode',
      title: '동작 모드 (수동 / 자동)',
      lines: [
        '수동 모드: 칸 수, 주사위 사용 횟수, 카드 획득 등을 직접 수동으로 설정하여 테스트가 가능한 모드입니다. (기본값)',
        '자동 모드: 모든 게임 프로세스가 자동으로 진행되어 실제 인게임과 거의 동일한 환경으로 시뮬레이션이 가능합니다. <span style="font-weight:600;color:#b91c1c;">자동 모드에서는 카드 정보 수정 및 강제 획득이 불가능합니다.</span>'
      ],
      region: REGION_BTN_CHANGEMODE
    }
  ];

  createUsageOverlayWithSteps(steps);
}

function createUsageOverlayWithSteps(steps) {
  var currentStepIndex = 0;
  var isActive = true;

  var canvasWidth = canvas.width || 1024;
  var canvasHeight = canvas.height || 694;

  var root = document.createElement('div');
  root.id = 'adventure-usage-root';
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.zIndex = '9999';
  root.style.pointerEvents = 'none';

  var dimTop = document.createElement('div');
  var dimLeft = document.createElement('div');
  var dimRight = document.createElement('div');
  var dimBottom = document.createElement('div');
  [dimTop, dimLeft, dimRight, dimBottom].forEach(function (el) {
    el.style.position = 'fixed';
    el.style.background = 'rgba(15, 23, 42, 0.72)';
    el.style.pointerEvents = 'none';
  });

  var highlightBox = document.createElement('div');
  highlightBox.id = 'adventure-usage-highlight';
  highlightBox.style.position = 'fixed';
  highlightBox.style.border = '2px solid #38bdf8';
  highlightBox.style.borderRadius = '12px';
  highlightBox.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.35)';
  highlightBox.style.pointerEvents = 'none';
  highlightBox.style.transition = 'box-shadow 0.6s ease';

  var bubble = document.createElement('div');
  bubble.id = 'adventure-usage-bubble';
  bubble.style.position = 'fixed';
  bubble.style.maxWidth = '320px';
  bubble.style.background = 'white';
  bubble.style.borderRadius = '14px';
  bubble.style.padding = '14px 16px 12px 16px';
  bubble.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.35)';
  bubble.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  bubble.style.color = '#0f172a';
  bubble.style.fontSize = '13px';
  bubble.style.pointerEvents = 'auto';

  var bubbleArrow = document.createElement('div');
  bubbleArrow.style.position = 'absolute';
  bubbleArrow.style.width = '0';
  bubbleArrow.style.height = '0';
  bubbleArrow.style.borderTop = '8px solid transparent';
  bubbleArrow.style.borderBottom = '8px solid transparent';
  bubbleArrow.style.borderRight = '10px solid white';
  bubbleArrow.style.left = '-10px';
  bubbleArrow.style.top = '18px';

  var titleEl = document.createElement('div');
  titleEl.style.fontWeight = '700';
  titleEl.style.fontSize = '14px';
  titleEl.style.marginBottom = '4px';
  titleEl.style.color = '#111827';

  var bodyEl = document.createElement('ul');
  bodyEl.style.margin = '4px 0 8px 14px';
  bodyEl.style.padding = '0';
  bodyEl.style.listStyle = 'disc';
  bodyEl.style.lineHeight = '1.5';

  var footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.marginTop = '4px';

  var leftFooter = document.createElement('div');
  leftFooter.style.display = 'flex';
  leftFooter.style.alignItems = 'center';
  leftFooter.style.gap = '6px';

  var stepIndicator = document.createElement('div');
  stepIndicator.style.fontSize = '12px';
  stepIndicator.style.color = '#475569';

  var skipBtn = document.createElement('button');
  skipBtn.textContent = '건너뛰기';
  skipBtn.style.border = '1px solid #f97316';
  skipBtn.style.borderRadius = '999px';
  skipBtn.style.background = 'white';
  skipBtn.style.color = '#c2410c';
  skipBtn.style.fontSize = '11px';
  skipBtn.style.padding = '4px 10px';
  skipBtn.style.cursor = 'pointer';

  var detailBtn = document.createElement('button');
  detailBtn.textContent = '자세히';
  detailBtn.style.border = 'none';
  detailBtn.style.borderRadius = '999px';
  detailBtn.style.background = '#e0f2fe';
  detailBtn.style.color = '#0369a1';
  detailBtn.style.fontSize = '11px';
  detailBtn.style.padding = '4px 10px';
  detailBtn.style.cursor = 'pointer';
  detailBtn.style.display = 'none';

  leftFooter.appendChild(stepIndicator);
  leftFooter.appendChild(skipBtn);
  leftFooter.appendChild(detailBtn);

  var btnGroup = document.createElement('div');

  var prevBtn = document.createElement('button');
  prevBtn.textContent = '이전';
  prevBtn.style.marginRight = '8px';
  styleUsagePrimaryBtn(prevBtn, true);

  var nextBtn = document.createElement('button');
  nextBtn.textContent = '다음';
  styleUsagePrimaryBtn(nextBtn, false);

  btnGroup.appendChild(prevBtn);
  btnGroup.appendChild(nextBtn);

  footer.appendChild(leftFooter);
  footer.appendChild(btnGroup);

  var detailPanel = document.createElement('div');
  detailPanel.style.display = 'none';
  detailPanel.style.marginTop = '6px';
  detailPanel.style.paddingTop = '6px';
  detailPanel.style.borderTop = '1px solid #e2e8f0';
  detailPanel.style.fontSize = '12px';
  detailPanel.style.color = '#4b5563';

  // 건너뛰기 확인 박스
  var skipConfirm = document.createElement('div');
  skipConfirm.style.position = 'fixed';
  skipConfirm.style.left = `${canvas.width / 2}px`
  skipConfirm.style.top = `${canvas.height / 2}px`
  skipConfirm.style.transform = 'translateX(-50%)';
  skipConfirm.style.background = 'white';
  skipConfirm.style.borderRadius = '14px';
  skipConfirm.style.padding = '12px 16px';
  skipConfirm.style.boxShadow = '0 18px 40px rgba(15,23,42,0.45)';
  skipConfirm.style.fontSize = '12px';
  skipConfirm.style.color = '#111827';
  skipConfirm.style.display = 'none';
  skipConfirm.style.zIndex = '10000';
  skipConfirm.style.pointerEvents = 'auto';
  skipConfirm.style.minWidth = '260px';
  skipConfirm.style.maxWidth = '320px';

  var skipText = document.createElement('div');
  skipText.innerHTML = '도움말을 종료할까요?<br><span style="color:#6b7280;">나중에 다시 보려면 <strong>도움말</strong> 버튼을 누르세요.</span>';
  skipText.style.marginBottom = '8px';

  var skipBtnRow = document.createElement('div');
  skipBtnRow.style.display = 'flex';
  skipBtnRow.style.justifyContent = 'flex-end';
  skipBtnRow.style.gap = '6px';

  var skipCancel = document.createElement('button');
  skipCancel.textContent = '계속 보기';
  skipCancel.style.border = 'none';
  skipCancel.style.borderRadius = '999px';
  skipCancel.style.background = '#e5e7eb';
  skipCancel.style.color = '#374151';
  skipCancel.style.fontSize = '11px';
  skipCancel.style.padding = '4px 10px';
  skipCancel.style.cursor = 'pointer';

  var skipOk = document.createElement('button');
  skipOk.textContent = '종료';
  skipOk.style.border = 'none';
  skipOk.style.borderRadius = '999px';
  skipOk.style.background = '#ef4444';
  skipOk.style.color = '#f9fafb';
  skipOk.style.fontSize = '11px';
  skipOk.style.padding = '4px 10px';
  skipOk.style.cursor = 'pointer';

  skipBtnRow.appendChild(skipCancel);
  skipBtnRow.appendChild(skipOk);
  skipConfirm.appendChild(skipText);
  skipConfirm.appendChild(skipBtnRow);

  bubble.appendChild(titleEl);
  bubble.appendChild(bodyEl);
  bubble.appendChild(footer);
  bubble.appendChild(detailPanel);
  bubble.appendChild(bubbleArrow);

  root.appendChild(dimTop);
  root.appendChild(dimLeft);
  root.appendChild(dimRight);
  root.appendChild(dimBottom);
  root.appendChild(highlightBox);
  root.appendChild(bubble);
  root.appendChild(skipConfirm);

  document.body.appendChild(root);

  function cleanup() {
    isActive = false;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    canvas.removeEventListener('click', canvasClickListener, true);
    window.removeEventListener('resize', renderStep);
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }
  document.addEventListener('keydown', escHandler);

  function goToStep(index) {
    if (index < 0 || index >= steps.length) return;

    var prevStep = steps[currentStepIndex];
    var nextStep = steps[index];

    // 7 → 8로 넘어갈 때
    if (prevStep && nextStep && prevStep.id === 'cardInfoButton' && nextStep.id === 'cardInfoPanel' && !showCardInfoYN) {
      drawCardInfo();
    }

    // 8 → 7로 되돌아갈 때
    if (prevStep && nextStep && prevStep.id === 'cardInfoPanel' && nextStep.id === 'cardInfoButton') {
      closeCardInfoPanelGlobal();
    }
    // 9 → 10으로 넘어갈 때
    if (prevStep && nextStep && prevStep.id === 'cardGetByName' && nextStep.id === 'mode') {
      closeCardInfoPanelGlobal();
    }

    currentStepIndex = index;
    renderStep();
  }

  function canvasClickListener(e) {
    if (!isActive) return;

    var step = steps[currentStepIndex];
    if (!step) return;

    var canvasRect = canvas.getBoundingClientRect();
    var scaleX = canvasRect.width / canvasWidth;
    var scaleY = canvasRect.height / canvasHeight;
    var x = e.clientX - canvasRect.left;
    var y = e.clientY - canvasRect.top;
    var localX = x / scaleX;
    var localY = y / scaleY;

    // 8번, 9번 스텝에서는 실수로 카드 정보창이 닫히지 않도록 시도
    if (step.id === 'cardInfoPanel' || step.id === 'cardGetByName') {
      if (!isInsideRegion(localX, localY, REGION_CARDINFO)) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // 영역 안 클릭은 그대로 통과
      return;
    }
  }

  canvas.addEventListener('click', canvasClickListener, true);

  function renderStep() {
    var step = steps[currentStepIndex];
    if (!step) return;

    var canvasRect = canvas.getBoundingClientRect();
    var scaleX = canvasRect.width / canvasWidth;
    var scaleY = canvasRect.height / canvasHeight;

    // 🔹 1) dynamicRegion이 있으면 우선 사용
    var r = null;
    if (typeof step.dynamicRegion === 'function') {
      r = step.dynamicRegion();
    }
    // 🔹 2) 없거나 null이면 기존 region 사용
    if (!r && step.region) {
      r = step.region;
    }
    // 🔹 3) 그래도 없으면(또는 0,0,0,0이면) 이 스텝은 하이라이트만 생략
    if (
      !r ||
      (r.x1 === r.x2 && r.y1 === r.y2)
    ) {
      highlightBox.style.width = '0';
      highlightBox.style.height = '0';
      return;
    }
    
    var left = canvasRect.left + r.x1 * scaleX;
    var top = canvasRect.top + r.y1 * scaleY;
    var width = (r.x2 - r.x1) * scaleX;
    var height = (r.y2 - r.y1) * scaleX;

    // 강조 영역
    var pad = 6;
    left -= pad;
    top -= pad;
    width += pad * 2;
    height += pad * 2;

    var vw = window.innerWidth;
    var vh = window.innerHeight;

    dimTop.style.left = '0px';
    dimTop.style.top = '0px';
    dimTop.style.width = vw + 'px';
    dimTop.style.height = Math.max(0, top) + 'px';

    dimLeft.style.left = '0px';
    dimLeft.style.top = Math.max(0, top) + 'px';
    dimLeft.style.width = Math.max(0, left) + 'px';
    dimLeft.style.height = Math.max(0, height) + 'px';

    dimRight.style.left = (left + width) + 'px';
    dimRight.style.top = Math.max(0, top) + 'px';
    dimRight.style.width = Math.max(0, vw - (left + width)) + 'px';
    dimRight.style.height = Math.max(0, height) + 'px';

    dimBottom.style.left = '0px';
    dimBottom.style.top = (top + height) + 'px';
    dimBottom.style.width = vw + 'px';
    dimBottom.style.height = Math.max(0, vh - (top + height)) + 'px';

    highlightBox.style.left = left + 'px';
    highlightBox.style.top = top + 'px';
    highlightBox.style.width = width + 'px';
    highlightBox.style.height = height + 'px';

    titleEl.textContent = step.title;
    bodyEl.innerHTML = '';

    step.lines.forEach(function (line) {
      var li = document.createElement('li');
      var colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        var key = line.slice(0, colonIndex);
        var rest = line.slice(colonIndex + 1);
        
        li.innerHTML = '<span style="color:#1d4ed8; font-weight:600;">' +
          key +
          ':</span>' +
          rest; // rest 부분은 HTML이 포함될 수 있음
      } else {
        li.innerHTML = line; // 이 경우 전체 문자열을 HTML로 해석
      }

      bodyEl.appendChild(li);
    });

    stepIndicator.textContent = (currentStepIndex + 1) + ' / ' + steps.length;

    if (currentStepIndex === 0) {
      prevBtn.disabled = true;
      prevBtn.style.opacity = '0.4';
      prevBtn.style.cursor = 'default';
    } else {
      prevBtn.disabled = false;
      prevBtn.style.opacity = '1';
      prevBtn.style.cursor = 'pointer';
    }

    if (step.waitForCardInfoClick) {
      nextBtn.textContent = '다음';
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.4';
      nextBtn.style.cursor = 'default';
    } else if (currentStepIndex === steps.length - 1) {
      nextBtn.textContent = '완료';
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    } else {
      nextBtn.textContent = '다음';
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }

    if (step.detailHtml) {
      detailBtn.style.display = 'inline-block';
      detailBtn.textContent = '자세히';
      detailPanel.style.display = 'none';
    } else {
      detailBtn.style.display = 'none';
      detailPanel.style.display = 'none';
    }

    var bubbleWidth = 320;
    var margin = 18;
    var bubbleLeft = left + width + margin;
    var bubbleTop = top;

    if (bubbleLeft + bubbleWidth > vw - 16) {
      bubbleLeft = Math.min(Math.max(16, left + width / 2 - bubbleWidth / 2), vw - bubbleWidth - 16);
      bubbleTop = top + height + margin;
      bubbleArrow.style.borderRight = '10px solid transparent';
      bubbleArrow.style.borderTop = '8px solid white';
      bubbleArrow.style.borderBottom = 'none';
      bubbleArrow.style.left = '24px';
      bubbleArrow.style.top = '-8px';
    } else {
      bubbleArrow.style.borderTop = '8px solid transparent';
      bubbleArrow.style.borderBottom = '8px solid transparent';
      bubbleArrow.style.borderRight = '10px solid white';
      bubbleArrow.style.left = '-10px';
      bubbleArrow.style.top = '18px';
    }

    bubble.style.left = bubbleLeft + 'px';
    bubble.style.top = bubbleTop + 'px';
  }

  prevBtn.addEventListener('click', function () {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  });

  nextBtn.addEventListener('click', function () {
    if (nextBtn.disabled) return;
    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      cleanup();
    }
  });

  skipBtn.addEventListener('click', function () {
    skipConfirm.style.display = 'block';
  });

  skipCancel.addEventListener('click', function () {
    skipConfirm.style.display = 'none';
  });

  skipOk.addEventListener('click', function () {
    cleanup();
  });

  detailBtn.addEventListener('click', function () {
    let step = steps[currentStepIndex];

    if (!step || !step.detailHtml) return;
    
    if (detailPanel.style.display === 'none') {
      detailPanel.style.display = 'block';
      detailBtn.textContent = '간단히';
      detailPanel.innerHTML = step.detailHtml;
    } else {
      detailPanel.style.display = 'none';
      detailBtn.textContent = '자세히';
    }
  });

  window.addEventListener('resize', renderStep);

  renderStep();
}

function styleUsagePrimaryBtn(btn, disabled) {
  btn.style.border = 'none';
  btn.style.borderRadius = '999px';
  btn.style.padding = '6px 14px';
  btn.style.fontSize = '12px';
  btn.style.fontWeight = '600';
  btn.style.background = '#2563eb';
  btn.style.color = '#f9fafb';
  btn.style.cursor = disabled ? 'default' : 'pointer';
  btn.style.opacity = disabled ? '0.4' : '1';
}

// DOM 로드 시 초기화
(function () {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initUsageOverlay, 0);
  } else {
    document.addEventListener('DOMContentLoaded', initUsageOverlay);
  }
})();
