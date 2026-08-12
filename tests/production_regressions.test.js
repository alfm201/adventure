const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadBoard() {
  const context = {
    console,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
  };
  vm.createContext(context);
  vm.runInContext([
    read('js/stageName.js'),
    read('js/stage.js'),
    read('js/cardInfo.js'),
    read('js/board.js'),
  ].join('\n'), context);
  return vm.runInContext('Board', context);
}

function loadX36Context() {
  const context = {
    console,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    document: { getElementById: () => null },
    window: {},
    navigator: {},
    location: { search: '' },
    URLSearchParams,
    performance,
  };
  vm.createContext(context);
  vm.runInContext([
    read('js/stageName.js'),
    read('js/stage.js'),
    read('js/cardInfo.js'),
    read('js/board.js'),
    read('js/gpu_engine.js'),
  ].join('\n'), context);
  return context;
}

test('manual multiplier card executes before consuming the final dice use', () => {
  const Board = loadBoard();
  const board = new Board();
  board.score = 10;
  board.diceUse = 99;
  board.cards = [board.cardInfo[22]];

  const done = board.stepManual(1);

  assert.equal(done, true);
  assert.equal(board.diceUse, 100);
  assert.equal(board.isDouble, false);
  assert.equal(board.cards.length, 0);
  assert.notEqual(board.score, 10);
});

test('manual multiplier card executes before consuming a final double', () => {
  const Board = loadBoard();
  const board = new Board();
  board.score = 10;
  board.diceUse = 100;
  board.isDouble = true;
  board.cards = [board.cardInfo[22]];

  const done = board.stepManual(1);

  assert.equal(done, true);
  assert.equal(board.diceUse, 100);
  assert.equal(board.isDouble, false);
  assert.equal(board.cards.length, 0);
  assert.notEqual(board.score, 10);
});

test('production GPU clamps score at both board bounds', () => {
  const source = read('js/gpu_engine.js');
  assert.match(source, /\(\*score\) = clamp\(\(\*score\) \+ value, 1, 2898\);/);
  assert.match(source, /\(\*score\) = clamp\(\(\*score\) \+ stage_move_at\(\(\*score\) - 1\), 1, 2898\);/);
});

test('blocking DOM overlays stop both game keydown handlers', () => {
  const source = read('js/adventure.js');
  assert.match(source, /function eventKeydown\(e\) \{\r?\n  if \(shouldIgnoreAdventureGameKeydown\(\)\) return;/);
  assert.match(source, /function newEventKeydown\(e\) \{\r?\n  if \(shouldIgnoreAdventureGameKeydown\(\)\) return;/);
});

test('GPU overview identifies its center statistic as an average', () => {
  const source = read('js/adventure.js');
  assert.match(source, /function getExScoreCenterLabel\(\)/);
  assert.match(source, /computeSettings\.engine === 'gpu' \? '평균' : '중앙값'/);
});

test('X36-G3 freezes the validated G2 plus futureCardP3 weights', () => {
  const context = loadX36Context();
  const weights = vm.runInContext('X36_WEIGHTS', context);

  assert.equal(context.X36_POLICY_VERSION, 'X36-G3');
  assert.equal(weights.lateFamilyThreshold, 95);
  assert.equal(weights.lateMove, 52.506);
  assert.equal(weights.lateMult, 59.091);
  assert.equal(weights.lateStage, 44.838);
  assert.equal(weights.chainLatePenalty, 0);
  assert.equal(weights.stageActualMove, 0);
  assert.equal(weights.futureCardP3, 133.78);
  assert.equal(Object.hasOwn(weights, 'stageJump'), false);
});

test('X36-G3 CPU and GPU share the exact Float32 futureCardP3 LUT', () => {
  const context = loadX36Context();
  const result = vm.runInContext(`(() => {
    const cpu = getX36CpuLuts().futureCardP3;
    const tables = {
      stageId: stage.map(row => Number(row[1] || 0)),
      stageMove: stage.map(row => Number(row[4] || 0)),
      stageEvent: stage.map(row => Number(row[5] || 0)),
      cardType: [0, ...cardInfo.map(row => Number(row[1] || 0))],
      cardValue: [0, ...cardInfo.map(row => Number(row[2] || 0))],
    };
    const packed = buildX36GpuLookupData(tables);
    let mismatches = 0;
    for (let i = 0; i < cpu.length; i++) {
      if (packed[X36_GPU_FUTURE_P3_OFFSET + i] !== x36F32ToI32Bits(cpu[i])) mismatches++;
    }
    return { mismatches, cpuLength: cpu.length, packedLength: packed.length };
  })()`, context);

  assert.equal(result.mismatches, 0);
  assert.equal(result.cpuLength, 8 * 2899);
  assert.equal(result.packedLength, 11595 + 8 * 2899);
});

test('X36-G3 GPU policy uses P3 successor scoring without stageJump', () => {
  const context = loadX36Context();
  const shader = vm.runInContext(`shaderSource({
    stageId: stage.map(row => Number(row[1] || 0)),
    stageMove: stage.map(row => Number(row[4] || 0)),
    stageEvent: stage.map(row => Number(row[5] || 0)),
    cardType: [0, ...cardInfo.map(row => Number(row[1] || 0))],
    cardValue: [0, ...cardInfo.map(row => Number(row[2] || 0))],
  })`, context);

  assert.match(shader, /const W_FUTURE_CARD_P3: i32 = 133780;/);
  assert.match(shader, /successor_future_card_p3_x36/);
  assert.match(shader, /choose_action\(score, diceUse, isDouble, &hand, handCount, obtained\)/);
  assert.doesNotMatch(shader, /W_STAGE_JUMP|stageJump/);
  assert.match(read('js/adventure.js'), /return globalThis\.X36_G3_CHOOSE_ACTION\.call\(this\);/);
});
