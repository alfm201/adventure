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
