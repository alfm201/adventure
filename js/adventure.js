const canvas = document.querySelector('#game_screen');
const _canvas = document.querySelector('#temp_canvas');
const ctx = canvas.getContext('2d');
const _ctx = _canvas.getContext('2d');

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
  drawCanvas(77, (userIndex - 1) * 90, 0, ((userPos - 1) % 10 + 1) * 96 - 96 + 244, parseInt((userPos - 1) / 10) * 96 + 15, 90, 120);
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
const REGION_CARDS = { x1: 423, x2: 635, y1: 643, y2: 679 };
const REGION_CARDINFO = { x1: 229, x2: 479, y1: 15, y2: 615 };
const REGION_BTN_CARDINFO = { x1: 635, x2: 677, y1: 643, y2: 679 };
const REGION_BTN_RESETBOARD = { x1: 690, x2: 780, y1: 642, y2: 680 };
const REGION_BTN_CHANGEMODE = { x1: 788, x2: 878, y1: 642, y2: 680 };
const REGION_BTN_ACCURACY = { x1: 11, x2: 199, y1: 288, y2: 313 };
const REGION_BTN_EXSCORE = { x1: 9, x2: 201, y1: 313, y2: 433 };
const REGION_CHARACTER = { x1: 59, x2: 149, y1: 82, y2: 202 };
const REGION_EXSCORES = { x1: 9, x2: 201, y1: 321, y2: 425 };

function eventCanvasMouseup(e) {
  isDragging = false;
  setTimeout(function () {
    preventClick = false;
  }, 0);
}

function eventCanvasMouseleave(e) {
  isDragging = false;
}

function eventWindowBlur(e) {
  isDragging = false;
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
  }
}

function eventCanvasMousemove(e) {
  let x = e.offsetX;
  let y = e.offsetY;

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

  if (isInsideRegion(x, y, REGION_STEP)) {
    if (env.autoProcess) {
      done = env.step(0);
      calcEx();
      // updateBoard();
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
