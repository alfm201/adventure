const canvas = document.querySelector('#game_screen');
const _canvas = document.querySelector('#temp_canvas');
const ctx = canvas.getContext('2d');
const _ctx = _canvas.getContext('2d');
const CANVAS_LOGICAL_WIDTH = 1234;
const CANVAS_LOGICAL_HEIGHT = 694;
const DICE_OVERLAY_CONFIG = {
  btnWidth: 28,
  btnHeight: 18,
  gapX: 2,
  gapY: 4,
  margin: 0,
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
let exScoreOverviewHoverIndex = -1;
let showDiceOverlay = false;
let diceOverlayHoverIndex = -1;
let uiHoverTarget = '';
let predictionVisualFrame = 0;
let predictionVisualLastAt = 0;
let usagePreviewState = { prediction: '', exScore: false };
let lastCanvasPointer = null;
let regionCurrentCharacter = { x1: 0, y1: 0, x2: 0, y2: 0 };
let computeSettings = {
  engine: 'gpu',
  cpuIteration: 10000,
  cpuWorkers: null,
  cpuUsage: 'medium',
  cpuMaxPct: 500,
  gpuIteration: 100000,
  gpuBatchPct: 50,
  gpuMaxPct: 1000,
  gpuUsage: 'medium',
  gpuLoad: 'medium',
};
let computeModeReady = false;
let pendingInitialCalc = false;

function clampBoardScore(score) {
  return Math.max(1, Math.min(2898, Number(score) || 1));
}
let gpuTablesCache = null;
let gpuDisabledReason = '';
let computePerfStats = { gpu: {}, cpu: {} };
let computePerfBenchmarkRunning = false;
let computePerfBenchmarkId = 0;
let computePerfBenchmarkPromise = null;
let computePerfRecommendations = { gpu: null, cpu: null, engine: null };
let computePerfUiFrame = null;
let computePerfPendingUiKeys = new Set();
let canvasBackingScale = 1;
let responsiveLayoutFrame = null;
let computeModalFitFrame = null;

function getCanvasBackingScale() {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(2, Math.ceil(dpr));
}

function configureCanvasResolution(force = false) {
  const nextScale = getCanvasBackingScale();
  const nextWidth = CANVAS_LOGICAL_WIDTH * nextScale;
  const nextHeight = CANVAS_LOGICAL_HEIGHT * nextScale;
  if (!force && canvasBackingScale === nextScale && canvas.width === nextWidth && canvas.height === nextHeight) {
    return false;
  }

  canvasBackingScale = nextScale;
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  ctx.setTransform(nextScale, 0, 0, nextScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return true;
}

configureCanvasResolution(true);
window.addEventListener('resize', scheduleResponsiveLayoutRefresh);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scheduleResponsiveLayoutRefresh);
}

setup();

function scheduleResponsiveLayoutRefresh() {
  if (responsiveLayoutFrame !== null) return;
  responsiveLayoutFrame = requestAnimationFrame(() => {
    responsiveLayoutFrame = null;
    configureCanvasResolution();
    if (env) updateBoard();
    scheduleComputeModeModalFit();
  });
}

function setup() {
  getBoardInfo();
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const source = e.touches?.[0] || e.changedTouches?.[0] || e;
  const scaleX = CANVAS_LOGICAL_WIDTH / rect.width;
  const scaleY = CANVAS_LOGICAL_HEIGHT / rect.height;

  return {
    x: (source.clientX - rect.left) * scaleX,
    y: (source.clientY - rect.top) * scaleY
  };
}

function rememberCanvasPointer(e) {
  lastCanvasPointer = getCanvasPoint(e);
  return lastCanvasPointer;
}

function getCanvasDisplayScale() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / CANVAS_LOGICAL_WIDTH, rect.height / CANVAS_LOGICAL_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? Math.max(0.35, Math.min(1, scale)) : 1;
}

function applyOverlayCanvasScale(root, scale = getCanvasDisplayScale()) {
  root.style.transform = 'none';
  root.style.transformOrigin = 'top left';
  root.style.zoom = scale < 0.995 ? String(scale) : '';
  return scale;
}

function clampOverlayPosition(preferredLeft, preferredTop, width, height, scale = 1) {
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 694;
  const visualWidth = width * scale;
  const visualHeight = height * scale;
  return {
    left: Math.min(Math.max(12, preferredLeft), Math.max(12, viewportW - visualWidth - 12)),
    top: Math.min(Math.max(12, preferredTop), Math.max(12, viewportH - visualHeight - 12)),
    visualWidth,
    visualHeight,
  };
}

function setZoomedFixedPosition(el, visualLeft, visualTop, zoom = 1) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  el.style.left = `${visualLeft / safeZoom}px`;
  el.style.top = `${visualTop / safeZoom}px`;
}

function getZoomedFixedPosition(el, zoom = 1) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    left: (parseFloat(el.style.left) || 0) * safeZoom,
    top: (parseFloat(el.style.top) || 0) * safeZoom,
  };
}

function getViewportSize() {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 1024,
    height: window.innerHeight || document.documentElement.clientHeight || 694,
  };
}

function fitFixedElementToViewport(el, options = {}) {
  if (!el || !el.isConnected) {
    return { zoom: 1, width: 0, height: 0, visualWidth: 0, visualHeight: 0 };
  }

  const margin = options.margin ?? 16;
  const minZoom = options.minZoom ?? 0.34;
  const viewport = getViewportSize();
  const previousZoom = el.style.zoom;
  el.style.transform = 'none';
  el.style.zoom = '1';
  el.style.maxHeight = 'none';
  el.style.overflow = 'visible';

  const rect = el.getBoundingClientRect();
  const width = Math.max(1, el.offsetWidth || rect.width || 1);
  const height = Math.max(1, el.scrollHeight || el.offsetHeight || rect.height || 1);
  const availableW = Math.max(1, viewport.width - margin * 2);
  const availableH = Math.max(1, viewport.height - margin * 2);
  const zoom = Math.max(minZoom, Math.min(1, availableW / width, availableH / height));

  el.style.zoom = zoom < 0.995 ? String(zoom) : '';
  if (previousZoom !== el.style.zoom && typeof options.onZoomChange === 'function') {
    options.onZoomChange(zoom);
  }

  return {
    zoom,
    width,
    height,
    visualWidth: width * zoom,
    visualHeight: height * zoom,
    viewportW: viewport.width,
    viewportH: viewport.height,
  };
}

function updateLoadingOverlay({ progress, status, detail, step } = {}) {
  let loading = document.getElementById('adventure-loading');
  if (!loading) return;
  let safeProgress = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  let fill = document.getElementById('adventure-loading-fill');
  let percent = document.getElementById('adventure-loading-percent');
  let statusEl = document.getElementById('adventure-loading-status');
  let detailEl = document.getElementById('adventure-loading-detail');
  if (fill) fill.style.width = `${safeProgress}%`;
  if (percent) percent.textContent = `${safeProgress}%`;
  if (status && statusEl) statusEl.textContent = status;
  if (detail && detailEl) detailEl.textContent = detail;
  if (step !== undefined) {
    loading.querySelectorAll('.adventure-loading-step').forEach((el, index) => {
      el.classList.toggle('is-active', index <= step);
    });
  }
}

function imagesPreload() {
  updateLoadingOverlay({
    progress: 6,
    status: '보드 이미지를 불러오고 있습니다.',
    detail: '이미지 0 / 82',
    step: 0,
  });
  let loadedImages = 0;
  let totalImages = 82;
  let started = false;

  async function startAfterImages() {
    if (started) return;
    started = true;
    updateLoadingOverlay({
      progress: 72,
      status: '보드를 초기화하고 있습니다.',
      detail: '이벤트와 상태 정보를 준비하는 중',
      step: 1,
    });
    eventSetup();
    updateLoadingOverlay({
      progress: 82,
      status: '계산 엔진을 점검하고 있습니다.',
      detail: 'GPU 사용 가능 여부를 확인하는 중',
      step: 2,
    });
    await prepareGpuReadbackModeOnLoad();
    updateLoadingOverlay({
      progress: 96,
      status: '계산 방식을 선택할 준비가 끝났습니다.',
      detail: isGpuAvailable() ? 'GPU/CPU 옵션을 준비했습니다.' : 'GPU 점검 실패로 CPU 옵션만 준비했습니다.',
      step: 2,
    });
    showComputeModeModal(() => {
      computeModeReady = true;
      updateLoadingOverlay({
        progress: 100,
        status: '시뮬레이션을 시작합니다.',
        detail: '잠시만 기다려 주세요.',
        step: 2,
      });
      hideLoadingOverlay();
      calcEx();
    });
  }

  function markImageReady() {
    loadedImages += 1;
    let imageProgress = 8 + (loadedImages / totalImages) * 58;
    updateLoadingOverlay({
      progress: imageProgress,
      status: '보드 이미지를 불러오고 있습니다.',
      detail: `이미지 ${loadedImages} / ${totalImages}`,
      step: 0,
    });
    if (loadedImages >= totalImages) startAfterImages();
  }

  for (let i = 1; i <= totalImages; i++) {
    const img = new Image();
    img.onload = markImageReady;
    img.onerror = markImageReady;
    img.src = `./img/${i}.png`;
    backgroundImages.push(img);
  }
  setTimeout(startAfterImages, 5000);
}

async function prepareGpuReadbackModeOnLoad() {
  if (!navigator.gpu || !window.gpuRolloutWorkbench || typeof window.gpuRolloutWorkbench.prepareGpuReadbackMode !== 'function') return;
  try {
    let tables = buildGpuTables();
    await window.gpuRolloutWorkbench.prepareGpuReadbackMode({
      tables,
      sample: { state: new Board().getState(), actionCount: 1 },
      seed: getGpuRandomSeed(),
    });
    let selfTest = await verifyGpuEngineOnLoad(tables);
    if (!selfTest.ok) {
      markGpuUnavailable(selfTest.reason);
    }
  } catch (error) {
    console.warn('GPU readback self-test failed during initial loading.', error);
    markGpuUnavailable(String(error && error.message ? error.message : error));
  }
}

function updateBoard() {
  drawMainScreen();
}

function clearPredictionInteractionState(options = {}) {
  const keepDiceOverlay = options.keepDiceOverlay === true;
  if (!keepDiceOverlay) {
    showDiceOverlay = false;
  }
  diceOverlayHoverIndex = -1;
  showCardPos = -1;
  exScoreOverviewHoverIndex = -1;
  hidePredictionOverlayRoot();
  hideExScoreOverviewRoot();
}

function setPredictionInteractionStateFromPoint(x, y, options = {}) {
  if (!env) return false;
  const shouldUpdate = options.update !== false;
  let changed = false;

  if (isUsageOverlayActive()) {
    const hadHoverState = showDiceOverlay || diceOverlayHoverIndex !== -1 || showCardPos !== -1 || exScoreOverviewHoverIndex !== -1 || uiHoverTarget !== '';
    showDiceOverlay = false;
    diceOverlayHoverIndex = -1;
    showCardPos = -1;
    exScoreOverviewHoverIndex = -1;
    uiHoverTarget = '';
    if (hadHoverState && shouldUpdate) updateBoard();
    return hadHoverState;
  }

  const inStep = isInsideRegion(x, y, REGION_STEP);
  const nextShowDiceOverlay = inStep;
  const nextDiceOverlayHoverIndex = env.autoProcess ? -1 : getDiceOverlayButtonIndex(x, y);
  const nextUiHoverTarget = getUiHoverTarget(x, y);
  const nextExScoreOverviewHoverIndex = isInsideRegion(x, y, REGION_EXSCORES)
    ? Math.max(0, Math.min(5, Math.trunc((y - 321) / (104 / 6))))
    : -1;

  let nextShowCardPos = -1;
  if (isInsideRegion(x, y, REGION_CARDS)) {
    const cardIndex = Math.trunc((x - 422) / 43);
    if (env.cards[cardIndex] !== undefined) {
      nextShowCardPos = cardIndex;
    }
  }

  if (uiHoverTarget !== nextUiHoverTarget) {
    uiHoverTarget = nextUiHoverTarget;
    changed = true;
  }
  if (diceOverlayHoverIndex !== nextDiceOverlayHoverIndex) {
    diceOverlayHoverIndex = nextDiceOverlayHoverIndex;
    changed = true;
  }
  if (showDiceOverlay !== nextShowDiceOverlay) {
    showDiceOverlay = nextShowDiceOverlay;
    changed = true;
  }
  if (exScoreOverviewHoverIndex !== nextExScoreOverviewHoverIndex) {
    exScoreOverviewHoverIndex = nextExScoreOverviewHoverIndex;
    changed = true;
  }
  if (showCardPos !== nextShowCardPos) {
    showCardPos = nextShowCardPos;
    changed = true;
  }

  if (changed && shouldUpdate) updateBoard();
  return changed;
}

function restorePredictionInteractionFromLastPointer(options = {}) {
  if (!lastCanvasPointer) return false;
  return setPredictionInteractionStateFromPoint(lastCanvasPointer.x, lastCanvasPointer.y, options);
}

function isUsageOverlayActive() {
  return Boolean(document.getElementById('adventure-usage-root'));
}

function setUsagePreviewState(nextState = {}) {
  const nextPrediction = nextState.prediction || '';
  const nextExScore = nextState.exScore === true;
  if (usagePreviewState.prediction === nextPrediction && usagePreviewState.exScore === nextExScore) return;

  usagePreviewState = { prediction: nextPrediction, exScore: nextExScore };
  if (!nextPrediction) hidePredictionOverlayRoot();
  if (!nextExScore) hideExScoreOverviewRoot();
  updateBoard();
}

function clearUsagePreviewState() {
  setUsagePreviewState({ prediction: '', exScore: false });
}

function drawMainScreen() {
  let stageIndex = stage[env.score - 1][1];
  ctx.fillStyle = 'white';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);
  drawBackground(stageIndex);
  drawEvents(stageIndex);
  drawCounter();
  drawUsers();
  maxScore = env.score > maxScore ? env.score : maxScore;
  drawStatusBar();
  drawExScores();
  renderExScoreOverviewRoot();
  drawPreviewPosition();
  drawPersistentDiceDestinationPulses();
  drawDiceOverlay();
  drawPredictionVisuals();
  if (showCardInfoYN) drawCardInfo();
}

function drawExScores() {
  if (isExScoreHighlighted(0)) {
    drawText(`주사위: ${formatValue(env.exScores[0])}`, 14, 328, 'red', 14, 'left');
  } else {
    drawText(`주사위: ${formatValue(env.exScores[0])}`, 14, 328, 'black', 14, 'left');
  }
  for (let i = 0; i < 5; i++) {
    if (isExScoreHighlighted(i + 1)) {
      drawText(`${i + 1}번카드: ${formatValue(env.exScores[i + 1])}`, 14, 346 + i * 18, 'red', 14, 'left');
    } else {
      drawText(`${i + 1}번카드: ${formatValue(env.exScores[i + 1])}`, 14, 346 + i * 18, 'black', 14, 'left');
    }
  }
}

function isExScoreHighlighted(action) {
  if (env.exHighlights) {
    return env.exHighlights[action];
  }
  return env.exScores[action] >= env.exScore;
}

function ensureExScoreOverviewRoot() {
  let root = document.getElementById('adventure-exscore-overview');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'adventure-exscore-overview';
  root.style.cssText = [
    'position:fixed',
    'z-index:9001',
    'display:none',
    'pointer-events:none',
    'box-sizing:border-box',
    'max-width:calc(100vw - 24px)',
    'padding:10px',
    'border:1px solid rgba(15,23,42,.18)',
    'border-radius:8px',
    'background:rgba(255,255,255,.97)',
    'box-shadow:0 18px 45px rgba(15,23,42,.26)',
    'font:12px Arial,"Malgun Gothic",sans-serif',
    'color:#0f172a'
  ].join(';');
  document.body.appendChild(root);
  return root;
}

function hideExScoreOverviewRoot() {
  const root = document.getElementById('adventure-exscore-overview');
  if (root) root.style.display = 'none';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getExScoreActionLabel(action) {
  if (action === 0) return '주사위';
  const card = env.cards[action - 1];
  if (!card) return `${action}번 카드`;
  const cardName = userCardInfo[card[0] - 1]?.[1] || '행운 카드';
  return `${action}번 카드 · ${cardName}`;
}

function isExScoreActionAvailable(action) {
  return action === 0 || env.cards[action - 1] !== undefined;
}

function formatExScoreOverviewNumber(value, formatter = formatValue) {
  return typeof value === 'number' && isFinite(value) ? formatter(value) : '-';
}

function getExScoreOverviewStatus(action) {
  if (!isExScoreActionAvailable(action)) return { text: '비어 있음', color: '#64748b', bg: '#f1f5f9' };
  if (env.exAction === action) return { text: '추천', color: '#b91c1c', bg: '#fee2e2' };
  if (isExScoreHighlighted(action)) return { text: '근접', color: '#047857', bg: '#d1fae5' };

  const raw = env.exValues?.status?.[action];
  if (raw === '계산중') return { text: '계산중', color: '#2563eb', bg: '#dbeafe' };
  if (raw === 'error') return { text: '오류', color: '#b91c1c', bg: '#fee2e2' };
  if (raw === 'pruned' || raw === '제외') return { text: '제외', color: '#64748b', bg: '#f1f5f9' };
  if (raw === 'active' || raw === '후보') return { text: '후보', color: '#1d4ed8', bg: '#dbeafe' };
  return { text: '-', color: '#64748b', bg: '#f8fafc' };
}

function getExScoreOverviewLegendHtml() {
  return [
    '<span><strong style="color:#b91c1c;">추천</strong>: 현재 평균이 가장 높은 선택</span>',
    '<span><strong style="color:#047857;">근접</strong>: 추천과 차이가 작아 아직 우열이 애매한 선택</span>',
    '<span><strong style="color:#1d4ed8;">후보</strong>: 추천은 아니지만 아직 제외되지 않은 선택</span>'
  ].join('<span style="color:#cbd5e1;"> | </span>');
}

function getExScoreOverviewRowStyle(statusText, available) {
  if (statusText === '추천') return { bg: '#fff1f2', border: '#fb7185' };
  if (statusText === '근접') return { bg: '#ecfdf5', border: '#34d399' };
  if (statusText === '후보') return { bg: '#eff6ff', border: '#60a5fa' };
  if (statusText === '계산중') return { bg: '#f8fafc', border: '#93c5fd' };
  return { bg: available ? '#ffffff' : '#f8fafc', border: '#e2e8f0' };
}

function renderExScoreOverviewRoot() {
  if (exScoreOverviewHoverIndex < 0 && !usagePreviewState.exScore) {
    hideExScoreOverviewRoot();
    return;
  }
  if (hasAdventureBlockingDomOverlay({ includeUsage: false })) {
    hideExScoreOverviewRoot();
    return;
  }

  const root = ensureExScoreOverviewRoot();
  const values = env.exValues || {};
  const rows = [];
  for (let action = 0; action < 6; action++) {
    const available = isExScoreActionAvailable(action);
    const status = getExScoreOverviewStatus(action);
    const count = available ? formatCountValue(values.count?.[action] || 0) : '-';
    const min = available ? formatIntegerValue(values.min?.[action] || 0) : '-';
    const max = available ? formatIntegerValue(values.max?.[action] || 0) : '-';
    const range = available ? `${min} ~ ${max}` : '-';
    const mid = available ? formatIntegerValue(values.mid?.[action] || 0) : '-';
    const ci = available ? formatConfidenceInterval(env.exScores[action], values.se?.[action]) : '-';
    const gap = available ? formatExScoreOverviewNumber(values.gap?.[action], formatValue) : '-';
    const rowStyle = getExScoreOverviewRowStyle(status.text, available);
    rows.push(`
      <tr style="background:${rowStyle.bg};">
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;font-weight:700;color:#0f172a;white-space:nowrap;">${escapeHtml(getExScoreActionLabel(action))}</td>
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;text-align:right;white-space:nowrap;">${escapeHtml(mid)}</td>
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;text-align:right;white-space:nowrap;">${escapeHtml(range)}</td>
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;text-align:right;white-space:nowrap;">${escapeHtml(ci)}</td>
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;text-align:right;white-space:nowrap;">${escapeHtml(count)}</td>
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;text-align:right;white-space:nowrap;">${escapeHtml(gap)}</td>
        <td style="border-top:1px solid ${rowStyle.border};padding:6px 8px;text-align:center;white-space:nowrap;">
          <span style="display:inline-block;border-radius:999px;padding:2px 7px;background:${status.bg};color:${status.color};font-weight:700;">${escapeHtml(status.text)}</span>
        </td>
      </tr>
    `);
  }

  root.style.width = 'min(680px, calc(100vw - 24px))';
  root.style.zIndex = isUsageOverlayActive() ? '10000' : '9001';
  root.style.borderColor = isUsageOverlayActive() ? '#38bdf8' : 'rgba(15,23,42,.18)';
  root.style.boxShadow = isUsageOverlayActive()
    ? '0 0 0 4px rgba(56, 189, 248, 0.35), 0 18px 45px rgba(15,23,42,.26)'
    : '0 18px 45px rgba(15,23,42,.26)';
  root.style.display = 'block';
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:5px;">
      <div style="font-weight:800;font-size:13px;">예상 점수 전체 비교</div>
      <div style="color:#64748b;font-size:11px;">6개 case</div>
    </div>
    <div style="font-size:11px;line-height:1.45;color:#334155;margin-bottom:7px;">${getExScoreOverviewLegendHtml()}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:auto;">
      <thead>
        <tr style="color:#475569;background:#f8fafc;">
          <th style="padding:5px 8px;text-align:left;font-weight:700;">case</th>
          <th style="padding:5px 8px;text-align:right;font-weight:700;">중앙값</th>
          <th style="padding:5px 8px;text-align:right;font-weight:700;">범위</th>
          <th style="padding:5px 8px;text-align:right;font-weight:700;">95% CI</th>
          <th style="padding:5px 8px;text-align:right;font-weight:700;">샘플</th>
          <th style="padding:5px 8px;text-align:right;font-weight:700;">추천차</th>
          <th style="padding:5px 8px;text-align:center;font-weight:700;">상태</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;

  positionExScoreOverviewRoot(root);
}

function positionExScoreOverviewRoot(root) {
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / CANVAS_LOGICAL_WIDTH;
  const scaleY = canvasRect.height / CANVAS_LOGICAL_HEIGHT;
  const overlayScale = applyOverlayCanvasScale(root);
  const width = root.offsetWidth || 760;
  const height = root.offsetHeight || 240;
  const visualHeight = height * overlayScale;
  const targetCenterY = canvasRect.top + ((REGION_BTN_EXSCORE.y1 + REGION_BTN_EXSCORE.y2) / 2) * scaleY;
  const preferredLeft = canvasRect.left + REGION_BTN_EXSCORE.x2 * scaleX + 12;
  const preferredTop = targetCenterY - visualHeight / 2;
  const position = clampOverlayPosition(preferredLeft, preferredTop, width, height, overlayScale);

  setZoomedFixedPosition(root, position.left, position.top, overlayScale);
}

function formatValue(value) {
  if (typeof value === 'number') {
    return value.toFixed(3) + '점';
  } else {
    return value;
  }
}

function drawCardPos(moveValue) {
  const targetScore = clampBoardScore(env.score + moveValue);
  if (stage[env.score - 1][1] === stage[targetScore - 1][1]) {
    drawCanvas(79, 2, 923, ((stage[targetScore - 1][6] - 1) % 10) * 96 + 244, parseInt((stage[targetScore - 1][6] - 1) / 10) * 96 + 60, 92, 92);
  }
}

function drawPreviewPosition() {
  if (!env.autoProcess && isDraggingCharacter && characterDragTargetScore !== null && characterDragTargetScore !== env.score) {
    drawCardPos(characterDragTargetScore - env.score);
    return;
  }

  if (!env.autoProcess && diceOverlayHoverIndex >= 0) {
    let value = diceOverlayHoverIndex + 2;
    let destScore = getStopDestinationScore(env.score, value);
    drawCardPos(destScore - env.score);
    return;
  }

  if (showCardPos >= 0) {
    let card = env.cards[showCardPos];
    if (card && card[1] === 1) {
      drawCardPos(card[2]);
    }
  }
}

function drawPersistentDiceDestinationPulses() {
  if (!shouldDrawPersistentDicePrediction()) return;

  const currentStageId = stage[env.score - 1][1];
  const outcomes = new Map();

  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const dest = getPredictionLanding(env.score, a + b, true);
      if (getStageRowByScore(dest.score)[1] !== currentStageId) continue;
      const key = dest.score;
      if (!outcomes.has(key)) {
        outcomes.set(key, { dest, count: 0 });
      }
      outcomes.get(key).count++;
    }
  }

  outcomes.forEach(item => {
    const rect = getPredictionCellRect(item.dest.score);
    if (!rect || rect.stageId !== currentStageId) return;
    const pulseBounds = getCurrentStagePulseBounds(rect);
    drawPredictionPulse(ctx, pulseBounds.x, pulseBounds.y, pulseBounds.w, pulseBounds.h, false, 'dice');
    if (!showDiceOverlay) {
      drawPredictionPill(ctx, getPredictionPct(item.count, 36), rect.x + rect.w / 2, rect.y + 18, item.dest.className, false);
    }
  });

  startPredictionVisualAnimation();
}

function hasAdventureBlockingDomOverlay(options = {}) {
  const includeUsage = options.includeUsage !== false;
  return Boolean(
    document.getElementById('adventure-compute-modal') ||
    (includeUsage && document.getElementById('adventure-usage-root'))
  );
}

function shouldDrawPersistentDicePrediction() {
  return !(
    showDiceOverlay ||
    showCardPos >= 0 ||
    exScoreOverviewHoverIndex >= 0 ||
    isDragging ||
    isDraggingCharacter ||
    hasAdventureBlockingDomOverlay({ includeUsage: false })
  );
}

function drawBackground(index) {
  _ctx.clearRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);
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
  drawText('주사위 이동', 105, 451, 'white', 12, 'center');
  drawRadiusRect(x = 9, y = 525, width = 192, height = 97, radius = 18, opacity = 1, color = 'white');
  if (env.isDouble) {
    drawRadiusRect(x = 15, y = 531, width = 180, height = 85, radius = 10, opacity = 1, color = 'rgb(56, 123, 214)', 'rgb(121, 238, 199)');
  } else {
    drawRadiusRect(x = 15, y = 531, width = 180, height = 85, radius = 10, opacity = 1, color = 'rgb(255, 138, 44)', 'rgb(255, 225, 110)');
  }
  drawRadiusRect(x = 20, y = 536, width = 170, height = 16, radius = 4, opacity = 0.15, color = 'white');
  if (uiHoverTarget === 'diceRoll') {
    drawHoverFrame(REGION_STEP.x1, REGION_STEP.y1, REGION_STEP.x2 - REGION_STEP.x1, REGION_STEP.y2 - REGION_STEP.y1, 18);
  }
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
  if (uiHoverTarget === 'cardInfo') {
    drawIconHoverGlow(638, 638, 46, 46, 12);
  }
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
  drawBtn(btnText = '재시작', x = 690, y = 642, width = 90, height = 38, radius = 12, opacity = 1, lineColor = 'rgb(53, 79, 108)', fillColor = 'rgb(45, 137, 195)', textColor = 'white', fontSize = 12, hover = uiHoverTarget === 'reset');
  drawBtn(btnText = '모드변경', x = 788, y = 642, width = 90, height = 38, radius = 12, opacity = 1, lineColor = 'rgb(53, 79, 108)', fillColor = 'rgb(45, 137, 195)', textColor = 'white', fontSize = 12, hover = uiHoverTarget === 'mode');
  drawBtn(btnText = '도움말', x = 886, y = 642, width = 90, height = 38, radius = 12, opacity = 1, lineColor = 'rgb(53, 79, 108)', fillColor = 'rgb(45, 137, 195)', textColor = 'white', fontSize = 12, hover = uiHoverTarget === 'help');
  if (uiHoverTarget === 'prevStage') {
    drawIconHoverGlow(1103, 637, 60, 48, 16);
  }
  if (uiHoverTarget === 'nextStage') {
    drawIconHoverGlow(1167, 637, 60, 48, 16);
  }
  ctx.drawImage(backgroundImages[81], 0, 0, 54, 44, 1106, 639, 54, 44);
  ctx.drawImage(backgroundImages[81], 54, 0, 54, 44, 1170, 639, 54, 44);
}

function drawDiceOverlay() {
  const rect = getDiceOverlayRect();
  if (!rect) return;

  const cfg = DICE_OVERLAY_CONFIG;
  const baseY = rect[0].y1;

  for (let i = 0; i < 11; i++) {
    const value = i + 2;
    const pos = getDiceOverlayButtonPosition(i, rect, cfg);
    const x = pos.x;
    const y = pos.y;

    const disabled = env.autoProcess;
    const isHover = !disabled && (diceOverlayHoverIndex === i);

    const lineColor = disabled ? 'rgb(115, 126, 143)' : (isHover ? 'rgb(255, 238, 155)' : 'rgb(60, 86, 120)');
    const fillColor = disabled ? 'rgb(148, 163, 184)' : (isHover ? 'rgb(255, 170, 80)'  : 'rgb(70, 160, 220)');
    const textColor = disabled ? 'rgba(255,255,255,0.62)' : 'white';

    drawDiceMoveButton(`+${value}`, x, y, cfg.btnWidth, cfg.btnHeight, lineColor, fillColor, textColor, disabled, isHover);
  }
}

function getDiceOverlayRect() {
  if (!REGION_DICE_MOVE) return null;
  const cfg = DICE_OVERLAY_CONFIG;

  const row1Width = 6 * cfg.btnWidth + 5 * cfg.gapX;
  const row2Width = 5 * cfg.btnWidth + 4 * cfg.gapX;
  const x1 = REGION_DICE_MOVE.x1 + Math.floor((REGION_DICE_MOVE.x2 - REGION_DICE_MOVE.x1 - row1Width) / 2);
  const y1 = REGION_DICE_MOVE.y1 + 7;
  const w1  = row1Width;
  const h1 = cfg.btnHeight;
  
  const x2 = x1;
  const y2 = y1 + cfg.btnHeight + cfg.gapY;
  const w2  = row2Width;
  const h2 = cfg.btnHeight;
  
  return [
    { x1: x1, x2: x1 + w1, y1: y1, y2: y1 + h1 },
    { x1: x2, x2: x2 + w2, y1: y2, y2: y2 + h2 },
    REGION_DICE_MOVE
  ];
}

function getDiceOverlayButtonIndex(x, y) {
  const r = getDiceOverlayRect();
  if (!r) return -1;

  const cfg = DICE_OVERLAY_CONFIG;
  for (let i = 0; i < 11; i++) {
    const pos = getDiceOverlayButtonPosition(i, r, cfg);
    const btnX = pos.x;
    const btnY = pos.y;
    if (x >= btnX && x <= btnX + cfg.btnWidth && y >= btnY && y <= btnY + cfg.btnHeight) {
      return i;
    }
  }

  return -1;
}

function getDiceOverlayButtonPosition(index, rect, cfg) {
  const row = Math.floor(index / 6);
  const col = index % 6;
  const rowRect = row === 0 ? rect[0] : rect[1];
  return {
    x: rowRect.x1 + col * (cfg.btnWidth + cfg.gapX),
    y: rowRect.y1
  };
}

function getStageRowByScore(score) {
  return stage[Math.max(0, Math.min(2897, score - 1))] || [];
}

function getPredictionEventName(type) {
  if (type === 2) return '카드칸';
  if (type === 4) return '점프칸';
  if (type === 6 || type === 9) return '멈춤칸';
  return '일반칸';
}

function getPredictionClass(type, jumpTotal, stopActive = true) {
  if (stopActive && (type === 6 || type === 9)) return 'stop';
  if (type === 2) return 'card';
  if (jumpTotal > 0 || type === 4) return 'jump';
  return 'plain';
}

function getPredictionColor(kind) {
  if (kind === 'card') return '#7c3aed';
  if (kind === 'jump') return '#f97316';
  if (kind === 'stop') return '#dc2626';
  return '#475569';
}

function getPredictionPulseRgb(pulseKind) {
  return pulseKind === 'fixed' ? '250,204,21' : '236,72,153';
}

function getPredictionPct(count, denom) {
  if (!denom) return '0%';
  let value = count * 100 / denom;
  return value >= 10 ? `${Math.round(value)}%` : `${value.toFixed(1)}%`;
}

function getPredictionAverageDelta(analysis) {
  const outcomes = analysis?.outcomes || [];
  let totalWeight = 0;
  let totalDelta = 0;
  outcomes.forEach(item => {
    const weight = Number(item.count) || 0;
    totalWeight += weight;
    totalDelta += (Number(item.score) - env.score) * weight;
  });
  return totalWeight > 0 ? totalDelta / totalWeight : 0;
}

function formatPredictionAverageDelta(value) {
  const rounded = Math.round(value * 10) / 10;
  const absText = Number.isInteger(Math.abs(rounded)) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  return `${rounded > 0 ? '+' : rounded < 0 ? '-' : '±'}${absText}칸`;
}

function getPredictionAverageDeltaColor(value) {
  if (value > 0.05) return '#047857';
  if (value < -0.05) return '#dc2626';
  return '#475569';
}

function getPredictionActionDiceUseDelta(usesRandom) {
  return usesRandom && !env.isDouble ? 1 : 0;
}

function getPredictionRatioDelta(analysis) {
  const currentDiceUse = Number(env.diceUse) || 0;
  const nextDiceUse = currentDiceUse + (Number(analysis?.diceUseDelta) || 0);
  if (nextDiceUse <= 0) return null;

  const outcomes = analysis?.outcomes || [];
  let totalWeight = 0;
  let totalRatio = 0;
  outcomes.forEach(item => {
    const weight = Number(item.count) || 0;
    totalWeight += weight;
    totalRatio += (Number(item.score) / nextDiceUse) * weight;
  });
  if (totalWeight <= 0) return null;

  const currentRatio = currentDiceUse > 0 ? env.score / currentDiceUse : 0;
  return totalRatio / totalWeight - currentRatio;
}

function formatPredictionRatioDelta(value) {
  if (value === null || value === undefined || !isFinite(value)) return '-';
  const absText = Math.abs(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return `${value > 0 ? '+' : value < 0 ? '-' : '±'}${absText}`;
}

function getPredictionCellRect(score, mini = false) {
  const row = getStageRowByScore(score);
  const pos = row[6];
  if (!pos) return null;
  return {
    x: ((pos - 1) % 10) * 96 + (mini ? 34 : 244),
    y: Math.floor((pos - 1) / 10) * 96 + 60,
    w: 92,
    h: 92,
    stageId: row[1],
    localPos: pos
  };
}

function getCurrentStagePulseBounds(rect) {
  const inset = 4;
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    w: rect.w - inset * 2,
    h: rect.h - inset * 2
  };
}

function getPredictionLanding(startScore, move, stop) {
  let used = move;
  if (stop) {
    const endIndex = Math.min(2897, startScore + move - 1);
    for (let i = startScore; i < endIndex; i++) {
      if (stage[i][5] === 6 || stage[i][5] === 9) {
        used = i - startScore + 1;
        break;
      }
    }
  }

  let score = clampBoardScore(startScore + used);
  let jumpTotal = 0;
  for (let guard = 0; guard < 10; guard++) {
    const eventType = getStageRowByScore(score)[5] || 0;
    if (eventType !== 4) break;
    const jump = getStageRowByScore(score)[4] || 0;
    jumpTotal += jump;
    score = clampBoardScore(score + jump);
  }

  const eventType = getStageRowByScore(score)[5] || 0;
  const activeEventType = (!stop && (eventType === 6 || eventType === 9)) ? 0 : eventType;
  return {
    score,
    used,
    eventType: activeEventType,
    rawEventType: eventType,
    eventName: getPredictionEventName(activeEventType),
    jumpTotal,
    className: getPredictionClass(activeEventType, jumpTotal, stop)
  };
}

function getPredictionStageMove(delta) {
  const targetStage = getStageRowByScore(env.score)[1] + delta;
  for (let i = env.score, len = stage.length - 1; i < len; i++) {
    if (stage[i][1] === targetStage) {
      return i - env.score + 1;
    }
  }
  return targetStage;
}

function addPredictionOutcome(map, dest, count, denom, pulseKind, label) {
  const key = dest.score;
  if (!map.has(key)) {
    map.set(key, {
      score: dest.score,
      count: 0,
      denom,
      dest,
      pulseKind,
      labels: []
    });
  }

  const item = map.get(key);
  item.count += count;
  item.pulseKind = item.pulseKind === 'fixed' ? item.pulseKind : pulseKind;
  if (label) item.labels.push(label);
}

function getPredictionDiceAnalysis(multiplier, stop, title) {
  const outcomes = new Map();
  const stats = { card: 0, jump: 0, stop: 0 };

  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const sum = a + b;
      const dest = getPredictionLanding(env.score, sum * multiplier, stop);
      if (dest.eventType === 2) stats.card++;
      if (dest.jumpTotal > 0) stats.jump++;
      if (dest.eventType === 6 || dest.eventType === 9) stats.stop++;
      addPredictionOutcome(outcomes, dest, 1, 36, 'dice', `+${sum}`);
    }
  }

  return {
    title,
    kind: 'dice',
    diceUseDelta: getPredictionActionDiceUseDelta(true),
    outcomes: Array.from(outcomes.values()).sort((a, b) => a.score - b.score),
    stats
  };
}

function getFirstAvailableCardIndex() {
  for (let i = 0; i < 5; i++) {
    if (env.cards[i] !== undefined) return i;
  }
  return -1;
}

function getPredictionCardAnalysis(cardIndex) {
  const card = env.cards[cardIndex];
  if (!card) return null;

  const cardName = userCardInfo[card[0] - 1]?.[1] || '행운 카드';
  if (card[1] === 2) {
    const analysis = getPredictionDiceAnalysis(card[2], false, `${cardIndex + 1}번 카드: ${cardName}`);
    analysis.anchorCardIndex = cardIndex;
    return analysis;
  }

  const move = card[1] === 3 ? getPredictionStageMove(card[2]) : card[2];
  const dest = getPredictionLanding(env.score, move, false);
  const stats = {
    card: dest.eventType === 2 ? 1 : 0,
    jump: dest.jumpTotal > 0 ? 1 : 0,
    stop: (dest.eventType === 6 || dest.eventType === 9) ? 1 : 0
  };
  const item = {
    score: dest.score,
    count: 1,
    denom: 1,
    dest,
    pulseKind: 'fixed',
    labels: [card[1] === 3 ? '스테이지 이동' : `${move > 0 ? '+' : ''}${move}칸`]
  };

  return {
    title: `${cardIndex + 1}번 카드: ${cardName}`,
    kind: 'fixed',
    diceUseDelta: getPredictionActionDiceUseDelta(false),
    anchorCardIndex: cardIndex,
    outcomes: [item],
    stats
  };
}

function getActivePredictionAnalysis() {
  if (usagePreviewState.prediction === 'dice') {
    return getPredictionDiceAnalysis(1, true, '주사위 굴리기');
  }
  if (usagePreviewState.prediction === 'card') {
    const cardIndex = getFirstAvailableCardIndex();
    return cardIndex >= 0 ? getPredictionCardAnalysis(cardIndex) : null;
  }
  if (showDiceOverlay) {
    return getPredictionDiceAnalysis(1, true, '주사위 굴리기');
  }
  if (showCardPos >= 0) {
    return getPredictionCardAnalysis(showCardPos);
  }
  return null;
}

function drawPredictionRoundRect(ctxLike, x, y, width, height, radius) {
  ctxLike.beginPath();
  ctxLike.moveTo(x + radius, y);
  ctxLike.lineTo(x + width - radius, y);
  ctxLike.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctxLike.lineTo(x + width, y + height - radius);
  ctxLike.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctxLike.lineTo(x + radius, y + height);
  ctxLike.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctxLike.lineTo(x, y + radius);
  ctxLike.quadraticCurveTo(x, y, x + radius, y);
  ctxLike.closePath();
}

function drawPredictionPulse(ctxLike, x, y, width, height, small, pulseKind) {
  const phase = (performance.now() % 1200) / 1200;
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const rgb = getPredictionPulseRgb(pulseKind);
  const inset = small ? 1.2 : 2.4;
  const radius = small ? 5 : 10;

  ctxLike.save();
  ctxLike.shadowColor = `rgba(${rgb},${0.34 + pulse * 0.26})`;
  ctxLike.shadowBlur = small ? 7 + pulse * 8 : 14 + pulse * 16;
  ctxLike.fillStyle = `rgba(${rgb},${0.08 + pulse * 0.06})`;
  drawPredictionRoundRect(ctxLike, x + inset, y + inset, width - inset * 2, height - inset * 2, radius);
  ctxLike.fill();
  ctxLike.lineWidth = small ? 2 + pulse * 0.8 : 4 + pulse * 1.2;
  ctxLike.strokeStyle = `rgba(${rgb},${0.82 + pulse * 0.14})`;
  drawPredictionRoundRect(ctxLike, x + inset, y + inset, width - inset * 2, height - inset * 2, radius);
  ctxLike.stroke();
  ctxLike.restore();
}

function drawPredictionPill(ctxLike, text, x, y, kind, small, bounds, textSize) {
  ctxLike.save();
  const fontSize = textSize || (small ? 10.5 : 18);
  ctxLike.font = `normal ${small ? 700 : 'bold'} ${fontSize}px Arial`;
  ctxLike.textAlign = 'center';
  ctxLike.textBaseline = 'middle';
  const padX = small ? Math.max(2.5, fontSize * 0.32) : 10;
  const height = small ? Math.max(13, fontSize + 5) : 30;
  const width = Math.max(small ? Math.max(24, fontSize * 2.75) : 58, ctxLike.measureText(text).width + padX * 2);
  const safeBounds = bounds || { x: 210, y: 0, w: 1024, h: 694 };
  const left = Math.max(safeBounds.x + 4, Math.min(safeBounds.x + safeBounds.w - width - 4, x - width / 2));
  const top = Math.max(safeBounds.y + 4, Math.min(safeBounds.y + safeBounds.h - height - 4, y - height / 2));

  ctxLike.shadowColor = 'rgba(0,0,0,.72)';
  ctxLike.shadowBlur = small ? 3 : 8;
  ctxLike.globalAlpha = 0.97;
  ctxLike.fillStyle = getPredictionColor(kind);
  drawPredictionRoundRect(ctxLike, left, top, width, height, small ? 5 : 8);
  ctxLike.fill();
  ctxLike.shadowBlur = 0;
  ctxLike.lineWidth = small ? Math.max(0.7, Math.min(1, fontSize * 0.08)) : 2.5;
  ctxLike.strokeStyle = 'rgba(255,255,255,.9)';
  ctxLike.stroke();
  ctxLike.fillStyle = 'white';
  ctxLike.strokeStyle = 'rgba(0,0,0,.9)';
  ctxLike.lineWidth = small ? Math.max(0.75, Math.min(1.15, fontSize * 0.1)) : 3;
  ctxLike.strokeText(text, left + width / 2, top + height / 2 + (small ? 0.5 : 1));
  ctxLike.fillText(text, left + width / 2, top + height / 2 + (small ? 0.5 : 1));
  ctxLike.restore();
}

function drawPredictionOnCurrentStage(analysis) {
  const currentStageId = getStageRowByScore(env.score)[1];
  analysis.outcomes.forEach(item => {
    const rect = getPredictionCellRect(item.score);
    if (!rect || rect.stageId !== currentStageId) return;
    const text = item.denom === 1 ? '확정' : getPredictionPct(item.count, item.denom);
    const pulseBounds = getCurrentStagePulseBounds(rect);
    drawPredictionPulse(ctx, pulseBounds.x, pulseBounds.y, pulseBounds.w, pulseBounds.h, false, item.pulseKind);
    drawPredictionPill(ctx, text, rect.x + rect.w / 2, rect.y + 18, item.dest.className, false);
  });
}

function drawPredictionStageEvents(ctxLike, stageId, ox, oy, scale) {
  const eventSprite = backgroundImages[75];
  for (const row of stage) {
    if (row[1] !== stageId) continue;
    const eventId = row[3];
    const eventPos = row[6];
    const moveValue = row[4];
    if (!eventPos) continue;
    const sx = ((eventPos - 1) % 10) * 96 + 34;
    const sy = Math.floor((eventPos - 1) / 10) * 96;
    if (eventId && eventSprite) {
      ctxLike.drawImage(
        eventSprite,
        ((eventId - 1) % 11) * 89,
        Math.floor((eventId - 1) / 11) * 89,
        89,
        89,
        ox + sx * scale,
        oy + (sy + 36) * scale,
        89 * scale,
        89 * scale
      );
    }
    if (moveValue) {
      ctxLike.save();
      ctxLike.fillStyle = 'white';
      ctxLike.strokeStyle = moveValue > 0 ? '#2563eb' : '#dc2626';
      const fontSize = Math.max(8, 44 * scale);
      ctxLike.font = `normal 700 ${fontSize}px Arial`;
      ctxLike.lineWidth = Math.max(0.75, Math.min(1.15, 1.9 * scale));
      ctxLike.textAlign = 'left';
      ctxLike.textBaseline = 'alphabetic';
      const text = moveValue > 0 ? `+${moveValue}` : String(moveValue);
      ctxLike.strokeText(text, ox + sx * scale, oy + (sy + 106) * scale);
      ctxLike.fillText(text, ox + sx * scale, oy + (sy + 106) * scale);
      ctxLike.restore();
    }
  }
}

function ensurePredictionOverlayRoot() {
  let root = document.getElementById('adventure-prediction-overlay');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'adventure-prediction-overlay';
  root.style.cssText = [
    'position:fixed',
    'z-index:9000',
    'display:none',
    'pointer-events:none',
    'box-sizing:border-box',
    'max-width:calc(100vw - 24px)',
    'max-height:calc(100vh - 24px)',
    'max-height:calc(100dvh - 24px)',
    'overflow:auto',
    'padding:10px',
    'border:1px solid rgba(15,23,42,.2)',
    'border-radius:8px',
    'background:rgba(255,255,255,.95)',
    'box-shadow:0 18px 45px rgba(15,23,42,.28)',
    'font:12px Arial,"Malgun Gothic",sans-serif',
    'color:#0f172a'
  ].join(';');
  document.body.appendChild(root);
  return root;
}

function hidePredictionOverlayRoot() {
  const root = document.getElementById('adventure-prediction-overlay');
  if (root) root.style.display = 'none';
}

function getPredictionOffStageOutcomes(analysis) {
  const currentStageId = getStageRowByScore(env.score)[1];
  return analysis.outcomes.filter(item => getStageRowByScore(item.score)[1] !== currentStageId);
}

function getPredictionOverlayCardIndex(analysis) {
  if (showCardPos >= 0) return showCardPos;
  return typeof analysis?.anchorCardIndex === 'number' ? analysis.anchorCardIndex : -1;
}

function getPredictionOverlayTargetBottom(canvasRect, scaleY, analysis) {
  if (getPredictionOverlayCardIndex(analysis) >= 0) {
    return canvasRect.top + (REGION_CARDS.y1 - 8) * scaleY;
  }
  return canvasRect.top + REGION_STEP.y2 * scaleY;
}

function positionPredictionOverlay(root, hasOffStage, analysis) {
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / CANVAS_LOGICAL_WIDTH;
  const scaleY = canvasRect.height / CANVAS_LOGICAL_HEIGHT;
  const overlayScale = applyOverlayCanvasScale(root);
  const width = root.offsetWidth || (hasOffStage ? 640 : 220);
  const height = root.offsetHeight || 120;
  const visualWidth = width * overlayScale;
  const visualHeight = height * overlayScale;
  let preferredLeft;
  let preferredTop;

  const cardIndex = getPredictionOverlayCardIndex(analysis);
  if (cardIndex >= 0) {
    const cardCenterX = canvasRect.left + (423 + cardIndex * 44 + 18) * scaleX;
    const targetBottom = getPredictionOverlayTargetBottom(canvasRect, scaleY, analysis);
    preferredLeft = cardCenterX - visualWidth / 2;
    preferredTop = targetBottom - visualHeight;
  } else {
    const targetCenterY = canvasRect.top + ((REGION_STEP.y1 + REGION_STEP.y2) / 2) * scaleY;
    preferredLeft = canvasRect.left + REGION_STEP.x2 * scaleX + 12;
    preferredTop = targetCenterY - visualHeight / 2;
  }
  const position = clampOverlayPosition(preferredLeft, preferredTop, width, height, overlayScale);

  setZoomedFixedPosition(root, position.left, position.top, overlayScale);
}

function renderPredictionOverlayRoot(analysis) {
  const root = ensurePredictionOverlayRoot();
  const offStage = getPredictionOffStageOutcomes(analysis);
  const hasOffStage = offStage.length > 0;
  const denom = analysis.kind === 'fixed' ? 1 : 36;
  const stats = analysis.stats || { card: 0, jump: 0, stop: 0 };
  const averageDelta = getPredictionAverageDelta(analysis);
  const averageDeltaColor = getPredictionAverageDeltaColor(averageDelta);
  const averageDeltaText = formatPredictionAverageDelta(averageDelta);
  const ratioDelta = getPredictionRatioDelta(analysis);
  const ratioDeltaColor = ratioDelta === null ? '#64748b' : getPredictionAverageDeltaColor(ratioDelta);
  const ratioDeltaText = formatPredictionRatioDelta(ratioDelta);
  const stageIds = Array.from(new Set(offStage.map(item => getStageRowByScore(item.score)[1]))).sort((a, b) => a - b);
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 694;
  const canvasRect = canvas.getBoundingClientRect();
  const scaleY = canvasRect.height / CANVAS_LOGICAL_HEIGHT;
  const miniBackingScale = getCanvasBackingScale();
  const gap = 10;
  const chromeW = 24 + gap * Math.max(0, stageIds.length - 1);
  const summaryH = 96;
  const mapChromeH = 128;
  const anchoredH = stageIds.length
    ? getPredictionOverlayTargetBottom(canvasRect, scaleY, analysis) - 12 - mapChromeH
    : viewportH;
  const availableW = Math.max(260, viewportW - 36 - chromeW);
  const availableH = Math.max(140, Math.min(viewportH - 36 - summaryH, anchoredH));
  const maxStageScale = stageIds.length <= 1 ? 0.72 : 0.58;
  const stageScale = stageIds.length
    ? Math.max(0.18, Math.min(maxStageScale, availableW / (1024 * stageIds.length), availableH / 694))
    : 0;
  const canvasW = Math.max(180, Math.floor(1024 * stageScale));
  const canvasH = Math.max(122, Math.floor(694 * stageScale));

  root.style.width = hasOffStage
    ? `${Math.min(viewportW - 24, Math.ceil(stageIds.length * canvasW + Math.max(0, stageIds.length - 1) * gap + 24))}px`
    : '282px';
  root.style.zIndex = isUsageOverlayActive() ? '10000' : '9000';
  root.style.borderColor = isUsageOverlayActive() ? '#38bdf8' : 'rgba(15,23,42,.2)';
  root.style.boxShadow = isUsageOverlayActive()
    ? '0 0 0 4px rgba(56, 189, 248, 0.35), 0 18px 45px rgba(15,23,42,.28)'
    : '0 18px 45px rgba(15,23,42,.28)';
  root.style.display = 'block';
  root.innerHTML = `
    <div style="font-weight:800;font-size:13px;margin-bottom:6px;white-space:nowrap;">
      <span style="color:#0f172a;">평균 이동 </span><span style="color:${averageDeltaColor};">${averageDeltaText}</span>
      <span style="color:#94a3b8;"> / </span>
      <span style="color:#0f172a;">기대값 </span><span style="color:${ratioDeltaColor};">${ratioDeltaText}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:${hasOffStage ? 9 : 0}px;">
      <div style="border-radius:6px;background:#f3e8ff;padding:6px;text-align:center;"><strong style="color:#6d28d9;">카드칸</strong><br>${getPredictionPct(stats.card, denom)}</div>
      <div style="border-radius:6px;background:#ffedd5;padding:6px;text-align:center;"><strong style="color:#c2410c;">점프칸</strong><br>${getPredictionPct(stats.jump, denom)}</div>
      <div style="border-radius:6px;background:#fee2e2;padding:6px;text-align:center;"><strong style="color:#b91c1c;">멈춤칸</strong><br>${getPredictionPct(stats.stop, denom)}</div>
    </div>
    <div data-prediction-stages style="display:flex;gap:${gap}px;align-items:flex-start;overflow:hidden;"></div>
  `;

  const strip = root.querySelector('[data-prediction-stages]');
  stageIds.forEach(stageId => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:0 0 auto;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#0f172a;';
    const c = document.createElement('canvas');
    c.width = canvasW * miniBackingScale;
    c.height = (canvasH + 24) * miniBackingScale;
    c.style.cssText = `display:block;width:${canvasW}px;height:${canvasH + 24}px;`;
    wrap.appendChild(c);
    strip.appendChild(wrap);

    const g = c.getContext('2d');
    g.setTransform(miniBackingScale, 0, 0, miniBackingScale, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, canvasW, canvasH + 24);
    g.fillStyle = '#0f172a';
    g.fillRect(0, 0, canvasW, canvasH + 24);
    g.fillStyle = '#f8fafc';
    const titleFontSize = Math.max(10, Math.min(15, 24 * stageScale));
    const pillFontSize = Math.max(7.5, Math.min(12, 22 * stageScale));
    g.font = `normal bold ${titleFontSize}px Arial`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(`${stageId}.${stageNames[stageId - 1] || 'Stage'}`, 8, 12);

    const bg = backgroundImages[stageId - 1];
    if (bg) {
      g.drawImage(bg, 0, 0, 1024, 694, 0, 24, canvasW, canvasH);
    }
    drawPredictionStageEvents(g, stageId, 0, 24, stageScale);

    offStage.forEach(item => {
      if (getStageRowByScore(item.score)[1] !== stageId) return;
      const rect = getPredictionCellRect(item.score, true);
      if (!rect) return;
      const label = item.denom === 1 ? '확정' : getPredictionPct(item.count, item.denom);
      drawPredictionPulse(g, rect.x * stageScale, 24 + rect.y * stageScale, rect.w * stageScale, rect.h * stageScale, true, item.pulseKind);
      drawPredictionPill(g, label, (rect.x + rect.w / 2) * stageScale, 24 + (rect.y + 17) * stageScale, item.dest.className, true, { x: 0, y: 24, w: canvasW, h: canvasH }, pillFontSize);
    });
  });

  if (!hasOffStage && strip) strip.style.display = 'none';
  positionPredictionOverlay(root, hasOffStage, analysis);
}

function drawPredictionVisuals() {
  const analysis = getActivePredictionAnalysis();
  if (!analysis) {
    hidePredictionOverlayRoot();
    return;
  }

  drawPredictionOnCurrentStage(analysis);
  renderPredictionOverlayRoot(analysis);
  startPredictionVisualAnimation();
}

function isPredictionVisualActive() {
  return Boolean(usagePreviewState.prediction) || showDiceOverlay || showCardPos >= 0 || shouldDrawPersistentDicePrediction();
}

function startPredictionVisualAnimation() {
  if (predictionVisualFrame) return;
  const tick = now => {
    if (!isPredictionVisualActive()) {
      predictionVisualFrame = 0;
      hidePredictionOverlayRoot();
      return;
    }
    if (!document.hidden && now - predictionVisualLastAt >= 16) {
      predictionVisualLastAt = now;
      updateBoard();
    }
    predictionVisualFrame = requestAnimationFrame(tick);
  };
  predictionVisualFrame = requestAnimationFrame(tick);
}

function drawBtn(btnText = '', x, y, width, height, radius, opacity, lineColor, fillColor, textColor = 'white', fontSize = 12, hover = false) {
  const outerColor = hover ? 'rgb(255, 218, 122)' : lineColor;
  const innerColor = hover ? 'rgb(65, 165, 225)' : fillColor;
  if (hover) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 184, 70, 0.75)';
    ctx.shadowBlur = 12;
    drawRadiusRect(x - 1, y - 1, width + 2, height + 2, radius + 1, 1, outerColor);
    ctx.restore();
  }
  drawRadiusRect(x, y, width, height, radius, opacity, outerColor);
  drawRadiusRect(x + 2, y + 2, width - 4, height - 4, radius - 2, opacity, innerColor);
  drawRadiusRect(x + 4, y + 4, width - 10, height / 4, radius, hover ? 0.18 : 0.1, 'white');
  drawArc(x + width / 11, y + height / 6, r = hover ? 5 : 4, opacity = 1, color = hover ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)', colorEnd = 'rgba(255, 255, 255, 0)');
  drawText(btnText, x + width / 2, y + height / 2, textColor, fontSize, 'center');
}

function drawDiceMoveButton(btnText, x, y, width, height, lineColor, fillColor, textColor = 'white', disabled = false, hover = false) {
  const radius = 5;
  if (hover) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 184, 70, 0.85)';
    ctx.shadowBlur = 8;
    drawRadiusRect(x - 1, y - 1, width + 2, height + 2, radius + 1, 1, lineColor);
    ctx.restore();
  }
  drawRadiusRect(x, y, width, height, radius, 1, lineColor);
  drawRadiusRect(x + 1, y + 1, width - 2, height - 2, radius - 1, disabled ? 0.55 : 1, fillColor);
  drawRadiusRect(x + 3, y + 3, width - 7, 4, radius - 2, disabled ? 0.05 : (hover ? 0.2 : 0.12), 'white');
  if (!disabled) {
    drawArc(x + 6, y + 4, 2.2, 1, 'rgba(255, 255, 255, 0.58)', 'rgba(255, 255, 255, 0)');
  }
  drawText(btnText, x + width / 2, y + height / 2 + 0.5, textColor, 10, 'center');
}

function drawHoverFrame(x, y, width, height, radius) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 184, 70, 0.78)';
  ctx.shadowBlur = 15;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 218, 122, 0.96)';
  drawPredictionRoundRect(ctx, x + 2, y + 2, width - 4, height - 4, radius);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  drawPredictionRoundRect(ctx, x + 6, y + 6, width - 12, height - 12, Math.max(4, radius - 4));
  ctx.stroke();
  ctx.restore();
}

function drawIconHoverGlow(x, y, width, height, radius) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 190, 74, 0.65)';
  ctx.shadowBlur = 12;
  drawRadiusRect(x, y, width, height, radius, 0.5, 'rgba(255, 220, 120, 0.55)');
  ctx.shadowBlur = 0;
  drawRadiusRect(x + 2, y + 2, width - 4, height - 4, Math.max(4, radius - 2), 0.18, 'white');
  ctx.restore();
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


let isDragging = false;
let preventClick = false;
let dragStartY = 0;
let initialScrollOffset = 0;
let isDraggingCharacter = false;
let characterDragTargetScore = null;
let characterDragStartScore = null;

canvas.addEventListener('touchstart', function (e) {
  let { x, y } = getCanvasPoint(e);
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
    let { y } = getCanvasPoint(e);
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
const REGION_DICE_MOVE = { x1: 12, x2: 198, y1: 463, y2: 514 };
const REGION_STEP = { x1: 9, x2: 201, y1: 525, y2: 623 };
const REGION_CARDS = { x1: 423, x2: 634, y1: 643, y2: 677 };
const REGION_CARDINFO = { x1: 229, x2: 479, y1: 15, y2: 615 };
const REGION_BTN_CARDINFO = { x1: 640, x2: 679, y1: 643, y2: 677 };
const REGION_BTN_RESETBOARD = { x1: 690, x2: 780, y1: 642, y2: 680 };
const REGION_BTN_CHANGEMODE = { x1: 788, x2: 878, y1: 642, y2: 680 };
const REGION_BTN_HELP = { x1: 886, x2: 976, y1: 642, y2: 680 };
const REGION_BTN_ACCURACY = { x1: 11, x2: 199, y1: 288, y2: 313 };
const REGION_BTN_EXSCORE = { x1: 9, x2: 201, y1: 313, y2: 433 };
const REGION_BTN_PREV_STAGE = { x1: 1106, x2: 1160, y1: 639, y2: 683 };
const REGION_BTN_NEXT_STAGE = { x1: 1170, x2: 1224, y1: 639, y2: 683 };
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
  lastCanvasPointer = null;
  isDragging = false;
  isDraggingCharacter = false;
  characterDragTargetScore = null;
  characterDragStartScore = null;
  showDiceOverlay = false;
  diceOverlayHoverIndex = -1;
  uiHoverTarget = '';
  showCardPos = -1;
  exScoreOverviewHoverIndex = -1;
  hidePredictionOverlayRoot();
  hideExScoreOverviewRoot();
  updateBoard();
}

function eventWindowBlur(e) {
  lastCanvasPointer = null;
  isDragging = false;
  isDraggingCharacter = false;
  exScoreOverviewHoverIndex = -1;
  uiHoverTarget = '';
  hideExScoreOverviewRoot();
  updateBoard();
}

function eventCanvasMousedown(e) {
  const REGION_CARDINFO_SCROLLBAR = { x1: 479, x2: 489, y1: env.scrollbarY, y2: env.scrollbarY + 100 };
  let { x, y } = rememberCanvasPointer(e);

  if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO_SCROLLBAR)) {
    isDragging = true;
    preventClick = true;
    dragStartY = y;
    initialScrollOffset = env.cardInfoScrollOffset;
  } else if (!env.autoProcess && !showCardInfoYN && isInsideRegion(x, y, regionCurrentCharacter)) {
    isDraggingCharacter = true;
    preventClick = true;
    characterDragStartScore = env.score;
    characterDragTargetScore = null;
  }
}

function eventCanvasMousemove(e) {
  let { x, y } = rememberCanvasPointer(e);

  if (env.autoProcess && isDraggingCharacter) {
    isDraggingCharacter = false;
    characterDragTargetScore = null;
    characterDragStartScore = null;
    updateBoard();
  }

  if (isDraggingCharacter) {
    const targetScore = getScoreFromMousePosition(x, y);
    characterDragTargetScore = targetScore;
    updateBoard();
    return;
  }

  setPredictionInteractionStateFromPoint(x, y);

  if (isDragging) {
    let dragDistance = y - dragStartY;
    let newScrollOffset = initialScrollOffset + (dragDistance / 500) * 300;

    env.cardInfoScrollOffset = Math.max(0, Math.min(newScrollOffset, 300));

    updateBoard();
  }
}

function eventCanvasWheel(e) {
  let { x, y } = rememberCanvasPointer(e);
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
  let { x, y } = rememberCanvasPointer(e);
  if (showCardInfoYN && isInsideRegion(x, y, REGION_CARDINFO)) {
    let index = Math.trunc((y - 15 + env.cardInfoScrollOffset) / 30);
    env.getCard(index, true);
    calcEx();
  } else if (isInsideRegion(x, y, REGION_CARDS)) {
    let cardIndex = Math.trunc((x - 379) / 43) - 1;
    if (env.cards[cardIndex] !== undefined) {
      env.cards.splice(cardIndex, 1);
      clearPredictionInteractionState();
      calcEx();
    }
  }
  e.preventDefault();
}

function eventCanvasClick(e) {
  let { x, y } = rememberCanvasPointer(e);

  if (preventClick) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  const diceButtonIndex = getDiceOverlayButtonIndex(x, y);
  if (!env.autoProcess && diceButtonIndex >= 0) {
    const value = diceButtonIndex + 2;

    env.updateScore(value, true);
    clearPredictionInteractionState();
    calcEx();
    return;
  }

  if (isInsideRegion(x, y, REGION_STEP)) {
    if (env.autoProcess) {
      done = env.step(0);
      clearPredictionInteractionState({ keepDiceOverlay: true });
      calcEx();
    } else {
      env.isDouble = !env.isDouble;
      calcEx();
    }
  } else if (isInsideRegion(x, y, REGION_CARDS)) {
    let action = Math.trunc((x - 379) / 43);
    if (env.cards[action - 1] !== undefined) {
      done = env.step(action);
      clearPredictionInteractionState();
      calcEx();
    } else {
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
  } else if (isInsideRegion(x, y, REGION_SCORE)) {
    let n = prompt('이동', env.score);
    if (n === null || n == '') return;
    n = Number(n);
    if (!isNaN(n) && n > 0 && n <= 2898) {
      env.score = n;
      env.rankReg = true;
      env.checkEvent();
      calcEx();
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
    } else {
      alert('올바른 숫자를 입력하세요.');
    }
  } else if (!showCardInfoYN && isInsideRegion(x, y, REGION_BTN_CARDINFO)) {
    showCardInfoYN = true;
    updateBoard();
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
  } else if (isInsideRegion(x, y, REGION_BTN_EXSCORE)) {
    calcEx();
  } else if (isInsideRegion(x, y, REGION_BTN_ACCURACY)) {
    showComputeModeModal(() => calcEx());
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
    }
  } else if (isInsideRegion(x, y, REGION_BTN_HELP)) {
    closeCardInfoPanelGlobal();
    initUsageOverlay();
  } else if (isInsideRegion(x, y, REGION_BTN_PREV_STAGE)) {
    env.moveStage(-1);
    calcEx();
  } else if (isInsideRegion(x, y, REGION_BTN_NEXT_STAGE)) {
    env.moveStage(1);
    calcEx();
  } else if (showCardInfoYN) {
    showCardInfoYN = false;
    updateBoard();
  }

  if (done && env.autoProcess && !env.rankReg) {
    env.rankReg = true;
  }
}

function isInsideRegion(x, y, r) {
  return x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2;
}

function getUiHoverTarget(x, y) {
  if (isInsideRegion(x, y, REGION_BTN_CARDINFO)) return 'cardInfo';
  if (isInsideRegion(x, y, REGION_BTN_RESETBOARD)) return 'reset';
  if (isInsideRegion(x, y, REGION_BTN_CHANGEMODE)) return 'mode';
  if (isInsideRegion(x, y, REGION_BTN_HELP)) return 'help';
  if (isInsideRegion(x, y, REGION_BTN_PREV_STAGE)) return 'prevStage';
  if (isInsideRegion(x, y, REGION_BTN_NEXT_STAGE)) return 'nextStage';
  if (isInsideRegion(x, y, REGION_STEP)) return 'diceRoll';
  return '';
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
      clearPredictionInteractionState();
      calcEx();
    } else {
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
      clearPredictionInteractionState();
      calcEx();
    } else {
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

  let targetScore = clampBoardScore(startScore + value);

  let startIndex = startScore;
  let endIndex = Math.min(2897, startScore + value - 1);

  for (let i = startIndex; i < endIndex; i++) {
    if (stage[i][5] === 6 || stage[i][5] === 9) {
      targetScore = i + 1;
      break;
    }
  }

  return clampBoardScore(targetScore);
}

function formatCountValue(value) {
  return typeof value === 'number' && isFinite(value) ? Math.round(value).toLocaleString() : value;
}

function formatIntegerValue(value) {
  return typeof value === 'number' && isFinite(value) ? String(Math.round(value)) : value;
}

function formatConfidenceInterval(avg, se) {
  if (typeof avg !== 'number' || !isFinite(avg) || typeof se !== 'number' || !isFinite(se)) {
    return '-';
  }
  let margin = 1.96 * se;
  return formatIntegerValue(avg - margin) + ' ~ ' + formatIntegerValue(avg + margin);
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
    let len = this.cards.length;
    if (len === 0) {
      return 0;
    }

    for (let i = 0; i < len; i++) {
      // 칸수 행운카드 사용시 1칸 이상 점프하여 행운카드 획득
      const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
      const jump = targetIndex === null ? 0 : stage[targetIndex][4];
      const jumpTargetIndex = targetIndex === null ? null : targetIndex + jump;
      if (targetIndex !== null && jump > 0 && jumpTargetIndex >= 0 && jumpTargetIndex < 2898 && stage[jumpTargetIndex][5] === 2) {
        return i + 1;
      }
    }

    for (let i = 0; i < len; i++) {
      // 칸수 행운카드 사용시 행운카드 획득
      const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
      if (targetIndex !== null && stage[targetIndex][5] === 2) {
        return i + 1;
      }
    }

    for (let i = 0; i < len; i++) {
      // 칸수 행운카드 사용시 29칸 이상 점프
      const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
      if (targetIndex !== null && stage[targetIndex][4] >= 29) {
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
          const firstTargetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
          const combinedTargetIndex = (this.cards[i][1] === 1 && this.cards[j][1] === 1) ? this.getMoveCardTargetIndex(this.cards[i], this.cards[j][2]) : null;
          if (i !== j && firstTargetIndex !== null && combinedTargetIndex !== null &&
            (stage[firstTargetIndex][4] > 0 && stage[combinedTargetIndex][5] === 2)) {
            return i + 1;
          }
        }
      }

      // 없으면 칸수 행운카드 사용
      for (let i = 0; i < len; i++) {
        const targetIndex = this.cards[i][1] === 1 ? this.getMoveCardTargetIndex(this.cards[i]) : null;
        if (targetIndex !== null && Math.sign(stage[targetIndex][4]) !== -1) {
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
    let countScores = new Array(actionSize).fill(0);
    let sumScores = new Array(actionSize).fill(0);
    let sumSqScores = new Array(actionSize).fill(0);
    let scoreCountArrays = new Array(actionSize).fill(0).map(() => new Uint32Array(2899));
    let scoreCounts = new Array(actionSize).fill(0).map(() => []);
    for (let i = 0; i < actionSize; i++) {
      if (route !== undefined && route.includes(i)) {
        for (let j = 0; j < iteration; j++) {
          let done = false;
          let sEnv = new Board();
          sEnv.setState(state);
          sEnv.autoProcess = true;

          sEnv.step(i);

          while (!done) {
            done = sEnv.step(sEnv.chooseAction());
          }
          let score = sEnv.score;
          countScores[i]++;
          sumScores[i] += score;
          sumSqScores[i] += score * score;
          minScores[i] = countScores[i] === 1 ? score : Math.min(minScores[i], score);
          maxScores[i] = countScores[i] === 1 ? score : Math.max(maxScores[i], score);
          if (score >= 0 && score < scoreCountArrays[i].length) {
            scoreCountArrays[i][score]++;
          }
        }
        avgScores[i] = sumScores[i] / countScores[i];
        let variance = Math.max(0, sumSqScores[i] / countScores[i] - avgScores[i] * avgScores[i]);
        stdScores[i] = Math.sqrt(variance);
        medianScores[i] = getMedianFromCounts(scoreCountArrays[i], countScores[i]);
        scoreCounts[i] = compactScoreCounts(scoreCountArrays[i]);
      }
    }
    return [1, { avg: avgScores, min: minScores, max: maxScores, std: stdScores, mid: medianScores, count: countScores, sum: sumScores, sumSq: sumSqScores, scoreCounts: scoreCounts }];
  } catch (err) {
    console.error(err);
    return [-1];
  }
}

function getMedianFromCounts(scoreCounts, count) {
  if (count === 0) return 0;
  let leftTarget = Math.floor((count + 1) / 2);
  let rightTarget = Math.floor((count + 2) / 2);
  let seen = 0;
  let leftValue;
  for (let score = 0; score < scoreCounts.length; score++) {
    seen += scoreCounts[score];
    if (leftValue === undefined && seen >= leftTarget) {
      leftValue = score;
    }
    if (seen >= rightTarget) {
      return (leftValue + score) / 2;
    }
  }
  return 0;
}

function compactScoreCounts(scoreCounts) {
  let compact = [];
  for (let score = 0; score < scoreCounts.length; score++) {
    if (scoreCounts[score] > 0) {
      compact.push([score, scoreCounts[score]]);
    }
  }
  return compact;
}
`;







const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);


let workerIteration = 10000;
let workerReqIndex = 1;
const logicalCpuCount = navigator.hardwareConcurrency || 6;
const estimatedPhysicalCoreCount = Math.max(2, Math.ceil(logicalCpuCount / 2));
const maxWorkerCount = Math.max(2, Math.min(estimatedPhysicalCoreCount, logicalCpuCount - 1));
let workerCount = Math.ceil(maxWorkerCount / 2);
computeSettings.cpuWorkers = workerCount;
let workers = [];
let workerRunnings = [];
let calcExRequestId = 0;
const ADAPTIVE_INITIAL_RATIO = 0.1;
const ADAPTIVE_BATCH_RATIO = 0.05;
const ADAPTIVE_MAX_RATIO = 10;
const ADAPTIVE_BOUND_Z = 1.8;
const ADAPTIVE_HIGHLIGHT_Z = 1.96;
const ADAPTIVE_SAMPLE_LIMIT = 2;
const PERF_BENCHMARK_MAX_PCT = 200;
const PERF_BENCHMARK_COOLDOWN_MS = 500;
const PERF_GPU_WARMUP_ROLLOUTS = 4096;
const PERF_GPU_SETTLE_MAX_PCT = 50;
const PERF_GPU_CALIBRATION_SMALL_ROLLOUTS = 8192;
const PERF_GPU_CALIBRATION_LARGE_ROLLOUTS = 65536;
const PERF_GPU_STABLE_CHUNK_TARGET_MS = 1200;
const PERF_GPU_STABLE_CHUNK_LIMIT_MS = 2600;
const GPU_BASE_ITERATION = 100000;
let gpuCalibrationProfile = null;

resetWorkers();

function terminateCalcWorkers() {
  workers.forEach(worker => worker.terminate());
  workers = [];
  workerRunnings = [];
}

function beginCalcExRequest() {
  calcExRequestId++;
  terminateCalcWorkers();
  return calcExRequestId;
}

function isCalcExRequestActive(requestId) {
  return requestId === calcExRequestId;
}

function getGpuRandomSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] >>> 0;
}

function getGpuMaxPctForUsage(value) {
  if (value === 'high') return 10000;
  if (value === 'low') return 1000;
  return 2000;
}

function getCpuMaxPctForWorkers(cpuWorkers) {
  let defaultCpuWorkers = Math.ceil(maxWorkerCount / 2);
  let value = Math.max(1, Math.min(maxWorkerCount, Number(cpuWorkers) || defaultCpuWorkers));
  if (value <= 1) return 200;
  if (value >= maxWorkerCount) return 1000;
  return 500;
}

function getGpuUsageSettings(value) {
  let calibrated = getGpuCalibratedUsageSettings(value);
  if (calibrated) return calibrated;

  if (value === 'high') {
    return { gpuIteration: GPU_BASE_ITERATION, gpuBatchPct: 200, gpuMaxPct: getGpuMaxPctForUsage('high'), gpuLoad: 'high', targetChunkMs: 1000, yieldMs: 0, initialChunkPct: 100, minChunkPct: 100 };
  }
  if (value === 'low') {
    return { gpuIteration: GPU_BASE_ITERATION, gpuBatchPct: 50, gpuMaxPct: getGpuMaxPctForUsage('low'), gpuLoad: 'low', targetChunkMs: 200, yieldMs: 12, initialChunkPct: 100, minChunkPct: 50 };
  }
  return { gpuIteration: GPU_BASE_ITERATION, gpuBatchPct: 100, gpuMaxPct: getGpuMaxPctForUsage('medium'), gpuLoad: 'medium', targetChunkMs: 500, yieldMs: 4, initialChunkPct: 100, minChunkPct: 75 };
}

function createGpuUsageSetting(value, option) {
  return {
    gpuIteration: GPU_BASE_ITERATION,
    gpuBatchPct: option.gpuBatchPct,
    gpuMaxPct: option.gpuMaxPct || getGpuMaxPctForUsage(value),
    gpuLoad: value,
    targetChunkMs: option.targetChunkMs,
    yieldMs: option.yieldMs,
    cooldownRatio: option.cooldownRatio || 0,
    initialChunkPct: option.initialChunkPct || 100,
    minChunkPct: option.minChunkPct,
  };
}

function getGpuCalibratedUsageSettings(value) {
  if (!gpuCalibrationProfile || !gpuCalibrationProfile.options) return null;
  let option = gpuCalibrationProfile.options[value];
  if (!option) return null;
  return createGpuUsageSetting(value, option);
}

function createGpuCalibrationProfile(smallMs, largeMs) {
  let safeSmallMs = Math.max(1, smallMs || 1);
  let safeLargeMs = Math.max(1, largeMs || 1);
  let smallToLargeRatio = safeSmallMs / safeLargeMs;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pct(value) {
    return Math.max(1, Math.round(value));
  }

  let speedScale = clamp(Math.sqrt(350 / safeLargeMs), 0.2, 6);
  let overheadPressure = clamp((smallToLargeRatio - 0.16) / 0.44, 0, 1);
  let slowPressure = clamp((safeLargeMs - 500) / 1600, 0, 1);
  let fastPressure = clamp((260 - safeLargeMs) / 240, 0, 1);

  let lowBatchPct = pct(clamp(
    22 * (1 + overheadPressure * 0.45 + slowPressure * 0.4) / Math.pow(speedScale, 0.22),
    8,
    65,
  ));
  let mediumBatchPct = pct(clamp(
    82 * (1 + overheadPressure * 0.65 + slowPressure * 0.55) / Math.pow(speedScale, 0.14),
    Math.max(40, lowBatchPct * 2.2),
    450,
  ));
  let highBatchPct = pct(clamp(
    220 * (1 + overheadPressure * 0.8 + slowPressure * 0.85) * Math.pow(speedScale, 0.08),
    Math.max(150, mediumBatchPct * 1.7),
    1000,
  ));

  let lowYieldMs = pct(clamp(70 + safeLargeMs * 0.12 + fastPressure * 120 + overheadPressure * 70, 70, 700));
  let mediumYieldMs = pct(clamp(12 + safeLargeMs * 0.025 + fastPressure * 32 + overheadPressure * 24, 8, 160));
  let lowMinChunkPct = pct(clamp(10 + overheadPressure * 12 + slowPressure * 16 - fastPressure * 4, 6, 45));
  let mediumMinChunkPct = pct(clamp(42 + overheadPressure * 22 + slowPressure * 16 - fastPressure * 6, 28, 90));
  let lowCooldownRatio = clamp(0.75 + fastPressure * 0.65 + overheadPressure * 0.35, 0.65, 1.6);
  let mediumCooldownRatio = clamp(0.12 + fastPressure * 0.16 + overheadPressure * 0.1, 0.08, 0.35);

  let options = {
    low: {
      gpuBatchPct: lowBatchPct,
      gpuMaxPct: getGpuMaxPctForUsage('low'),
      targetChunkMs: pct(clamp(safeLargeMs * 0.14, 35, 650)),
      yieldMs: lowYieldMs,
      cooldownRatio: lowCooldownRatio,
      minChunkPct: lowMinChunkPct,
    },
    medium: {
      gpuBatchPct: mediumBatchPct,
      gpuMaxPct: getGpuMaxPctForUsage('medium'),
      targetChunkMs: pct(clamp(safeLargeMs * 0.55, 120, 1600)),
      yieldMs: mediumYieldMs,
      cooldownRatio: mediumCooldownRatio,
      minChunkPct: mediumMinChunkPct,
    },
    high: {
      gpuBatchPct: highBatchPct,
      gpuMaxPct: getGpuMaxPctForUsage('high'),
      targetChunkMs: pct(clamp(safeLargeMs * 1.9, 500, 3500)),
      yieldMs: 0,
      cooldownRatio: 0,
      minChunkPct: 100,
    },
  };

  return {
    smallMs: safeSmallMs,
    largeMs: safeLargeMs,
    smallToLargeRatio,
    speedScale,
    overheadPressure,
    stableChunkPct: null,
    stableChunkMs: null,
    stableChunkLimited: false,
    options,
  };
}

function tuneGpuProfileForStableChunk(profile, stableChunkPct, stableChunkMs, limited) {
  if (!profile || !profile.options || !Number.isFinite(stableChunkPct)) return profile;
  profile.stableChunkPct = stableChunkPct;
  profile.stableChunkMs = stableChunkMs;
  profile.stableChunkLimited = limited === true;
  if (!profile.stableChunkLimited) return profile;

  let safePct = Math.max(8, Math.floor(stableChunkPct));
  let mediumCap = Math.max(40, Math.min(profile.options.medium.gpuBatchPct, safePct));
  let highCap = Math.max(mediumCap, Math.min(profile.options.high.gpuBatchPct, Math.floor(safePct * 1.5)));

  profile.options.low.gpuBatchPct = Math.min(profile.options.low.gpuBatchPct, Math.max(8, Math.floor(safePct * 0.45)));
  profile.options.low.minChunkPct = 100;
  profile.options.low.initialChunkPct = 100;
  profile.options.medium.gpuBatchPct = mediumCap;
  profile.options.medium.minChunkPct = Math.min(profile.options.medium.minChunkPct, 70);
  profile.options.medium.initialChunkPct = 100;
  profile.options.high.gpuBatchPct = highCap;
  profile.options.high.minChunkPct = 100;
  profile.options.high.initialChunkPct = 100;
  return profile;
}

function applyGpuUsageSettings(value) {
  let settings = getGpuUsageSettings(value);
  computeSettings.gpuUsage = value;
  computeSettings.gpuIteration = settings.gpuIteration;
  computeSettings.gpuBatchPct = settings.gpuBatchPct;
  computeSettings.gpuMaxPct = settings.gpuMaxPct;
  computeSettings.gpuLoad = settings.gpuLoad;
  computeSettings.targetChunkMs = settings.targetChunkMs;
  computeSettings.yieldMs = settings.yieldMs;
  computeSettings.cooldownRatio = settings.cooldownRatio;
  computeSettings.initialChunkPct = settings.initialChunkPct;
  computeSettings.minChunkPct = settings.minChunkPct;
}

function getGpuLoadConfig(gpuLoad = computeSettings.gpuLoad) {
  if (gpuLoad === 'low') return { targetChunkMs: 200, yieldMs: 12, cooldownRatio: 0.35, initialChunkPct: 100, minChunkPct: 50 };
  if (gpuLoad === 'medium') return { targetChunkMs: 500, yieldMs: 4, cooldownRatio: 0.05, initialChunkPct: 100, minChunkPct: 75 };
  return { targetChunkMs: 1000, yieldMs: 0, cooldownRatio: 0, initialChunkPct: 100, minChunkPct: 100 };
}

function createGpuDispatchTuner(batchIteration, settings = {}) {
  let loadConfig = getGpuLoadConfig(settings.gpuLoad);
  let targetChunkMs = Math.max(4, settings.targetChunkMs || loadConfig.targetChunkMs);
  let baseYieldMs = Math.max(0, settings.yieldMs !== undefined ? settings.yieldMs : loadConfig.yieldMs);
  let cooldownRatio = Math.max(0, settings.cooldownRatio !== undefined ? settings.cooldownRatio : loadConfig.cooldownRatio || 0);
  let currentYieldMs = baseYieldMs;
  let initialChunkPct = Math.max(1, Math.min(100, settings.initialChunkPct || loadConfig.initialChunkPct));
  let minChunkPct = Math.max(0, Math.min(100, settings.minChunkPct || loadConfig.minChunkPct || 0));
  let fixedChunkPct = settings.gpuLoad === 'low' ? Math.max(minChunkPct, initialChunkPct) : 0;
  if (fixedChunkPct > 0) {
    minChunkPct = fixedChunkPct;
    cooldownRatio = Math.min(cooldownRatio, 0.25);
  }
  let minDispatchIteration = Math.max(64, Math.floor(batchIteration * Math.max(minChunkPct, 0.5) / 100));
  let maxDispatchIteration = Math.max(minDispatchIteration, batchIteration);
  let dispatchIteration = Math.max(
    minDispatchIteration,
    Math.min(maxDispatchIteration, Math.floor(batchIteration * initialChunkPct / 100)),
  );

  return {
    get yieldMs() {
      return currentYieldMs;
    },
    next(remaining) {
      return Math.max(1, Math.min(remaining, Math.round(dispatchIteration)));
    },
    record(elapsedMs, iteration) {
      if (!elapsedMs || elapsedMs <= 0 || !isFinite(elapsedMs)) return;
      currentYieldMs = Math.min(1500, baseYieldMs + elapsedMs * cooldownRatio);
      if (fixedChunkPct > 0) return;
      let targetIteration = iteration * targetChunkMs / elapsedMs;
      let blend = elapsedMs > targetChunkMs * 1.4 ? 0.45 : 0.25;
      dispatchIteration = dispatchIteration * (1 - blend) + targetIteration * blend;
      dispatchIteration = Math.max(minDispatchIteration, Math.min(maxDispatchIteration, dispatchIteration));
    },
  };
}

function waitGpuYield(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordComputePerf(engine, key, elapsedMs, options = {}) {
  if (!computePerfStats[engine]) computePerfStats[engine] = {};
  let previous = computePerfStats[engine][key];
  if (!previous || options.replace) {
    computePerfStats[engine][key] = { count: 1, avgMs: elapsedMs, lastMs: elapsedMs, running: false };
    updateComputePerfHelpUI(engine, key);
    updateComputeOverallProgressUI();
    return;
  }
  let count = previous.count + 1;
  computePerfStats[engine][key] = {
    count,
    avgMs: previous.avgMs + (elapsedMs - previous.avgMs) / count,
    lastMs: elapsedMs,
    running: false,
  };
  updateComputePerfHelpUI(engine, key);
  updateComputeOverallProgressUI();
}

function setComputePerfRunning(engine, key, progressPct = 0) {
  if (!computePerfStats[engine]) computePerfStats[engine] = {};
  let previous = computePerfStats[engine][key] || { count: 0, avgMs: 0, lastMs: 0 };
  computePerfStats[engine][key] = { ...previous, running: true, error: null, progressPct };
  updateComputePerfHelpUI(engine, key);
  updateComputeOverallProgressUI();
}

function setComputePerfProgress(engine, key, progressPct) {
  if (!computePerfStats[engine]) computePerfStats[engine] = {};
  let stat = computePerfStats[engine][key];
  if (!stat || !stat.running) return;
  computePerfStats[engine][key] = { ...stat, progressPct };
  scheduleComputePerfUIRefresh(engine, key);
}

function setComputePerfError(engine, key) {
  if (!computePerfStats[engine]) computePerfStats[engine] = {};
  let previous = computePerfStats[engine][key] || { count: 0, avgMs: 0, lastMs: 0 };
  computePerfStats[engine][key] = { ...previous, running: false, error: true };
  updateComputePerfHelpUI(engine, key);
  updateComputeOverallProgressUI();
}

function cancelComputePerfBenchmark() {
  computePerfBenchmarkId++;
  if (!computePerfBenchmarkRunning) return;
  computePerfBenchmarkRunning = false;
  Object.keys(computePerfStats).forEach(engine => {
    Object.keys(computePerfStats[engine] || {}).forEach(key => {
      let stat = computePerfStats[engine][key];
      if (stat && stat.running) {
        computePerfStats[engine][key] = { ...stat, running: false };
        updateComputePerfHelpUI(engine, key);
      }
    });
  });
  updateComputeOverallProgressUI();
}

async function waitComputePerfBenchmarkIdle() {
  let promise = computePerfBenchmarkPromise;
  if (!promise) return;
  try {
    await promise;
  } catch (error) {
    console.warn('Compute perf benchmark stopped.', error);
  }
}

function getComputePerfText(engine, key) {
  let stat = computePerfStats[engine] && computePerfStats[engine][key];
  if (stat && stat.running) return `계산중입니다. [${getComputePerfProgressPct(engine, key)}%]`;
  if (stat && stat.error) return '이 기기에서 측정하지 못했습니다.';
  if (!stat) return '이 기기에서 첫 계산 후 추론 시간을 표시합니다.';
  return `이 기기에서 측정한 추론 시간은 약 ${Math.round(stat.avgMs)}ms/회입니다.`;
}

function getComputePerfHtml(engine, key) {
  let stat = computePerfStats[engine] && computePerfStats[engine][key];
  if (!stat || stat.running || stat.error || stat.count <= 0) return getComputePerfText(engine, key);
  return `이 기기에서 측정한 추론 시간은 약 <strong style="color:#0f172a;font-weight:800;">${Math.round(stat.avgMs)}ms/회</strong>입니다.`;
}

function getComputePerfProgressPct(engine, key) {
  let stat = computePerfStats[engine] && computePerfStats[engine][key];
  if (!stat || !stat.running) return 0;
  return Math.max(0, Math.min(100, Math.round(stat.progressPct || 0)));
}

function updateComputePerfProgressBar(card, engine, key) {
  let track = card && card.querySelector('[data-perf-progress]');
  if (!track) return;
  let fill = track.querySelector('[data-perf-progress-fill]');
  let stat = computePerfStats[engine] && computePerfStats[engine][key];
  let running = stat && stat.running;
  let pct = getComputePerfProgressPct(engine, key);
  track.style.display = running ? 'block' : 'none';
  if (fill) fill.style.width = `${pct}%`;
}

function fitComputeModeModal() {
  let modal = document.getElementById('adventure-compute-modal');
  if (!modal) return;
  let card = modal.querySelector('[data-compute-card]');
  if (!card) return;
  fitFixedElementToViewport(card, { margin: 16, minZoom: 0.42 });
}

function scheduleComputeModeModalFit() {
  if (computeModalFitFrame !== null) return;
  computeModalFitFrame = requestAnimationFrame(() => {
    computeModalFitFrame = null;
    fitComputeModeModal();
  });
}

function updateComputePerfOptionUI(engine, key) {
  let modal = document.getElementById('adventure-compute-modal');
  if (!modal) return;
  let perf = modal.querySelector(`[data-perf-engine="${engine}"][data-perf-key="${key}"]`);
  if (perf) perf.innerHTML = getComputePerfHtml(engine, key);
  let card = modal.querySelector(`[data-option-engine="${engine}"][data-option-key="${key}"]`);
  updateComputePerfProgressBar(card, engine, key);
  scheduleComputeModeModalFit();
}

function flushComputePerfUIRefresh() {
  computePerfUiFrame = null;
  let keys = Array.from(computePerfPendingUiKeys);
  computePerfPendingUiKeys.clear();
  keys.forEach(value => {
    let [engine, key] = value.split(':');
    updateComputePerfOptionUI(engine, key);
  });
  updateComputeOverallProgressUI();
  scheduleComputeModeModalFit();
}

function scheduleComputePerfUIRefresh(engine, key) {
  computePerfPendingUiKeys.add(`${engine}:${key}`);
  if (computePerfUiFrame !== null) return;
  let scheduleFrame = window.requestAnimationFrame || (callback => window.setTimeout(callback, 100));
  computePerfUiFrame = scheduleFrame(flushComputePerfUIRefresh);
}

function getComputeOptionCompletion(engine, key) {
  let stat = computePerfStats[engine] && computePerfStats[engine][key];
  if (!stat) return 0;
  if (stat.running) return getComputePerfProgressPct(engine, key);
  if (stat.error || stat.count > 0) return 100;
  return 0;
}

function updateComputeOverallProgressUI() {
  let modal = document.getElementById('adventure-compute-modal');
  if (!modal) return;
  let box = modal.querySelector('[data-overall-perf-progress]');
  if (!box) return;
  if (computePerfRecommendations.engine) {
    box.style.display = 'none';
    return;
  }
  let cards = Array.from(modal.querySelectorAll('[data-option-engine][data-option-key]'))
    .filter(card => card.dataset.optionEngine !== 'gpu' || isGpuAvailable());
  if (cards.length === 0) {
    box.style.display = 'none';
    return;
  }
  let total = cards.reduce((sum, card) => {
    return sum + getComputeOptionCompletion(card.dataset.optionEngine, card.dataset.optionKey);
  }, 0);
  let pct = Math.max(0, Math.min(100, Math.round(total / cards.length)));
  let text = box.querySelector('[data-overall-perf-text]');
  let fill = box.querySelector('[data-overall-perf-fill]');
  box.style.display = computePerfBenchmarkRunning || pct > 0 ? 'block' : 'none';
  if (text) text.textContent = `추천 항목 계산중입니다. [${pct}%]`;
  if (fill) fill.style.width = `${pct}%`;
  scheduleComputeModeModalFit();
}

function getBestMeasuredComputeOption(engine, keys) {
  let best = null;
  keys.forEach(key => {
    let stat = computePerfStats[engine] && computePerfStats[engine][key];
    if (!stat || stat.running || stat.error || stat.count <= 0) return;
    if (!best || stat.avgMs < best.avgMs) {
      best = { key: key, avgMs: stat.avgMs };
    }
  });
  return best ? best.key : null;
}

function getMeasuredComputeAvg(engine, key) {
  let stat = computePerfStats[engine] && computePerfStats[engine][key];
  if (!stat || stat.running || stat.error || stat.count <= 0) return Infinity;
  return stat.avgMs;
}

function getRecommendedComputeEngine() {
  let gpuAvg = getMeasuredComputeAvg('gpu', computePerfRecommendations.gpu);
  let cpuAvg = getMeasuredComputeAvg('cpu', computePerfRecommendations.cpu);
  if (!isFinite(gpuAvg) && !isFinite(cpuAvg)) return null;
  if (!isFinite(gpuAvg)) return 'cpu';
  if (!isFinite(cpuAvg)) return 'gpu';
  return gpuAvg <= cpuAvg ? 'gpu' : 'cpu';
}

function updateComputeEngineCards() {
  let modal = document.getElementById('adventure-compute-modal');
  if (!modal) return;
  ['gpu', 'cpu'].forEach(engine => {
    let card = modal.querySelector(`#compute-${engine}-card`);
    if (!card) return;
    let input = card.querySelector('input[type="radio"]');
    let badge = card.querySelector('[data-engine-recommend-badge]');
    let selected = input && input.checked;
    let recommended = computePerfRecommendations.engine === engine;
    if (engine === 'gpu' && !isGpuAvailable()) {
      card.style.borderColor = '#fecaca';
      card.style.background = '#fff1f2';
      card.style.boxShadow = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }
    card.style.borderColor = selected ? '#2563eb' : (recommended ? '#16a34a' : '#cbd5e1');
    card.style.background = selected ? '#eff6ff' : (recommended ? '#f0fdf4' : '#f8fafc');
    card.style.boxShadow = recommended ? '0 0 0 2px rgba(22, 163, 74, 0.16)' : 'none';
    if (badge) badge.style.display = recommended ? 'inline-flex' : 'none';
  });
  updateComputeOverallProgressUI();
}

function updateComputeOptionCards(engine) {
  let modal = document.getElementById('adventure-compute-modal');
  if (!modal) return;
  let cards = modal.querySelectorAll(`[data-option-engine="${engine}"]`);
  cards.forEach(card => {
    let key = card.dataset.optionKey;
    let input = card.querySelector('input[type="radio"]');
    let perf = card.querySelector('[data-perf-text]');
    let badge = card.querySelector('[data-recommend-badge]');
    let selected = input && input.checked;
    let recommended = computePerfRecommendations[engine] === key;
    card.style.borderColor = selected ? '#2563eb' : (recommended ? '#16a34a' : '#cbd5e1');
    card.style.background = selected ? '#eff6ff' : (recommended ? '#f0fdf4' : '#f8fafc');
    card.style.boxShadow = recommended ? '0 0 0 2px rgba(22, 163, 74, 0.16)' : 'none';
    if (perf) perf.innerHTML = getComputePerfHtml(engine, key);
    updateComputePerfProgressBar(card, engine, key);
    if (badge) badge.style.display = recommended ? 'inline-flex' : 'none';
  });
}

function updateComputePerfHelpUI(engine, key) {
  updateComputePerfOptionUI(engine, key);
  updateComputeOptionCards(engine);
  updateComputeOverallProgressUI();
}

function isGpuAvailable() {
  return Boolean(navigator.gpu && window.gpuRolloutWorkbench && !gpuDisabledReason);
}

function markGpuUnavailable(reason) {
  gpuDisabledReason = reason || 'GPU engine self-test failed.';
  computeSettings.engine = 'cpu';
}

function getGpuUnavailableMessage() {
  if (!navigator.gpu) return 'WebGPU를 사용할 수 없어 CPU 엔진으로 시작합니다.';
  if (gpuDisabledReason) return '현재 GPU가 시뮬레이션 엔진과 호환되지 않아 CPU 엔진으로 시작합니다.';
  return 'GPU 엔진을 사용할 수 없어 CPU 엔진으로 시작합니다.';
}

function createGpuSelfTestState({ diceUse = 0, isDouble = 0 } = {}) {
  let state = new Board().getState().slice();
  state[1] = true;
  state[5] = diceUse;
  state[6] = isDouble ? 1 : 0;
  return state;
}

function getGpuSummaryMean(summary) {
  return summary && (summary.mean !== undefined ? summary.mean : summary.avg);
}

function compactGpuSelfTestSummary(summary) {
  if (!summary) return null;
  return {
    mean: getGpuSummaryMean(summary),
    std: summary.std,
    min: summary.min,
    max: summary.max,
  };
}

function validateGpuSelfTestSummary(label, summary, failures) {
  let mean = getGpuSummaryMean(summary);
  if (!summary || !Number.isFinite(mean)) {
    failures.push(`${label}: missing GPU summary`);
    return;
  }
  if (label === 'done') {
    if (mean !== 1 || summary.min !== 1 || summary.max !== 1) {
      failures.push(`done-state ${JSON.stringify(compactGpuSelfTestSummary(summary))}`);
    }
    return;
  }
  if (label === 'double') {
    if (mean < 4 || mean > 25 || summary.max > 64) {
      failures.push(`double-state ${JSON.stringify(compactGpuSelfTestSummary(summary))}`);
    }
    return;
  }
  if (label === 'initial') {
    if (mean < 1200 || mean > 2200 || summary.max > 2700) {
      failures.push(`initial-state ${JSON.stringify(compactGpuSelfTestSummary(summary))}`);
    }
  }
}

async function verifyGpuEngineOnLoad(tables) {
  if (!window.gpuRolloutWorkbench || typeof window.gpuRolloutWorkbench.runGpu !== 'function') {
    return { ok: false, reason: 'GPU workbench is unavailable.' };
  }
  let seed = 0x4d4f4231;
  let cases = [
    { label: 'done', state: createGpuSelfTestState({ diceUse: 100, isDouble: 0 }), rolloutCount: 64, seed: seed ^ 0x44444444 },
    { label: 'double', state: createGpuSelfTestState({ diceUse: 100, isDouble: 1 }), rolloutCount: 256, seed: seed ^ 0x55555555 },
    { label: 'initial', state: createGpuSelfTestState(), rolloutCount: 512, seed: (seed + 512) >>> 0 },
  ];
  let failures = [];
  for (const testCase of cases) {
    let summary = await window.gpuRolloutWorkbench.runGpu({
      tables,
      sample: { state: testCase.state, actionCount: 1 },
      action: 0,
      rolloutCount: testCase.rolloutCount,
      seed: testCase.seed >>> 0,
    });
    validateGpuSelfTestSummary(testCase.label, summary, failures);
  }
  return {
    ok: failures.length === 0,
    reason: failures.join(' / '),
  };
}

function buildGpuTables() {
  if (gpuTablesCache) return gpuTablesCache;
  gpuTablesCache = {
    stageId: stage.map(row => Number(row[1] || 0)),
    stageMove: stage.map(row => Number(row[4] || 0)),
    stageEvent: stage.map(row => Number(row[5] || 0)),
    cardType: [0, ...cardInfo.map(row => Number(row[1] || 0))],
    cardValue: [0, ...cardInfo.map(row => Number(row[2] || 0))],
  };
  return gpuTablesCache;
}

function mergeGpuSummary(acc, summary) {
  if (!summary || summary.count <= 0) return;
  let variance = summary.std * summary.std;
  acc.count += summary.count;
  acc.sum += summary.mean * summary.count;
  acc.sumSq += (variance + summary.mean * summary.mean) * summary.count;
  acc.min = Math.min(acc.min, summary.min);
  acc.max = Math.max(acc.max, summary.max);
}

function getBenchmarkInferenceState() {
  let sample = new Board();
  sample.autoProcess = false;
  [2, 9, 18].forEach(cardIndex => sample.getCard(cardIndex));
  sample.autoProcess = true;
  return sample.getState();
}

function getStateActionCount(state) {
  return 1 + state.slice(7, 12).filter(cardId => cardId !== 0).length;
}

function getStateActiveActions(state) {
  return Array.from({ length: getStateActionCount(state) }, (_, index) => index);
}

function getAdaptiveProgressPct(actionStats, activeActions, maxIteration) {
  let activeActionSet = new Set(activeActions.map(Number));
  let completed = 0;
  let remaining = 0;
  actionStats.forEach((stat, action) => {
    let count = Math.min(stat.count, maxIteration);
    if (count > 0 || activeActionSet.has(action)) {
      completed += count;
    }
    if (activeActionSet.has(action)) {
      remaining += Math.max(0, maxIteration - count);
    }
  });
  let total = completed + remaining;
  if (total <= 0) return 0;
  return Math.min(99, completed / total * 100);
}

async function warmUpGpuInferenceForState(simulationState, options = {}) {
  if (!window.gpuRolloutWorkbench) return false;
  let isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
  if (isCancelled()) return false;
  let actionCount = getStateActionCount(simulationState);
  let tables = buildGpuTables();
  let sample = { state: simulationState, actionCount: actionCount };
  await window.gpuRolloutWorkbench.runGpuAllActions({
    tables: tables,
    sample: sample,
    rolloutCount: PERF_GPU_WARMUP_ROLLOUTS,
    seed: getGpuRandomSeed(),
  });
  if (isCancelled()) return false;
  await window.gpuRolloutWorkbench.runGpu({
    tables: tables,
    sample: sample,
    action: 0,
    rolloutCount: PERF_GPU_WARMUP_ROLLOUTS,
    seed: getGpuRandomSeed(),
  });
  if (isCancelled()) return false;
  await runGpuInferenceForState(simulationState, 'high', {
    maxPct: PERF_GPU_SETTLE_MAX_PCT,
    disableConfidenceStop: true,
    disablePrune: true,
    isCancelled,
  });
  return !isCancelled();
}

async function calibrateGpuStableChunkForState(tables, sample, options = {}) {
  let isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
  let candidates = [
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS,
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS * 2,
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS * 4,
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS * 8,
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS * 16,
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS * 32,
    PERF_GPU_CALIBRATION_SMALL_ROLLOUTS * 64,
  ];
  let stableRollouts = candidates[0];
  let stableMs = Infinity;
  let limited = false;

  for (const rolloutCount of candidates) {
    if (isCancelled()) return null;
    await waitGpuYield(35);
    if (isCancelled()) return null;
    let startedAt = performance.now();
    try {
      await window.gpuRolloutWorkbench.runGpuAllActions({
        tables: tables,
        sample: sample,
        rolloutCount: rolloutCount,
        seed: getGpuRandomSeed(),
      });
    } catch (error) {
      limited = true;
      break;
    }
    if (isCancelled()) return null;
    let elapsedMs = performance.now() - startedAt;
    if (elapsedMs <= PERF_GPU_STABLE_CHUNK_LIMIT_MS) {
      stableRollouts = rolloutCount;
      stableMs = elapsedMs;
    }
    if (elapsedMs > PERF_GPU_STABLE_CHUNK_TARGET_MS) {
      limited = true;
      break;
    }
  }

  return {
    stableChunkPct: Math.max(1, stableRollouts / GPU_BASE_ITERATION * 100),
    stableChunkMs: stableMs,
    limited,
  };
}

async function calibrateGpuInferenceForState(simulationState, options = {}) {
  if (!window.gpuRolloutWorkbench) return null;
  let isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
  if (isCancelled()) return null;
  let actionCount = getStateActionCount(simulationState);
  let tables = buildGpuTables();
  let sample = { state: simulationState, actionCount: actionCount };

  let smallStartedAt = performance.now();
  await window.gpuRolloutWorkbench.runGpuAllActions({
    tables: tables,
    sample: sample,
    rolloutCount: PERF_GPU_CALIBRATION_SMALL_ROLLOUTS,
    seed: getGpuRandomSeed(),
  });
  if (isCancelled()) return null;
  let smallMs = performance.now() - smallStartedAt;

  await waitGpuYield(60);
  if (isCancelled()) return null;

  let largeStartedAt = performance.now();
  await window.gpuRolloutWorkbench.runGpuAllActions({
    tables: tables,
    sample: sample,
    rolloutCount: PERF_GPU_CALIBRATION_LARGE_ROLLOUTS,
    seed: getGpuRandomSeed(),
  });
  if (isCancelled()) return null;
  let largeMs = performance.now() - largeStartedAt;

  gpuCalibrationProfile = createGpuCalibrationProfile(smallMs, largeMs);
  try {
    let stableChunk = await calibrateGpuStableChunkForState(tables, sample, { isCancelled });
    if (isCancelled()) return null;
    if (stableChunk) {
      tuneGpuProfileForStableChunk(
        gpuCalibrationProfile,
        stableChunk.stableChunkPct,
        stableChunk.stableChunkMs,
        stableChunk.limited,
      );
    }
  } catch (error) {
    console.warn('GPU stable chunk calibration failed.', error);
  }
  applyGpuUsageSettings(computeSettings.gpuUsage || 'medium');
  return gpuCalibrationProfile;
}

async function runGpuInferenceForState(simulationState, gpuUsage, options = {}) {
  let settings = { ...getGpuUsageSettings(gpuUsage), ...(options.settingsPatch || {}) };
  if (options.maxPct !== undefined) settings.gpuMaxPct = options.maxPct;
  let isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
  let adaptiveControl = {
    disableConfidenceStop: options.disableConfidenceStop === true || options.disableEarlyStop === true,
    disablePrune: options.disablePrune === true || options.disableEarlyStop === true,
  };
  let actionCount = getStateActionCount(simulationState);
  let activeActions = getStateActiveActions(simulationState);
  let batchIteration = Math.max(1, Math.floor(settings.gpuIteration * settings.gpuBatchPct / 100));
  let maxIteration = Math.max(1, Math.floor(settings.gpuIteration * settings.gpuMaxPct / 100));
  let fixedFullRun = adaptiveControl.disableConfidenceStop && adaptiveControl.disablePrune;
  let initialIteration = fixedFullRun ? maxIteration : Math.max(1, Math.floor(settings.gpuIteration * 0.1));
  let dispatchTuner = createGpuDispatchTuner(batchIteration, settings);
  let actionStats = new Array(6).fill(0).map(() => createActionStats());
  let tables = buildGpuTables();
  let onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  function reportProgress(done = false) {
    if (!onProgress) return;
    if (done) {
      onProgress(100);
      return;
    }
    onProgress(getAdaptiveProgressPct(actionStats.slice(0, actionCount), activeActions, maxIteration));
  }

  function getMaxActionIteration() {
    return Math.max(0, ...actionStats.map(stat => stat.count));
  }

  async function evaluateGpuBatch(actions, iteration) {
    let sample = { state: simulationState, actionCount: actionCount };
    let remaining = iteration;
    let allActions = actions.length === actionCount && actions.every((action, index) => action === index);
    while (remaining > 0) {
      if (isCancelled()) return false;
      let chunkIteration = dispatchTuner.next(remaining);
      let chunkStartedAt = performance.now();
      if (allActions) {
        let result = await window.gpuRolloutWorkbench.runGpuAllActions({
          tables: tables,
          sample: sample,
          rolloutCount: chunkIteration,
          seed: getGpuRandomSeed(),
        });
        if (isCancelled()) return false;
        actions.forEach(action => mergeGpuSummary(actionStats[action], result.summaries[action]));
      } else {
        let results = await Promise.all(actions.map(action => window.gpuRolloutWorkbench.runGpu({
          tables: tables,
          sample: sample,
          action: action,
          rolloutCount: chunkIteration,
          seed: getGpuRandomSeed(),
        }).then(summary => ({ action, summary }))));

        if (isCancelled()) return false;
        results.forEach(({ action, summary }) => {
          mergeGpuSummary(actionStats[action], { action: action, count: chunkIteration, ...summary });
        });
      }
      dispatchTuner.record(performance.now() - chunkStartedAt, chunkIteration);
      remaining -= chunkIteration;
      reportProgress();
      if (remaining > 0) await waitGpuYield(dispatchTuner.yieldMs);
    }
    return true;
  }

  async function runBatch(actions, iteration) {
    let runnableActions = actions
      .map(Number)
      .filter(action => actionStats[action].count < maxIteration)
      .map(action => ({
        action: action,
        iteration: Math.min(iteration, maxIteration - actionStats[action].count),
      }))
      .filter(job => job.iteration > 0);

    if (runnableActions.length === 0) return false;

    if (adaptiveControl.disablePrune && runnableActions.length === actionCount) {
      let sharedIteration = Math.min(...runnableActions.map(job => job.iteration));
      let canBatchAll = sharedIteration > 0 &&
        runnableActions.every((job, index) => job.action === index && job.iteration === sharedIteration);
      if (canBatchAll) {
        return evaluateGpuBatch(activeActions, sharedIteration);
      }
    }

    for (const job of runnableActions) {
      if (!await evaluateGpuBatch([job.action], job.iteration)) return false;
    }
    return true;
  }

  if (activeActions.length === actionCount) {
    if (!await evaluateGpuBatch(activeActions, initialIteration)) return null;
  } else {
    if (!await runBatch(activeActions, initialIteration)) return null;
  }

  while (true) {
    if (isCancelled()) return null;
    let decision = getAdaptiveDecision(actionStats, activeActions);
    if (shouldStopAdaptive(decision, actionStats, activeActions, maxIteration, adaptiveControl)) {
      reportProgress(true);
      return decision;
    }

    if (!adaptiveControl.disablePrune) {
      activeActions = pruneAdaptiveActions(actionStats, activeActions);
    }
    decision = getAdaptiveDecision(actionStats, activeActions);
    if (!adaptiveControl.disablePrune && activeActions.length <= 1) {
      reportProgress(true);
      return decision;
    }

    let progressed = await runBatch(getAdaptiveNextActions(actionStats, activeActions, maxIteration, adaptiveControl), batchIteration);
    if (isCancelled()) return null;
    if (!progressed || getMaxActionIteration() >= maxIteration) {
      reportProgress(true);
      return getAdaptiveDecision(actionStats, activeActions);
    }
  }
}

function runCpuInferenceForState(simulationState, cpuWorkers, options = {}) {
  return new Promise((resolve, reject) => {
    let requestId = workerReqIndex++;
    let isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
    let activeActions = getStateActiveActions(simulationState);
    let adaptiveControl = {
      disableConfidenceStop: options.disableConfidenceStop === true || options.disableEarlyStop === true,
      disablePrune: options.disablePrune === true || options.disableEarlyStop === true,
    };
    let iteration = computeSettings.cpuIteration;
    let initialIteration = getAdaptiveInitialIteration(iteration);
    let batchIteration = getAdaptiveBatchIteration(iteration);
    let maxIteration = options.maxPct !== undefined
      ? Math.max(1, Math.floor(iteration * options.maxPct / 100))
      : getAdaptiveMaxIteration(iteration, getCpuMaxPctForWorkers(cpuWorkers));
    let actionStats = new Array(6).fill(0).map(() => createActionStats());
    let localWorkers = Array.from({ length: cpuWorkers }, () => new Worker(workerUrl));
    let localRunnings = new Array(cpuWorkers).fill(false);
    let jobQueue = [];
    let pendingJobs = 0;
    let lastDecision = { stop: false, summaries: actionStats.map(getActionSummary), bestAction: undefined, gap: 0, z: 0 };
    let finished = false;
    let onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    function reportProgress(done = false) {
      if (!onProgress) return;
      if (done) {
        onProgress(100);
        return;
      }
      onProgress(getAdaptiveProgressPct(actionStats, activeActions, maxIteration));
    }

    function cleanup() {
      localWorkers.forEach(worker => worker.terminate());
    }

    function cancel() {
      if (finished) return true;
      if (!isCancelled()) return false;
      finished = true;
      cleanup();
      reject(new Error('cancelled'));
      return true;
    }

    function fail(error) {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    }

    function finish(decision) {
      if (cancel()) return;
      if (finished) return;
      finished = true;
      reportProgress(true);
      cleanup();
      resolve(decision);
    }

    function createBatchJobs(actions, batchSize) {
      let jobs = [];
      let chunksPerAction = Math.max(1, Math.ceil(cpuWorkers / Math.max(1, actions.length)));
      let chunkSize = Math.max(1, Math.ceil(batchSize / chunksPerAction));
      actions.forEach(action => {
        let remaining = Math.min(batchSize, maxIteration - actionStats[action].count);
        while (remaining > 0) {
          let jobIteration = Math.min(chunkSize, remaining);
          jobs.push({ action: action, iteration: jobIteration });
          remaining -= jobIteration;
        }
      });
      return jobs;
    }

    function scheduleJobs() {
      if (cancel()) return;
      for (let i = 0; i < localWorkers.length && jobQueue.length > 0; i++) {
        if (localRunnings[i]) continue;
        let job = jobQueue.shift();
        localRunnings[i] = true;
        localWorkers[i].postMessage({
          idx: requestId,
          iteration: job.iteration,
          state: simulationState,
          stage: stage,
          cardInfo: cardInfo,
          route: [job.action],
        });
      }
    }

    function completeJob(workerIndex) {
      if (cancel()) return;
      localRunnings[workerIndex] = false;
      pendingJobs--;
      if (pendingJobs === 0) {
        finishBatch();
      } else {
        scheduleJobs();
      }
    }

    function runBatch(actions, batchSize) {
      if (cancel()) return;
      let jobs = createBatchJobs(actions, batchSize);
      if (jobs.length === 0) {
        finish(lastDecision);
        return;
      }

      jobQueue = jobs;
      pendingJobs = jobQueue.length;
      scheduleJobs();
    }

    function finishBatch() {
      if (cancel()) return;
      lastDecision = getAdaptiveDecision(actionStats, activeActions);
      reportProgress();
      if (shouldStopAdaptive(lastDecision, actionStats, activeActions, maxIteration, adaptiveControl)) {
        finish(lastDecision);
        return;
      }

      if (!adaptiveControl.disablePrune) {
        activeActions = pruneAdaptiveActions(actionStats, activeActions);
      }
      lastDecision = getAdaptiveDecision(actionStats, activeActions);
      if (!adaptiveControl.disablePrune && activeActions.length <= 1) {
        finish(lastDecision);
        return;
      }

      runBatch(getAdaptiveNextActions(actionStats, activeActions, maxIteration, adaptiveControl), batchIteration);
    }

    localWorkers.forEach((worker, workerIndex) => {
      worker.onerror = error => fail(error);
      worker.onmessage = function (e) {
        if (cancel()) return;
        if (e.data.idx !== requestId) return;
        let action = Number(e.data.route);

        if (e.data.res[0] === -1 || e.data.res[0] === undefined) {
          completeJob(workerIndex);
          return;
        }
        if (e.data.res[0] === -2) {
          completeJob(workerIndex);
          return;
        }

        mergeActionStats(actionStats[action], e.data.res[1], action);
        completeJob(workerIndex);
      };
    });

    runBatch(activeActions, initialIteration);
  });
}

async function measureComputePerfOptions(gpuAvailable, cpuWorkerCandidates) {
  if (computePerfBenchmarkRunning) return;
  let benchmarkId = ++computePerfBenchmarkId;
  let isBenchmarkActive = () => computePerfBenchmarkRunning && benchmarkId === computePerfBenchmarkId;
  computePerfBenchmarkRunning = true;
  try {
    let benchmarkState = getBenchmarkInferenceState();
    let gpuOptions = gpuAvailable ? ['low', 'medium', 'high'] : [];
    let cpuOptions = cpuWorkerCandidates.map(value => String(value));
    computePerfRecommendations = { gpu: null, cpu: null, engine: null };
    updateComputeEngineCards();
    updateComputeOptionCards('gpu');
    updateComputeOptionCards('cpu');

    gpuOptions.forEach(option => setComputePerfRunning('gpu', option, 0));
    cpuOptions.forEach(option => setComputePerfRunning('cpu', option, 0));
    if (gpuOptions.length > 0) {
      try {
        await warmUpGpuInferenceForState(benchmarkState, { isCancelled: () => !isBenchmarkActive() });
        if (!isBenchmarkActive()) return;
        await calibrateGpuInferenceForState(benchmarkState, { isCancelled: () => !isBenchmarkActive() });
        if (!isBenchmarkActive()) return;
      } catch (error) {
        if (!isBenchmarkActive()) return;
        console.warn('GPU perf warm-up failed.', error);
      }
    }

    for (let index = 0; index < gpuOptions.length; index++) {
      if (!isBenchmarkActive()) return;
      let option = gpuOptions[index];
      setComputePerfRunning('gpu', option, 0);
      try {
        let elapsedMs = await measureGpuPerfOption(benchmarkState, option, isBenchmarkActive);
        if (!isBenchmarkActive()) return;
        if (elapsedMs === null) return;
        recordComputePerf('gpu', option, elapsedMs, { replace: true });
      } catch (error) {
        if (!isBenchmarkActive()) return;
        console.warn('GPU perf measurement failed.', option, error);
        setComputePerfError('gpu', option);
      }
      if (index < gpuOptions.length - 1) await waitGpuYield(PERF_BENCHMARK_COOLDOWN_MS);
    }
    computePerfRecommendations.gpu = getBestMeasuredComputeOption('gpu', gpuOptions);
    updateComputeOptionCards('gpu');

    for (let index = 0; index < cpuOptions.length; index++) {
      if (!isBenchmarkActive()) return;
      let option = cpuOptions[index];
      setComputePerfRunning('cpu', option, 0);
      try {
        let workerTotal = Math.max(1, Math.min(maxWorkerCount, Number(option) || maxWorkerCount));
        let startedAt = performance.now();
        await runCpuInferenceForState(benchmarkState, workerTotal, {
          maxPct: PERF_BENCHMARK_MAX_PCT,
          disableConfidenceStop: true,
          disablePrune: true,
          isCancelled: () => !isBenchmarkActive(),
          onProgress: pct => {
            if (isBenchmarkActive()) setComputePerfProgress('cpu', option, pct);
          },
        });
        if (!isBenchmarkActive()) return;
        recordComputePerf('cpu', option, performance.now() - startedAt, { replace: true });
      } catch (error) {
        if (!isBenchmarkActive()) return;
        console.warn('CPU perf measurement failed.', option, error);
        setComputePerfError('cpu', option);
      }
      if (index < cpuOptions.length - 1) await waitGpuYield(PERF_BENCHMARK_COOLDOWN_MS);
    }
    computePerfRecommendations.cpu = getBestMeasuredComputeOption('cpu', cpuOptions);
    updateComputeOptionCards('cpu');
    computePerfRecommendations.engine = getRecommendedComputeEngine();
    updateComputeEngineCards();
  } finally {
    if (benchmarkId === computePerfBenchmarkId) {
      computePerfBenchmarkRunning = false;
      updateComputeOverallProgressUI();
    }
  }
}

function getGpuPerfMeasurementFallbackPatch(option) {
  let batchPct = option === 'high' ? 16 : option === 'medium' ? 12 : 8;
  return {
    gpuBatchPct: batchPct,
    targetChunkMs: option === 'high' ? 260 : 180,
    yieldMs: option === 'high' ? 45 : 90,
    cooldownRatio: 0,
    initialChunkPct: 100,
    minChunkPct: 100,
  };
}

function applyGpuPerfMeasurementFallback(option) {
  if (!gpuCalibrationProfile || !gpuCalibrationProfile.options || !gpuCalibrationProfile.options[option]) return;
  Object.assign(gpuCalibrationProfile.options[option], getGpuPerfMeasurementFallbackPatch(option));
  if ((computeSettings.gpuUsage || 'medium') === option) {
    applyGpuUsageSettings(option);
  }
}

async function measureGpuPerfOption(benchmarkState, option, isBenchmarkActive) {
  let startedAt = performance.now();
  try {
    await runGpuInferenceForState(benchmarkState, option, {
      maxPct: PERF_BENCHMARK_MAX_PCT,
      disableConfidenceStop: true,
      disablePrune: true,
      isCancelled: () => !isBenchmarkActive(),
      onProgress: pct => {
        if (isBenchmarkActive()) setComputePerfProgress('gpu', option, pct);
      },
    });
    if (!isBenchmarkActive()) return null;
    return performance.now() - startedAt;
  } catch (error) {
    if (!isBenchmarkActive()) return null;
    console.warn('GPU perf measurement retrying with conservative chunk.', option, error);
    if (window.gpuRolloutWorkbench && typeof window.gpuRolloutWorkbench.resetGpuContext === 'function') {
      window.gpuRolloutWorkbench.resetGpuContext();
    }
  }

  setComputePerfRunning('gpu', option, 0);
  await waitGpuYield(PERF_BENCHMARK_COOLDOWN_MS);
  startedAt = performance.now();
  await runGpuInferenceForState(benchmarkState, option, {
    maxPct: PERF_BENCHMARK_MAX_PCT,
    disableConfidenceStop: true,
    disablePrune: true,
    settingsPatch: getGpuPerfMeasurementFallbackPatch(option),
    isCancelled: () => !isBenchmarkActive(),
    onProgress: pct => {
      if (isBenchmarkActive()) setComputePerfProgress('gpu', option, pct);
    },
  });
  if (!isBenchmarkActive()) return null;
  let elapsedMs = performance.now() - startedAt;
  applyGpuPerfMeasurementFallback(option);
  return elapsedMs;
}

function resetWorkers() {
  workers.forEach(worker => worker.terminate());
  workers = [];
  workerRunnings = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(new Worker(workerUrl));
    workerRunnings.push(false);
  }
}

function getAdaptiveInitialIteration(iteration) {
  iteration = Math.max(1, Math.floor(Number(iteration) || 1));
  return Math.max(1, Math.floor(iteration * ADAPTIVE_INITIAL_RATIO));
}

function getAdaptiveBatchIteration(iteration) {
  iteration = Math.max(1, Math.floor(Number(iteration) || 1));
  return Math.max(1, Math.floor(iteration * ADAPTIVE_BATCH_RATIO));
}

function getAdaptiveMaxIteration(iteration, maxPct) {
  iteration = Math.max(1, Math.floor(Number(iteration) || 1));
  let pct = maxPct !== undefined ? Math.max(1, Number(maxPct) || 1) : ADAPTIVE_MAX_RATIO * 100;
  return Math.max(1, Math.floor(iteration * pct / 100));
}

function isAdaptiveEarlyStopDisabled() {
  let params = new URLSearchParams(window.location.search);
  return params.get('noEarlyStop') === '1';
}

function normalizeAdaptiveControl(control) {
  if (typeof control === 'boolean') {
    return { disableConfidenceStop: control, disablePrune: control };
  }
  let urlDisabled = isAdaptiveEarlyStopDisabled();
  return {
    disableConfidenceStop: control && control.disableConfidenceStop !== undefined ? control.disableConfidenceStop : urlDisabled,
    disablePrune: control && control.disablePrune !== undefined ? control.disablePrune : urlDisabled,
  };
}

function shouldStopAdaptive(decision, actionStats, activeActions, maxIteration, control) {
  let adaptiveControl = normalizeAdaptiveControl(control);
  return activeActions.every(action => actionStats[action].count >= maxIteration) ||
    (!adaptiveControl.disableConfidenceStop && decision.stop);
}

function getAdaptiveNextActions(actionStats, activeActions, maxIteration, control) {
  let adaptiveControl = normalizeAdaptiveControl(control);
  if (adaptiveControl.disablePrune) {
    return activeActions.filter(action => actionStats[action].count < maxIteration);
  }
  return getAdaptiveSampleActions(actionStats, activeActions, maxIteration);
}

function createActionStats() {
  return { count: 0, sum: 0, sumSq: 0, min: Infinity, max: -Infinity, scoreCounts: new Uint32Array(2899), scoreCountTotal: 0 };
}

function mergeActionStats(acc, batch, action) {
  let count = batch.count[action] || 0;
  if (count === 0) return;
  acc.count += count;
  acc.sum += batch.sum[action] || 0;
  acc.sumSq += batch.sumSq[action] || 0;
  acc.min = Math.min(acc.min, batch.min[action]);
  acc.max = Math.max(acc.max, batch.max[action]);
  if (batch.scoreCounts && batch.scoreCounts[action]) {
    let counts = batch.scoreCounts[action];
    if (counts.length > 0 && Array.isArray(counts[0])) {
      counts.forEach(([score, scoreCount]) => {
        if (score >= 0 && score < acc.scoreCounts.length) {
          acc.scoreCounts[score] += scoreCount;
          acc.scoreCountTotal += scoreCount;
        }
      });
    } else {
      for (let score = 0; score < counts.length; score++) {
        acc.scoreCounts[score] += counts[score];
        acc.scoreCountTotal += counts[score];
      }
    }
  } else if (batch.scores && batch.scores[action]) {
    batch.scores[action].forEach(score => {
      if (score >= 0 && score < acc.scoreCounts.length) {
        acc.scoreCounts[score]++;
        acc.scoreCountTotal++;
      }
    });
  }
}

function getMedianFromCounts(scoreCounts, count) {
  if (count === 0) return 0;
  let leftTarget = Math.floor((count + 1) / 2);
  let rightTarget = Math.floor((count + 2) / 2);
  let seen = 0;
  let leftValue;
  for (let score = 0; score < scoreCounts.length; score++) {
    seen += scoreCounts[score];
    if (leftValue === undefined && seen >= leftTarget) {
      leftValue = score;
    }
    if (seen >= rightTarget) {
      return (leftValue + score) / 2;
    }
  }
  return 0;
}

function getActionSummary(acc) {
  if (acc.count === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, std: 0, se: Infinity, mid: 0 };
  }
  let avg = acc.sum / acc.count;
  let variance = Math.max(0, acc.sumSq / acc.count - avg * avg);
  let std = Math.sqrt(variance);
  return {
    count: acc.count,
    avg: avg,
    min: acc.min,
    max: acc.max,
    std: std,
    se: Math.sqrt(variance / acc.count),
    mid: acc.scoreCountTotal > 0 ? getMedianFromCounts(acc.scoreCounts, acc.count) : avg,
  };
}

function getAdaptiveDecision(actionStats, activeActions) {
  let summaries = actionStats.map(getActionSummary);
  let candidates = activeActions
    .filter(action => actionStats[action].count > 0)
    .map(action => ({ action: action, ...summaries[action] }))
    .sort((a, b) => b.avg - a.avg);

  if (candidates.length <= 1) {
    return { stop: true, summaries: summaries, bestAction: candidates.length > 0 ? candidates[0].action : 0, gap: Infinity, z: Infinity };
  }

  let best = candidates[0];
  let second = candidates[1];
  let gap = best.avg - second.avg;
  let combinedSe = Math.sqrt(best.se * best.se + second.se * second.se);
  let z = combinedSe > 0 ? gap / combinedSe : Infinity;
  let bestLcb = best.avg - ADAPTIVE_BOUND_Z * best.se;
  let maxOtherUcb = Math.max(...candidates.slice(1).map(candidate => candidate.avg + ADAPTIVE_BOUND_Z * candidate.se));
  return {
    stop: bestLcb > maxOtherUcb,
    summaries: summaries,
    bestAction: best.action,
    gap: gap,
    z: z,
  };
}

function pruneAdaptiveActions(actionStats, activeActions) {
  if (activeActions.length <= 2) {
    return activeActions;
  }

  let summaries = actionStats.map(getActionSummary);
  let candidates = activeActions
    .filter(action => actionStats[action].count > 0)
    .map(action => ({ action: action, ...summaries[action] }))
    .sort((a, b) => b.avg - a.avg);

  if (candidates.length <= 2) {
    return activeActions;
  }

  let best = candidates[0];
  let bestLcb = best.avg - ADAPTIVE_BOUND_Z * best.se;
  let keepActions = new Set([best.action]);
  for (let i = 1; i < candidates.length; i++) {
    let candidate = candidates[i];
    let candidateUcb = candidate.avg + ADAPTIVE_BOUND_Z * candidate.se;
    if (candidateUcb >= bestLcb) {
      keepActions.add(candidate.action);
    }
  }

  return activeActions.filter(action => keepActions.has(action));
}

function getAdaptiveSampleActions(actionStats, activeActions, maxIteration) {
  let summaries = actionStats.map(getActionSummary);
  let candidates = activeActions
    .filter(action => actionStats[action].count > 0 && actionStats[action].count < maxIteration)
    .map(action => ({ action: action, ...summaries[action] }))
    .sort((a, b) => b.avg - a.avg);

  if (candidates.length <= 1) {
    return candidates.map(candidate => candidate.action);
  }

  let best = candidates[0];
  let bestLcb = best.avg - ADAPTIVE_BOUND_Z * best.se;
  let sampleActions = candidates
    .filter(candidate => candidate.action === best.action || candidate.avg + ADAPTIVE_BOUND_Z * candidate.se >= bestLcb)
    .map(candidate => candidate.action)
    .sort((a, b) => actionStats[a].count - actionStats[b].count)
    .slice(0, ADAPTIVE_SAMPLE_LIMIT);

  if (actionStats[best.action].count < maxIteration && !sampleActions.includes(best.action)) {
    sampleActions.push(best.action);
  }

  return sampleActions;
}

async function calcExGpu(activeActions, displayActions, simulationState, requestId) {
  let actionCount = env.cards.length + 1;
  let initialIteration = Math.max(1, Math.floor(computeSettings.gpuIteration * 0.1));
  let batchIteration = Math.max(1, Math.floor(computeSettings.gpuIteration * computeSettings.gpuBatchPct / 100));
  let maxIteration = Math.max(1, Math.floor(computeSettings.gpuIteration * computeSettings.gpuMaxPct / 100));
  let dispatchTuner = createGpuDispatchTuner(batchIteration, computeSettings);
  let actionStats = new Array(6).fill(0).map(() => createActionStats());
  let tables = buildGpuTables();
  let requestStartedAt = performance.now();
  let recordedPerf = false;
  setComputePerfRunning('gpu', computeSettings.gpuUsage || 'medium');

  function isCurrentRequest() {
    return isCalcExRequestActive(requestId);
  }

  function recordGpuPerfOnce() {
    if (recordedPerf || !isCurrentRequest()) return;
    recordedPerf = true;
    recordComputePerf('gpu', computeSettings.gpuUsage || 'medium', performance.now() - requestStartedAt);
  }

  function getMaxActionIteration() {
    return Math.max(0, ...actionStats.map(stat => stat.count));
  }

  function applySummaries(decision) {
    if (!isCurrentRequest()) return;
    displayActions.forEach(action => {
      let summary = decision.summaries[action];
      env.exScores[action] = summary.avg;
      env.exValues.min[action] = summary.min;
      env.exValues.max[action] = summary.max;
      env.exValues.mid[action] = summary.mid;
      env.exValues.std[action] = parseFloat(summary.std.toFixed(3));
      env.exValues.count[action] = summary.count;
      env.exValues.se[action] = parseFloat(summary.se.toFixed(3));
    });
    applyExHighlights(decision);

  }

  function applyExHighlights(decision) {
    if (!isCurrentRequest()) return;
    env.exHighlights = new Array(6).fill(false);
    env.exAction = decision.bestAction;

    if (decision.bestAction === undefined) {
      env.exScore = Infinity;
      return;
    }

    let best = decision.summaries[decision.bestAction];
    env.exScore = best.avg;
    let activeActionSet = new Set(activeActions);
    displayActions.forEach(action => {
      let summary = decision.summaries[action];
      env.exValues.status[action] = action === decision.bestAction ? 'best' : activeActionSet.has(action) ? 'active' : 'pruned';
      if (summary.count === 0 && actionStats[action].count === 0) {
        env.exValues.gap[action] = 0;
        env.exValues.z[action] = 0;
        return;
      }
      let gap = best.avg - summary.avg;
      let combinedSe = Math.sqrt(best.se * best.se + summary.se * summary.se);
      env.exValues.gap[action] = parseFloat(gap.toFixed(3));
      env.exValues.z[action] = combinedSe > 0 && isFinite(combinedSe) ? parseFloat((gap / combinedSe).toFixed(3)) : 0;
    });
    activeActions.forEach(action => {
      let summary = decision.summaries[action];
      let gap = best.avg - summary.avg;
      env.exHighlights[action] = action === decision.bestAction || gap <= calcHighlightMargin(getMaxActionIteration(), best, summary);
    });
  }

  async function evaluateGpuBatch(actions, iteration) {
    let sample = { state: simulationState, actionCount: actionCount };
    let remaining = iteration;
    let allActions = actions.length === actionCount && actions.every((action, index) => action === index);
    while (remaining > 0) {
      if (!isCurrentRequest()) return false;
      let chunkIteration = dispatchTuner.next(remaining);
      let chunkStartedAt = performance.now();
      if (allActions) {
        let result = await window.gpuRolloutWorkbench.runGpuAllActions({
          tables: tables,
          sample: sample,
          rolloutCount: chunkIteration,
          seed: getGpuRandomSeed(),
        });
        if (!isCurrentRequest()) return false;
        actions.forEach(action => mergeGpuSummary(actionStats[action], result.summaries[action]));
      } else {
        let results = await Promise.all(actions.map(action => window.gpuRolloutWorkbench.runGpu({
          tables: tables,
          sample: sample,
          action: action,
          rolloutCount: chunkIteration,
          seed: getGpuRandomSeed(),
        }).then(summary => ({ action, summary }))));

        if (!isCurrentRequest()) return false;
        results.forEach(({ action, summary }) => {
          mergeGpuSummary(actionStats[action], { action: action, count: chunkIteration, ...summary });
        });
      }
      dispatchTuner.record(performance.now() - chunkStartedAt, chunkIteration);
      remaining -= chunkIteration;
      if (remaining > 0) await waitGpuYield(dispatchTuner.yieldMs);
    }
    return true;
  }

  async function runBatch(actions, iteration) {
    let runnableActions = actions
      .map(Number)
      .filter(action => actionStats[action].count < maxIteration)
      .map(action => ({
        action: action,
        iteration: Math.min(iteration, maxIteration - actionStats[action].count),
      }))
      .filter(job => job.iteration > 0);

    if (runnableActions.length === 0) return false;

    for (const job of runnableActions) {
      if (!isCurrentRequest()) return false;
      let completed = await evaluateGpuBatch([job.action], job.iteration);
      if (!completed) return false;
    }
    return true;
  }

  try {
    console.time('GPU simulation');
    if (!isCurrentRequest()) return;
    env.exAction = undefined;
    env.exScore = Infinity;
    updateBoard();

    let initialAllActions = activeActions.length === actionCount && activeActions.every((action, index) => action === index);
    if (initialAllActions) {
      let completed = await evaluateGpuBatch(activeActions, initialIteration);
      if (!completed || !isCurrentRequest()) return;
    } else {
      let completed = await runBatch(activeActions, initialIteration);
      if (!completed || !isCurrentRequest()) return;
    }

    while (true) {
      if (!isCurrentRequest()) return;
      let decision = getAdaptiveDecision(actionStats, activeActions);
      applySummaries(decision);
      updateBoard();

      if (shouldStopAdaptive(decision, actionStats, activeActions, maxIteration)) {
        env.exAction = decision.bestAction;
        recordGpuPerfOnce();
        console.timeEnd('GPU simulation');
        console.log('gpu adaptive used ' + getMaxActionIteration() + '/' + computeSettings.gpuIteration + ', elapsed=' + (performance.now() - requestStartedAt).toFixed(1) + 'ms');
        updateBoard();
        return;
      }

      if (!isAdaptiveEarlyStopDisabled()) {
        activeActions = pruneAdaptiveActions(actionStats, activeActions);
      }
      decision = getAdaptiveDecision(actionStats, activeActions);
      applySummaries(decision);
      updateBoard();

      if (!isAdaptiveEarlyStopDisabled() && activeActions.length <= 1) {
        env.exAction = decision.bestAction;
        recordGpuPerfOnce();
        console.timeEnd('GPU simulation');
        updateBoard();
        return;
      }

      let sampleActions = getAdaptiveNextActions(actionStats, activeActions, maxIteration);
      let progressed = await runBatch(sampleActions, batchIteration);
      if (!isCurrentRequest()) return;
      if (!progressed) {
        env.exAction = decision.bestAction;
        recordGpuPerfOnce();
        console.timeEnd('GPU simulation');
        updateBoard();
        return;
      }
    }
  } catch (error) {
    if (!isCurrentRequest()) return;
    console.warn('GPU simulation failed.', error);
    if (window.gpuRolloutWorkbench && typeof window.gpuRolloutWorkbench.resetGpuContext === 'function') {
      window.gpuRolloutWorkbench.resetGpuContext();
    }
    displayActions.forEach(action => {
      env.exScores[action] = 'GPU Error';
      env.exValues.status[action] = 'error';
    });
    env.exAction = undefined;
    env.exScore = Infinity;
    updateBoard();
  }
}

function calcEx(r = [0, 1, 2, 3, 4, 5]) {
  if (!computeModeReady) {
    pendingInitialCalc = true;
    return;
  }
  let calcRequestId = beginCalcExRequest();
  if (env.autoProcess) {
    showDiceOverlay = false;
    diceOverlayHoverIndex = -1;
    isDraggingCharacter = false;
    characterDragTargetScore = null;
    characterDragStartScore = null;
  }
  restorePredictionInteractionFromLastPointer({ update: false });
  env.exScores = new Array(6).fill(0);
  env.exHighlights = new Array(6).fill(false);
  env.exValues = {
    min: new Array(6).fill(0),
    max: new Array(6).fill(0),
    std: new Array(6).fill(0),
    mid: new Array(6).fill(0),
    count: new Array(6).fill(0),
    se: new Array(6).fill(0),
    gap: new Array(6).fill(0),
    z: new Array(6).fill(0),
    status: new Array(6).fill(''),
  };
  let activeActions = [];
  for (let i = 0; i < 6; i++) {
    if (i === 0 || env.cards[i - 1] !== undefined && r.includes(i)) {
      activeActions.push(i);
      env.exScores[i] = '\uACC4\uC0B0\uC911...';
      env.exHighlights[i] = false;
      env.exValues.min[i] = 0;
      env.exValues.max[i] = 0;
      env.exValues.std[i] = 0;
      env.exValues.mid[i] = 0;
      env.exValues.count[i] = 0;
      env.exValues.se[i] = 0;
      env.exValues.gap[i] = 0;
      env.exValues.z[i] = 0;
      env.exValues.status[i] = '계산중';
    }
  }

  if (activeActions.length === 0) {
    if (isCalcExRequestActive(calcRequestId)) updateBoard();
    return;
  }

  if (isCalcExRequestActive(calcRequestId)) updateBoard();

  if (computeSettings.engine === 'gpu' && isGpuAvailable()) {
    calcExGpu(activeActions, activeActions.slice(), env.getState(), calcRequestId);
    return;
  }

  let requestStartedAt = performance.now();
  workerIteration = computeSettings.cpuIteration;
  workerCount = Math.max(1, Math.min(maxWorkerCount, Number(computeSettings.cpuWorkers) || maxWorkerCount));
  computeSettings.cpuMaxPct = getCpuMaxPctForWorkers(workerCount);
  setComputePerfRunning('cpu', String(workerCount));

  let requestId = workerReqIndex++;
  resetWorkers();
  let simulationState = env.getState();
  let displayActions = activeActions.slice();
  let initialIteration = getAdaptiveInitialIteration(workerIteration);
  let batchIteration = getAdaptiveBatchIteration(workerIteration);
  let maxIteration = getAdaptiveMaxIteration(workerIteration, computeSettings.cpuMaxPct);
  let jobQueue = [];
  let pendingJobs = 0;
  let actionStats = new Array(6).fill(0).map(() => createActionStats());
  let lastDecision = { stop: false, summaries: actionStats.map(getActionSummary), bestAction: undefined, gap: 0, z: 0 };

  function applySummaries(decision) {
    if (!isCalcExRequestActive(calcRequestId)) return;
    displayActions.forEach(action => {
      let summary = decision.summaries[action];
      env.exScores[action] = summary.avg;
      env.exValues.min[action] = summary.min;
      env.exValues.max[action] = summary.max;
      env.exValues.mid[action] = summary.mid;
      env.exValues.std[action] = parseFloat(summary.std.toFixed(3));
      env.exValues.count[action] = summary.count;
      env.exValues.se[action] = parseFloat(summary.se.toFixed(3));
    });
    applyExHighlights(decision);

  }

  function finishCalc(decision) {
    if (!isCalcExRequestActive(calcRequestId)) return;
    applySummaries(decision);
    env.exAction = decision.bestAction;
    recordComputePerf('cpu', String(workerCount), performance.now() - requestStartedAt);
    console.timeEnd(workerIteration + ' simulation');
    console.log('adaptive simulation used ' + getMaxActionIteration() + '/' + workerIteration + ', gap=' + decision.gap.toFixed(3) + ', z=' + decision.z.toFixed(3));
    updateBoard();
  }

  function applyExHighlights(decision) {
    if (!isCalcExRequestActive(calcRequestId)) return;
    env.exHighlights = new Array(6).fill(false);
    env.exAction = decision.bestAction;

    if (decision.bestAction === undefined) {
      env.exScore = Infinity;
      return;
    }

    let best = decision.summaries[decision.bestAction];
    env.exScore = best.avg;
    let activeActionSet = new Set(activeActions);
    displayActions.forEach(action => {
      let summary = decision.summaries[action];
      env.exValues.status[action] = action === decision.bestAction ? '추천' : activeActionSet.has(action) ? '후보' : '제외';
      if (summary.count === 0 && actionStats[action].count === 0) {
        env.exValues.gap[action] = 0;
        env.exValues.z[action] = 0;
        return;
      }
      let gap = best.avg - summary.avg;
      let combinedSe = Math.sqrt(best.se * best.se + summary.se * summary.se);
      env.exValues.gap[action] = parseFloat(gap.toFixed(3));
      env.exValues.z[action] = combinedSe > 0 && isFinite(combinedSe) ? parseFloat((gap / combinedSe).toFixed(3)) : 0;
    });
    activeActions.forEach(action => {
      let summary = decision.summaries[action];
      let gap = best.avg - summary.avg;
      env.exHighlights[action] = action === decision.bestAction || gap <= calcHighlightMargin(getMaxActionIteration(), best, summary);
    });
  }

  function getMaxActionIteration() {
    return Math.max(0, ...actionStats.map(stat => stat.count));
  }

  function runBatch(actions, iteration) {
    if (!isCalcExRequestActive(calcRequestId)) return;
    let jobs = createBatchJobs(actions, iteration);
    if (jobs.length === 0) {
      finishCalc(lastDecision);
      return;
    }

    jobQueue = jobs;
    pendingJobs = jobQueue.length;
    scheduleJobs();
  }

  function createBatchJobs(actions, iteration) {
    let jobs = [];
    let chunksPerAction = Math.max(1, Math.ceil(workerCount / Math.max(1, actions.length)));
    let chunkSize = Math.max(1, Math.ceil(iteration / chunksPerAction));
    actions.forEach(action => {
      let remaining = Math.min(iteration, maxIteration - actionStats[action].count);
      while (remaining > 0) {
        let jobIteration = Math.min(chunkSize, remaining);
        jobs.push({ action: action, iteration: jobIteration });
        remaining -= jobIteration;
      }
    });
    return jobs;
  }

  function scheduleJobs() {
    if (!isCalcExRequestActive(calcRequestId)) return;
    for (let i = 0; i < workers.length && jobQueue.length > 0; i++) {
      if (workerRunnings[i]) continue;
      let job = jobQueue.shift();
      workerRunnings[i] = true;
      workers[i].postMessage({
        idx: requestId,
        iteration: job.iteration,
        state: simulationState,
        stage: stage,
        cardInfo: cardInfo,
        route: [job.action],
      });
    }
  }

  function completeJob(workerIndex) {
    if (!isCalcExRequestActive(calcRequestId)) return;
    workerRunnings[workerIndex] = false;
    pendingJobs--;
    if (pendingJobs === 0) {
      finishBatch();
    } else {
      scheduleJobs();
    }
  }

  function finishBatch() {
    if (!isCalcExRequestActive(calcRequestId)) return;
    lastDecision = getAdaptiveDecision(actionStats, activeActions);
    applySummaries(lastDecision);
    updateBoard();
    if (shouldStopAdaptive(lastDecision, actionStats, activeActions, maxIteration)) {
      finishCalc(lastDecision);
    } else {
      if (!isAdaptiveEarlyStopDisabled()) {
        activeActions = pruneAdaptiveActions(actionStats, activeActions);
      }
      lastDecision = getAdaptiveDecision(actionStats, activeActions);
      applySummaries(lastDecision);
      updateBoard();
      if (!isAdaptiveEarlyStopDisabled() && activeActions.length <= 1) {
        finishCalc(lastDecision);
      } else {
        runBatch(getAdaptiveNextActions(actionStats, activeActions, maxIteration), batchIteration);
      }
    }
  }

  workers.forEach((worker, workerIndex) => {
    worker.onmessage = function (e) {
      if (e.data.idx !== requestId || !isCalcExRequestActive(calcRequestId)) return;
      let action = Number(e.data.route);

      switch (e.data.res[0]) {
        case undefined:
        case -1:
          env.exScores[action] = String(env.exScores[action]).replace('\uACC4\uC0B0\uC911...', 'Error');
          completeJob(workerIndex);
          updateBoard();
          return;
        case -2:
          env.exScores[action] = env.score;
          completeJob(workerIndex);
          updateBoard();
          return;
      }

      mergeActionStats(actionStats[action], e.data.res[1], action);
      completeJob(workerIndex);
    };
  });

  console.time(workerIteration + ' simulation');
  if (!isCalcExRequestActive(calcRequestId)) return;
  env.exAction = undefined;
  env.exScore = Infinity;
  updateBoard();
  runBatch(activeActions, initialIteration);
}

function calcHighlightMargin(iteration, bestSummary, candidateSummary) {
  if (bestSummary && candidateSummary) {
    let combinedSe = Math.sqrt(bestSummary.se * bestSummary.se + candidateSummary.se * candidateSummary.se);
    if (isFinite(combinedSe)) {
      return ADAPTIVE_HIGHLIGHT_Z * combinedSe;
    }
  }

  iteration = Math.max(1, Number(iteration) || 1);
  return Math.max(1, 95 / Math.sqrt(iteration));
}

function getBoardInfo() {
  env = new Board();
  imagesPreload();
}

function hideLoadingOverlay() {
  let loading = document.getElementById('adventure-loading');
  if (loading && loading.parentNode) {
    loading.parentNode.removeChild(loading);
  }
}

function showComputeModeModal(onDone) {
  hideLoadingOverlay();
  let existing = document.getElementById('adventure-compute-modal');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  let gpuAvailable = isGpuAvailable();
  let root = document.createElement('div');
  root.id = 'adventure-compute-modal';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '10000';
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'center';
  root.style.background = 'rgba(15, 23, 42, 0.62)';
  root.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.boxSizing = 'border-box';
  root.style.padding = '16px';

  let card = document.createElement('div');
  card.dataset.computeCard = 'true';
  card.style.width = 'min(560px, 100%)';
  card.style.maxHeight = 'none';
  card.style.overflow = 'visible';
  card.style.borderRadius = '8px';
  card.style.background = '#ffffff';
  card.style.boxShadow = '0 24px 70px rgba(15, 23, 42, 0.35)';
  card.style.border = '1px solid rgba(15, 23, 42, 0.12)';
  card.style.padding = '22px';
  card.style.boxSizing = 'border-box';

  let cpuWorkerCandidates = [1, Math.ceil(maxWorkerCount / 2), maxWorkerCount]
    .filter((value, index, values) => value >= 1 && values.indexOf(value) === index);
  let defaultCpuWorkers = Math.ceil(maxWorkerCount / 2);
  let selectedCpuWorkers = Math.max(1, Math.min(maxWorkerCount, Number(computeSettings.cpuWorkers) || defaultCpuWorkers));
  if (!cpuWorkerCandidates.includes(selectedCpuWorkers)) {
    cpuWorkerCandidates.push(selectedCpuWorkers);
    cpuWorkerCandidates.sort((a, b) => a - b);
  }
  let selectedGpuUsage = computeSettings.gpuUsage || 'medium';
  let gpuCardDetail = gpuAvailable
    ? 'WebGPU로 rollout batch를 계산합니다. 브라우저/GPU 지원이 필요하지만 추론 시간과 응답 속도 면에서 유리합니다.'
    : '호환되지 않는 GPU로 감지되어 이 기기에서는 GPU 엔진을 사용할 수 없습니다.';
  let gpuCardBadge = gpuAvailable
    ? '<span data-engine-recommend-badge style="display:none;align-items:center;border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:700;padding:2px 7px;">추천</span>'
    : '<span style="display:inline-flex;align-items:center;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:800;padding:2px 7px;">사용 불가</span>';
  let gpuCardStyle = gpuAvailable
    ? 'display:block;border:1px solid #2563eb;border-radius:8px;padding:12px;cursor:pointer;background:#eff6ff;'
    : 'display:block;border:1px solid #fecaca;border-radius:8px;padding:12px;cursor:not-allowed;background:#fff1f2;opacity:0.9;';
  let cpuWorkerCards = cpuWorkerCandidates.map(value => {
    let label = value === 1 ? '낮음' : (value === maxWorkerCount ? '높음' : '보통');
    let isDefault = value === defaultCpuWorkers;
    let checked = value === selectedCpuWorkers ? ' checked' : '';
    let defaultText = isDefault ? ' (기본값)' : '';
    let detail = value === 1 ? '최소' : (value === maxWorkerCount ? '물리 코어 추정 기준 최대' : '물리 코어 추정 기준 중간');
    return `
      <label data-option-engine="cpu" data-option-key="${value}" style="display:block;border:1px solid #cbd5e1;border-radius:8px;padding:10px;cursor:pointer;background:#f8fafc;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;">
          <span style="display:flex;align-items:center;gap:7px;">
            <input type="radio" name="cpu-workers" value="${value}" data-usage="${label}"${checked}>
            <strong>${label}${defaultText}</strong>
          </span>
          <span data-recommend-badge style="display:none;align-items:center;border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:700;padding:2px 7px;">추천</span>
        </div>
        <div style="font-size:12px;line-height:1.4;color:#334155;">${detail} / worker ${value}개</div>
        <div data-perf-text data-perf-engine="cpu" data-perf-key="${value}" style="font-size:12px;line-height:1.4;color:#64748b;margin-top:5px;">${getComputePerfHtml('cpu', String(value))}</div>
        <div data-perf-progress style="display:none;height:3px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px;">
          <div data-perf-progress-fill style="height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width 120ms linear;"></div>
        </div>
      </label>`;
  }).join('');
  let gpuUsageCards = [
    { key: 'low', label: '낮음', detail: '다른 작업 우선', defaultText: '' },
    { key: 'medium', label: '보통', detail: '균형', defaultText: ' (기본값)' },
    { key: 'high', label: '높음', detail: '빠른 계산 우선', defaultText: '' },
  ].map(option => `
      <label data-option-engine="gpu" data-option-key="${option.key}" style="display:block;border:1px solid #cbd5e1;border-radius:8px;padding:10px;cursor:pointer;background:#f8fafc;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;">
          <span style="display:flex;align-items:center;gap:7px;">
            <input type="radio" name="gpu-usage" value="${option.key}"${option.key === selectedGpuUsage ? ' checked' : ''}>
            <strong>${option.label}${option.defaultText}</strong>
          </span>
          <span data-recommend-badge style="display:none;align-items:center;border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:700;padding:2px 7px;">추천</span>
        </div>
        <div style="font-size:12px;line-height:1.4;color:#334155;">${option.detail}</div>
        <div data-perf-text data-perf-engine="gpu" data-perf-key="${option.key}" style="font-size:12px;line-height:1.4;color:#64748b;margin-top:5px;">${getComputePerfHtml('gpu', option.key)}</div>
        <div data-perf-progress style="display:none;height:3px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px;">
          <div data-perf-progress-fill style="height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width 120ms linear;"></div>
        </div>
      </label>`).join('');

  card.innerHTML = `
    <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:6px;">계산 방식 선택</div>
    <div style="font-size:13px;line-height:1.55;color:#475569;margin-bottom:16px;">
      GPU는 계산 비용과 응답 속도에서 유리합니다. 판단 품질은 유지됩니다. 선택은 주로 실행 비용과 대기 시간을 기준으로 하면 됩니다.
    </div>
    <div id="compute-engine-options" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <label id="compute-gpu-card" style="${gpuCardStyle}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <span style="display:flex;align-items:center;gap:8px;">
            <input type="radio" name="compute-engine" value="gpu" ${gpuAvailable ? 'checked' : 'disabled'}>
            <strong>GPU 계산 엔진</strong>
          </span>
          ${gpuCardBadge}
        </div>
        <div style="font-size:12px;line-height:1.45;color:${gpuAvailable ? '#334155' : '#7f1d1d'};">${gpuCardDetail}</div>
      </label>
      <label id="compute-cpu-card" style="display:block;border:1px solid #cbd5e1;border-radius:8px;padding:12px;cursor:pointer;background:#f8fafc;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <span style="display:flex;align-items:center;gap:8px;">
            <input type="radio" name="compute-engine" value="cpu" ${gpuAvailable ? '' : 'checked'}>
            <strong>CPU 계산 엔진</strong>
          </span>
          <span data-engine-recommend-badge style="display:none;align-items:center;border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:700;padding:2px 7px;">추천</span>
        </div>
        <div style="font-size:12px;line-height:1.45;color:#334155;">기존 worker 계산입니다. 호환성은 좋지만 추론 시간이 길어질 수 있습니다.</div>
      </label>
    </div>
    <div id="gpu-settings" style="margin-bottom:14px;">
      <div style="font-weight:700;color:#0f172a;margin-bottom:6px;">GPU 사용량</div>
      <div id="gpu-usage-options" style="display:grid;grid-template-columns:1fr;gap:8px;">
        ${gpuUsageCards}
      </div>
    </div>
    <div id="cpu-settings" style="margin-bottom:16px;">
      <div style="font-weight:700;color:#0f172a;margin-bottom:6px;">CPU 사용량</div>
      <div id="cpu-worker-options" style="display:grid;grid-template-columns:1fr;gap:8px;">
        ${cpuWorkerCards}
      </div>
    </div>
    <div data-overall-perf-progress style="display:none;margin:0 0 14px 0;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
      <div data-overall-perf-text style="font-size:12px;line-height:1.4;color:#475569;margin-bottom:7px;">추천 항목 계산중입니다. [0%]</div>
      <div style="height:4px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
        <div data-overall-perf-fill style="height:100%;width:0%;background:#16a34a;border-radius:999px;transition:width 120ms linear;"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button id="compute-start" style="border:0;border-radius:6px;padding:9px 14px;background:#2563eb;color:white;font-weight:700;cursor:pointer;">시작</button>
    </div>
  `;

  root.appendChild(card);
  document.body.appendChild(root);
  let computeResizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(scheduleComputeModeModalFit)
    : null;
  if (computeResizeObserver) computeResizeObserver.observe(card);

  let startButton = card.querySelector('#compute-start');

  function getSelectedGpuUsage() {
    return card.querySelector('input[name="gpu-usage"]:checked')?.value || 'medium';
  }

  function getSelectedCpuWorkers() {
    return Math.max(1, Math.min(maxWorkerCount, Number(card.querySelector('input[name="cpu-workers"]:checked')?.value) || defaultCpuWorkers));
  }

  function applyGpuUsage(value) {
    applyGpuUsageSettings(value);
    updateComputeOptionCards('gpu');
  }

  function updateCpuWorkersHelp() {
    let selectedCpu = card.querySelector('input[name="cpu-workers"]:checked');
    let workers = getSelectedCpuWorkers();
    computeSettings.cpuWorkers = workers;
    computeSettings.cpuMaxPct = getCpuMaxPctForWorkers(workers);
    computeSettings.cpuUsage = selectedCpu?.dataset?.usage || '보통';
    updateComputeOptionCards('cpu');
  }

  function updateCards() {
    let selected = card.querySelector('input[name="compute-engine"]:checked')?.value || 'cpu';
    card.querySelector('#gpu-settings').style.display = selected === 'gpu' ? 'block' : 'none';
    card.querySelector('#cpu-settings').style.display = selected === 'cpu' ? 'block' : 'none';
    updateComputeEngineCards();
    scheduleComputeModeModalFit();
  }

  card.querySelectorAll('input[name="compute-engine"]').forEach(input => {
    input.addEventListener('change', updateCards);
  });
  card.querySelectorAll('input[name="gpu-usage"]').forEach(input => {
    input.addEventListener('change', () => applyGpuUsage(getSelectedGpuUsage()));
  });
  card.querySelectorAll('input[name="cpu-workers"]').forEach(input => {
    input.addEventListener('change', updateCpuWorkersHelp);
  });
  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    startButton.style.opacity = '0.7';
    cancelComputePerfBenchmark();
    let selected = card.querySelector('input[name="compute-engine"]:checked')?.value || 'cpu';
    computeSettings.engine = selected === 'gpu' && gpuAvailable ? 'gpu' : 'cpu';
    computeSettings.cpuIteration = 10000;
    computeSettings.cpuWorkers = getSelectedCpuWorkers();
    computeSettings.cpuMaxPct = getCpuMaxPctForWorkers(computeSettings.cpuWorkers);
    workerIteration = computeSettings.cpuIteration;
    applyGpuUsage(getSelectedGpuUsage());
    await waitComputePerfBenchmarkIdle();
    if (computeResizeObserver) computeResizeObserver.disconnect();
    root.remove();
    if (typeof onDone === 'function') onDone();
    if (pendingInitialCalc) {
      pendingInitialCalc = false;
      calcEx();
    }
  });

  applyGpuUsage(getSelectedGpuUsage());
  updateCpuWorkersHelp();
  updateCards();
  updateComputeEngineCards();
  updateComputeOptionCards('gpu');
  updateComputeOptionCards('cpu');
  scheduleComputeModeModalFit();
  if (new URLSearchParams(window.location.search).get('skipPerfBenchmark') !== '1') {
    setTimeout(() => {
      if (!root.isConnected) return;
      computePerfBenchmarkPromise = measureComputePerfOptions(gpuAvailable, cpuWorkerCandidates)
        .catch(error => console.warn('Compute perf benchmark failed.', error))
        .finally(() => {
          computePerfBenchmarkPromise = null;
        });
    }, 0);
  }
}








function closeCardInfoPanelGlobal() {
  try {
    if (typeof showCardInfoYN !== 'undefined' && showCardInfoYN) {
      showCardInfoYN = false;
      if (typeof updateBoard === 'function') {
        updateBoard();
      }
    }
  } catch (e) {}
}

function initUsageOverlay() {
  if (!canvas) return;
  if (document.getElementById('adventure-usage-root')) return;

  var steps = [
    {
      id: 'position',
      title: '위치와 스테이지 이동',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">칸 표시</span>를 클릭하거나 <span style="font-weight:700;color:#1d4ed8;">Ctrl + Q</span>로 현재 칸을 직접 이동합니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">수동 모드</span>에서는 캐릭터 드래그, 좌/우 화살표, 방향키로 위치를 빠르게 바꿀 수 있습니다.' }
      ],
      region: REGION_SCORE,
      extraRegions: [
        function () { return regionCurrentCharacter; },
        {
          x1: REGION_BTN_PREV_STAGE.x1,
          x2: REGION_BTN_NEXT_STAGE.x2,
          y1: Math.min(REGION_BTN_PREV_STAGE.y1, REGION_BTN_NEXT_STAGE.y1),
          y2: Math.max(REGION_BTN_PREV_STAGE.y2, REGION_BTN_NEXT_STAGE.y2)
        }
      ]
    },
    {
      id: 'exScore',
      title: '예상 점수와 계산 설정',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">예상 점수</span> 헤더를 클릭하면 계산 엔진과 사용량을 바꿀 수 있습니다.' },
        { html: '점수 목록에 <span style="font-weight:700;color:#1d4ed8;">마우스를 올리면</span> 6개 case 전체 비교 표를 확인합니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">Ctrl + R</span> 또는 점수 목록 클릭으로 예상 점수를 다시 계산합니다.' }
      ],
      preview: { exScore: true },
      bubblePlacement: 'top',
      region: {
        x1: REGION_BTN_ACCURACY.x1,
        x2: REGION_BTN_EXSCORE.x2,
        y1: REGION_BTN_ACCURACY.y1,
        y2: REGION_BTN_EXSCORE.y2
      },
      detailHtml:
        '<div style="margin-bottom:5px;"><strong style="color:#0f172a;">통계값 의미</strong></div>' +
        '<ul style="margin:0; padding-left:16px; list-style:disc;">' +
        '<li><span style="font-weight:700;color:#1d4ed8;">샘플수</span>: 몇 번 시뮬레이션했는지입니다.</li>' +
        '<li><span style="font-weight:700;color:#1d4ed8;">범위</span>: 나온 결과 중 최저~최고 점수입니다.</li>' +
        '<li><span style="font-weight:700;color:#1d4ed8;">중앙값</span>: 결과를 줄 세웠을 때 가운데 점수입니다.</li>' +
        '<li><span style="font-weight:700;color:#1d4ed8;">신뢰구간</span> <span style="color:#64748b;">(95% CI)</span>: 평균 예상 점수가 어느 정도 흔들릴 수 있는지 보는 참고 범위입니다.</li>' +
        '</ul>' +
        '<div style="margin-top:6px;color:#334155;">' +
        '신뢰구간끼리 많이 겹치면 <span style="font-weight:700;color:#16a34a;">어느 선택이 더 좋은지 아직 애매</span>할 수 있습니다.' +
        '</div>'
    },
    {
      id: 'prediction',
      title: '도착 예측 표시',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">+2~+12 도착 확률</span>은 보드 위에 상시 표시됩니다.' },
        { html: '주사위 버튼이나 카드에 <span style="font-weight:700;color:#1d4ed8;">마우스를 올리면</span> 카드칸, 점프칸, 멈춤칸 확률과 다음 스테이지 미니맵을 볼 수 있습니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">기대값</span>은 즉시 도착 기준 <span style="font-weight:700;color:#1d4ed8;">score/diceUse 변화량</span>이며, 카드 획득의 장기 가치는 제외됩니다.' },
        { html: '확정 이동 카드는 노란 펄스, 주사위형 이동은 분홍 펄스로 표시됩니다.' }
      ],
      preview: { prediction: 'dice' },
      bubblePlacement: 'top',
      region: REGION_STEP
    },
    {
      id: 'stepButton',
      title: '주사위와 직접 이동',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">수동 모드</span>: 주사위 버튼은 더블 여부를 토글합니다.' },
        { html: '왼쪽의 <span style="font-weight:700;color:#1d4ed8;">+2~+12 버튼</span>으로 원하는 칸수만큼 바로 이동할 수 있습니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">자동 모드</span>: 주사위 버튼으로 실제 진행하며, +2~+12 버튼은 비활성화됩니다.' }
      ],
      region: {
        x1: REGION_DICE_MOVE.x1,
        x2: REGION_STEP.x2,
        y1: 436,
        y2: REGION_STEP.y2
      }
    },
    {
      id: 'cardsUse',
      title: '행운 카드',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">카드 슬롯 클릭</span> 또는 <span style="font-weight:700;color:#1d4ed8;">Ctrl + 1~5</span>로 카드를 사용합니다.' },
        { html: '카드 슬롯 <span style="font-weight:700;color:#1d4ed8;">오른쪽 클릭</span>은 이동하지 않고 카드를 버립니다.' },
        { html: '카드에 <span style="font-weight:700;color:#1d4ed8;">마우스를 올리면</span> 이동 후 도착 예측 오버레이가 함께 표시됩니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">Ctrl + G</span>로 이름 일부를 포함하는 키워드로 카드를 바로 획득할 수 있습니다.' }
      ],
      preview: { prediction: 'card' },
      region: REGION_CARDS,
      detailHtml:
        '카드 검색 키워드:<br>' +
        '<span style="font-weight:600;color:#1d4ed8;">+N</span> 또는 <span style="font-weight:600;color:#1d4ed8;">N</span>: 앞으로 N칸<br>' +
        '<span style="font-weight:600;color:#1d4ed8;">-N</span>: 뒤로 N칸<br>' +
        '<span style="font-weight:600;color:#1d4ed8;">*N</span>: 주사위 N배<br>' +
        '<span style="font-weight:600;color:#1d4ed8;">&gt;</span>: 다음 스테이지'
    },
    {
      id: 'cardInfo',
      title: '카드 정보',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">?</span> 버튼으로 카드 획득 정보를 열고 닫습니다.' },
        { html: '목록에서는 클릭으로 획득 여부를 바꾸고, <span style="font-weight:700;color:#1d4ed8;">오른쪽 클릭</span>으로 바로 획득 처리합니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">자동 모드</span>에서는 카드 정보 수정과 강제 획득이 제한됩니다.' }
      ],
      region: REGION_BTN_CARDINFO
    },
    {
      id: 'mode',
      title: '수동 / 자동 모드',
      lines: [
        { html: '<span style="font-weight:700;color:#1d4ed8;">수동 모드</span>는 테스트용으로 위치, 카드, 주사위 사용 횟수를 직접 조정합니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">자동 모드</span>는 실제 진행처럼 주사위와 카드를 자동 판단해 진행합니다.' },
        { html: '<span style="font-weight:700;color:#1d4ed8;">주사위 사용 횟수</span>는 하단 영역 클릭 또는 <span style="font-weight:700;color:#1d4ed8;">Ctrl + E</span>로 수정합니다.' }
      ],
      region: REGION_BTN_CHANGEMODE
    }
  ];

  createUsageOverlayWithSteps(steps);
}

function createUsageOverlayWithSteps(steps) {
  var currentStepIndex = 0;
  var isActive = true;
  var detailOpen = false;
  var bubbleManualPosition = null;
  var bubbleDragState = null;

  var canvasWidth = CANVAS_LOGICAL_WIDTH;
  var canvasHeight = CANVAS_LOGICAL_HEIGHT;

  var root = document.createElement('div');
  root.id = 'adventure-usage-root';
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.zIndex = 'auto';
  root.style.pointerEvents = 'none';

  var dimTop = document.createElement('div');
  var dimLeft = document.createElement('div');
  var dimRight = document.createElement('div');
  var dimBottom = document.createElement('div');
  [dimTop, dimLeft, dimRight, dimBottom].forEach(function (el) {
    el.style.position = 'fixed';
    el.style.background = 'transparent';
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  });

  var maskSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  maskSvg.setAttribute('id', 'adventure-usage-mask');
  maskSvg.style.position = 'fixed';
  maskSvg.style.left = '0';
  maskSvg.style.top = '0';
  maskSvg.style.width = '100vw';
  maskSvg.style.height = '100vh';
  maskSvg.style.pointerEvents = 'none';
  maskSvg.style.zIndex = '9998';

  var maskPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  maskPath.setAttribute('fill', 'rgba(15, 23, 42, 0.72)');
  maskPath.setAttribute('fill-rule', 'evenodd');
  maskSvg.appendChild(maskPath);

  var highlightBox = document.createElement('div');
  highlightBox.id = 'adventure-usage-highlight';
  highlightBox.style.position = 'fixed';
  highlightBox.style.border = '2px solid #38bdf8';
  highlightBox.style.borderRadius = '12px';
  highlightBox.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.35)';
  highlightBox.style.pointerEvents = 'none';
  highlightBox.style.transition = 'box-shadow 0.6s ease';
  highlightBox.style.zIndex = '9999';

  var extraHighlightBoxes = [];
  for (var i = 0; i < 4; i++) {
    var extraBox = document.createElement('div');
    extraBox.style.position = 'fixed';
    extraBox.style.border = '2px solid #38bdf8';
    extraBox.style.borderRadius = '12px';
    extraBox.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.28)';
    extraBox.style.pointerEvents = 'none';
    extraBox.style.zIndex = '9999';
    extraBox.style.display = 'none';
    extraHighlightBoxes.push(extraBox);
  }

  var bubble = document.createElement('div');
  bubble.id = 'adventure-usage-bubble';
  bubble.style.position = 'fixed';
  bubble.style.width = 'min(320px, calc(100vw - 32px))';
  bubble.style.maxWidth = '320px';
  bubble.style.maxHeight = 'none';
  bubble.style.overflow = 'visible';
  bubble.style.scrollbarWidth = 'none';
  bubble.style.msOverflowStyle = 'none';
  bubble.style.background = 'white';
  bubble.style.borderRadius = '14px';
  bubble.style.padding = '14px 16px 12px 16px';
  bubble.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.35)';
  bubble.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  bubble.style.color = '#0f172a';
  bubble.style.fontSize = '13px';
  bubble.style.pointerEvents = 'auto';
  bubble.style.touchAction = 'none';
  bubble.style.userSelect = 'none';
  bubble.style.cursor = 'move';
  bubble.style.zIndex = '10002';

  var bubbleLayer = document.createElement('div');
  bubbleLayer.id = 'adventure-usage-bubble-layer';
  bubbleLayer.style.position = 'fixed';
  bubbleLayer.style.left = '0';
  bubbleLayer.style.top = '0';
  bubbleLayer.style.width = '100%';
  bubbleLayer.style.height = '100%';
  bubbleLayer.style.zIndex = '10002';
  bubbleLayer.style.pointerEvents = 'none';

  if (!document.getElementById('adventure-usage-scrollbar-style')) {
    var scrollbarStyle = document.createElement('style');
    scrollbarStyle.id = 'adventure-usage-scrollbar-style';
    scrollbarStyle.textContent = '#adventure-usage-bubble::-webkit-scrollbar{display:none;}';
    document.head.appendChild(scrollbarStyle);
  }

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
  footer.dataset.noDrag = 'true';
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.marginTop = '4px';
  footer.style.pointerEvents = 'auto';
  footer.style.cursor = 'default';

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
  detailPanel.style.pointerEvents = 'auto';

  var skipConfirm = document.createElement('div');
  skipConfirm.style.position = 'fixed';
  skipConfirm.style.left = '50%';
  skipConfirm.style.top = '50%';
  skipConfirm.style.transform = 'translate(-50%, -50%)';
  skipConfirm.style.background = 'white';
  skipConfirm.style.borderRadius = '14px';
  skipConfirm.style.padding = '12px 16px';
  skipConfirm.style.boxShadow = '0 18px 40px rgba(15,23,42,0.45)';
  skipConfirm.style.fontSize = '12px';
  skipConfirm.style.color = '#111827';
  skipConfirm.style.display = 'none';
  skipConfirm.style.zIndex = '10003';
  skipConfirm.style.pointerEvents = 'auto';
  skipConfirm.style.minWidth = '260px';
  skipConfirm.style.width = 'min(320px, calc(100vw - 32px))';
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
  root.appendChild(maskSvg);
  root.appendChild(highlightBox);
  extraHighlightBoxes.forEach(function (box) {
    root.appendChild(box);
  });
  bubbleLayer.appendChild(bubble);
  bubbleLayer.appendChild(skipConfirm);

  document.body.appendChild(root);
  document.body.appendChild(bubbleLayer);
  var renderFrame = null;
  var canvasResizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(scheduleRenderStep)
    : null;
  if (canvasResizeObserver) canvasResizeObserver.observe(canvas);

  function cleanup() {
    isActive = false;
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    if (canvasResizeObserver) canvasResizeObserver.disconnect();
    if (root && root.parentNode) root.parentNode.removeChild(root);
    if (bubbleLayer && bubbleLayer.parentNode) bubbleLayer.parentNode.removeChild(bubbleLayer);
    clearUsagePreviewState();
    canvas.removeEventListener('click', canvasClickListener, true);
    window.removeEventListener('resize', scheduleRenderStep);
    window.removeEventListener('scroll', scheduleRenderStep, true);
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('pointermove', moveUsageBubbleDrag, true);
    document.removeEventListener('pointerup', endUsageBubbleDrag, true);
    document.removeEventListener('pointercancel', endUsageBubbleDrag, true);
    bubble.removeEventListener('pointerdown', beginUsageBubbleDrag);
    bubble.removeEventListener('pointermove', moveUsageBubbleDrag);
    bubble.removeEventListener('pointerup', endUsageBubbleDrag);
    bubble.removeEventListener('pointercancel', endUsageBubbleDrag);
  }

  function scheduleRenderStep() {
    if (!isActive || renderFrame !== null) return;
    renderFrame = requestAnimationFrame(function () {
      renderFrame = null;
      renderStep();
    });
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

    if (prevStep && nextStep && prevStep.id === 'cardInfoButton' && nextStep.id === 'cardInfoPanel' && !showCardInfoYN) {
      drawCardInfo();
    }

    if (prevStep && nextStep && prevStep.id === 'cardInfoPanel' && nextStep.id === 'cardInfoButton') {
      closeCardInfoPanelGlobal();
    }
    if (prevStep && nextStep && prevStep.id === 'cardGetByName' && nextStep.id === 'mode') {
      closeCardInfoPanelGlobal();
    }

    currentStepIndex = index;
    detailOpen = false;
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

    if (step.id === 'cardInfoPanel' || step.id === 'cardGetByName') {
      if (!isInsideRegion(localX, localY, REGION_CARDINFO)) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      return;
    }
  }

  canvas.addEventListener('click', canvasClickListener, true);

  function resolveUsageRegion(region) {
    return typeof region === 'function' ? region() : region;
  }

  function getStepRegions(step) {
    var regions = [];
    var mainRegion = null;
    if (typeof step.dynamicRegion === 'function') {
      mainRegion = step.dynamicRegion();
    }
    if (!mainRegion && step.region) {
      mainRegion = step.region;
    }
    if (mainRegion) regions.push(mainRegion);

    if (Array.isArray(step.extraRegions)) {
      step.extraRegions.forEach(function (region) {
        var resolved = resolveUsageRegion(region);
        if (resolved) regions.push(resolved);
      });
    }

    return regions;
  }

  function getUsageHighlightRect(region, canvasRect, scaleX, scaleY, pad) {
    var left = canvasRect.left + region.x1 * scaleX - pad;
    var top = canvasRect.top + region.y1 * scaleY - pad;
    var width = (region.x2 - region.x1) * scaleX + pad * 2;
    var height = (region.y2 - region.y1) * scaleY + pad * 2;
    return { left: left, top: top, width: width, height: height };
  }

  function getRoundedRectPath(x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height / 2));
    return [
      'M', x + r, y,
      'H', x + width - r,
      'Q', x + width, y, x + width, y + r,
      'V', y + height - r,
      'Q', x + width, y + height, x + width - r, y + height,
      'H', x + r,
      'Q', x, y + height, x, y + height - r,
      'V', y + r,
      'Q', x, y, x + r, y,
      'Z'
    ].join(' ');
  }

  function updateUsageMask(rects, vw, vh) {
    var path = 'M0 0 H' + vw + ' V' + vh + ' H0 Z';
    rects.forEach(function (rect) {
      path += ' ' + getRoundedRectPath(rect.left, rect.top, rect.width, rect.height, 12);
    });
    maskSvg.setAttribute('viewBox', '0 0 ' + vw + ' ' + vh);
    maskPath.setAttribute('d', path);
  }

  function placeHighlightBox(box, rect) {
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    box.style.display = 'block';
  }

  function clampUsageBubblePosition(left, top, fit) {
    var margin = 16;
    var viewport = getViewportSize();
    var visualWidth = fit && fit.visualWidth ? fit.visualWidth : 320;
    var visualHeight = fit && fit.visualHeight ? fit.visualHeight : 160;
    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, viewport.width - visualWidth - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, viewport.height - visualHeight - margin))
    };
  }

  function getUsageBubbleFit() {
    return fitFixedElementToViewport(bubble, { margin: 16, minZoom: 0.42 });
  }

  function applyUsageBubbleManualPosition(left, top) {
    var fit = getUsageBubbleFit();
    var position = clampUsageBubblePosition(left, top, fit);
    bubbleManualPosition = position;
    setZoomedFixedPosition(bubble, position.left, position.top, fit.zoom);
    bubbleArrow.style.display = 'none';
  }

  function isUsageBubbleDragBlocked(target) {
    return Boolean(target && target.closest && target.closest('button, input, label, a, [data-no-drag]'));
  }

  function beginUsageBubbleDrag(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (isUsageBubbleDragBlocked(e.target)) return;
    var fit = getUsageBubbleFit();
    var currentPosition = getZoomedFixedPosition(bubble, fit.zoom);
    var position = clampUsageBubblePosition(currentPosition.left || 16, currentPosition.top || 16, fit);
    bubbleDragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      left: position.left,
      top: position.top
    };
    bubble.style.cursor = 'move';
    if (bubble.setPointerCapture && e.pointerId !== undefined) {
      bubble.setPointerCapture(e.pointerId);
    }
    document.addEventListener('pointermove', moveUsageBubbleDrag, true);
    document.addEventListener('pointerup', endUsageBubbleDrag, true);
    document.addEventListener('pointercancel', endUsageBubbleDrag, true);
    e.preventDefault();
    e.stopPropagation();
  }

  function moveUsageBubbleDrag(e) {
    if (!bubbleDragState) return;
    var nextLeft = bubbleDragState.left + e.clientX - bubbleDragState.startX;
    var nextTop = bubbleDragState.top + e.clientY - bubbleDragState.startY;
    applyUsageBubbleManualPosition(nextLeft, nextTop);
    e.preventDefault();
    e.stopPropagation();
  }

  function endUsageBubbleDrag(e) {
    if (!bubbleDragState) return;
    if (bubble.releasePointerCapture && bubbleDragState.pointerId !== undefined) {
      try {
        bubble.releasePointerCapture(bubbleDragState.pointerId);
      } catch (error) {
        // Pointer capture may already be released by the browser.
      }
    }
    bubbleDragState = null;
    bubble.style.cursor = 'move';
    document.removeEventListener('pointermove', moveUsageBubbleDrag, true);
    document.removeEventListener('pointerup', endUsageBubbleDrag, true);
    document.removeEventListener('pointercancel', endUsageBubbleDrag, true);
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function renderStep() {
    var step = steps[currentStepIndex];
    if (!step) return;
    setUsagePreviewState(step.preview || {});
    footer.style.pointerEvents = step.id === 'characterDrag' && isDraggingCharacter ? 'none' : 'auto';
    detailPanel.style.pointerEvents = footer.style.pointerEvents;

    var canvasRect = canvas.getBoundingClientRect();
    var scaleX = canvasRect.width / canvasWidth;
    var scaleY = canvasRect.height / canvasHeight;

    var pad = 6;
    var regions = getStepRegions(step);
    if (regions.length === 0) return;
    var rects = regions.map(function (region) {
      return getUsageHighlightRect(region, canvasRect, scaleX, scaleY, pad);
    });
    var mainRect = rects[0];
    var left = mainRect.left;
    var top = mainRect.top;
    var width = mainRect.width;
    var height = mainRect.height;

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

    updateUsageMask(rects, vw, vh);
    placeHighlightBox(highlightBox, mainRect);
    extraHighlightBoxes.forEach(function (box, index) {
      var rect = rects[index + 1];
      if (rect) {
        placeHighlightBox(box, rect);
      } else {
        box.style.display = 'none';
      }
    });

    titleEl.textContent = step.title;
    bodyEl.innerHTML = '';

    step.lines.forEach(function (line) {
      var li = document.createElement('li');
      if (line && typeof line === 'object' && line.html) {
        li.innerHTML = line.html;
        bodyEl.appendChild(li);
        return;
      }

      var text = String(line || '');
      var colonIndex = text.indexOf(':');
      if (colonIndex > 0) {
        var key = text.slice(0, colonIndex);
        var rest = text.slice(colonIndex + 1);
        
        li.innerHTML = '<span style="color:#1d4ed8; font-weight:600;">' +
          key +
          ':</span>' +
          rest;
      } else {
        li.textContent = text;
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
      detailBtn.textContent = detailOpen ? '간단히' : '자세히';
      detailPanel.style.display = detailOpen ? 'block' : 'none';
      if (detailOpen) detailPanel.innerHTML = step.detailHtml;
    } else {
      detailBtn.style.display = 'none';
      detailOpen = false;
      detailPanel.style.display = 'none';
    }

    var bubbleFit = getUsageBubbleFit();
    var bubbleWidth = Math.max(1, bubbleFit.visualWidth || Math.min(320, vw - 32));
    var bubbleCssWidth = Math.max(1, bubbleFit.width || bubbleWidth);
    var bubbleZoom = bubbleFit.zoom || 1;
    var margin = 18;
    var bubbleHeight = Math.max(bubbleFit.visualHeight || 0, 120 * (bubbleFit.zoom || 1));
    var bubbleLeft;
    var bubbleTop;
    var arrowMode = 'left';
    var rightSpace = vw - (left + width) - margin;
    var leftSpace = left - margin;
    var bottomSpace = vh - (top + height) - margin;
    var topSpace = top - margin;

    if (bubbleManualPosition) {
      var manualPosition = clampUsageBubblePosition(bubbleManualPosition.left, bubbleManualPosition.top, bubbleFit);
      bubbleLeft = manualPosition.left;
      bubbleTop = manualPosition.top;
      bubbleArrow.style.display = 'none';
    } else if (step.bubblePlacement === 'top' && topSpace >= bubbleHeight + 16) {
      bubbleLeft = left + width / 2 - bubbleWidth / 2;
      bubbleTop = top - bubbleHeight - margin;
      arrowMode = 'bottom';
    } else if (rightSpace >= bubbleWidth + 16) {
      bubbleLeft = left + width + margin;
      bubbleTop = top;
      arrowMode = 'left';
    } else if (leftSpace >= bubbleWidth + 16) {
      bubbleLeft = left - bubbleWidth - margin;
      bubbleTop = top;
      arrowMode = 'right';
    } else if (bottomSpace >= bubbleHeight + 16 || bottomSpace >= topSpace) {
      bubbleLeft = left + width / 2 - bubbleWidth / 2;
      bubbleTop = top + height + margin;
      arrowMode = 'top';
    } else {
      bubbleLeft = left + width / 2 - bubbleWidth / 2;
      bubbleTop = top - bubbleHeight - margin;
      arrowMode = 'bottom';
    }

    var clampedPosition = clampUsageBubblePosition(bubbleLeft, bubbleTop, bubbleFit);
    bubbleLeft = clampedPosition.left;
    bubbleTop = clampedPosition.top;

    if (bubbleManualPosition) {
      bubbleManualPosition = { left: bubbleLeft, top: bubbleTop };
      setZoomedFixedPosition(bubble, bubbleLeft, bubbleTop, bubbleZoom);
      return;
    }

    bubbleArrow.style.display = 'block';
    bubbleArrow.style.borderTop = 'none';
    bubbleArrow.style.borderBottom = 'none';
    bubbleArrow.style.borderLeft = 'none';
    bubbleArrow.style.borderRight = 'none';
    bubbleArrow.style.left = '';
    bubbleArrow.style.right = '';
    bubbleArrow.style.top = '';
    bubbleArrow.style.bottom = '';

    if (arrowMode === 'top') {
      bubbleArrow.style.borderLeft = '8px solid transparent';
      bubbleArrow.style.borderRight = '8px solid transparent';
      bubbleArrow.style.borderBottom = '8px solid white';
      bubbleArrow.style.left = Math.min(Math.max(24, (left + width / 2 - bubbleLeft) / bubbleZoom), bubbleCssWidth - 24) + 'px';
      bubbleArrow.style.top = '-8px';
    } else if (arrowMode === 'bottom') {
      bubbleArrow.style.borderLeft = '8px solid transparent';
      bubbleArrow.style.borderRight = '8px solid transparent';
      bubbleArrow.style.borderTop = '8px solid white';
      bubbleArrow.style.left = Math.min(Math.max(24, (left + width / 2 - bubbleLeft) / bubbleZoom), bubbleCssWidth - 24) + 'px';
      bubbleArrow.style.bottom = '-8px';
    } else if (arrowMode === 'right') {
      bubbleArrow.style.borderTop = '8px solid transparent';
      bubbleArrow.style.borderBottom = '8px solid transparent';
      bubbleArrow.style.borderLeft = '10px solid white';
      bubbleArrow.style.right = '-10px';
      bubbleArrow.style.top = '18px';
    } else {
      bubbleArrow.style.borderTop = '8px solid transparent';
      bubbleArrow.style.borderBottom = '8px solid transparent';
      bubbleArrow.style.borderRight = '10px solid white';
      bubbleArrow.style.left = '-10px';
      bubbleArrow.style.top = '18px';
    }

    setZoomedFixedPosition(bubble, bubbleLeft, bubbleTop, bubbleZoom);
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
    detailOpen = !detailOpen;
    renderStep();
  });

  window.addEventListener('resize', scheduleRenderStep);
  window.addEventListener('scroll', scheduleRenderStep, true);
  bubble.addEventListener('pointerdown', beginUsageBubbleDrag);
  bubble.addEventListener('pointermove', moveUsageBubbleDrag);
  bubble.addEventListener('pointerup', endUsageBubbleDrag);
  bubble.addEventListener('pointercancel', endUsageBubbleDrag);

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
