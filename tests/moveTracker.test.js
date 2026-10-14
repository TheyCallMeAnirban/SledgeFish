const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanSan, MoveTracker, extractMoves } = require('../moveTracker.js');

test('cleanSan: normalizes moves and figurines correctly', () => {
  assert.equal(cleanSan('e4', ''), 'e4');
  assert.equal(cleanSan('f3', 'N'), 'Nf3');
  assert.equal(cleanSan('Nf3', 'N'), 'Nf3'); // Does not duplicate
  assert.equal(cleanSan('xe5', 'B'), 'Bxe5');
  assert.equal(cleanSan('0-0', ''), 'O-O'); // Standardizes castling
  assert.equal(cleanSan('0-0-0', ''), 'O-O-O');
  assert.equal(cleanSan('e8=Q#', ''), 'e8=Q#');
  assert.equal(cleanSan('  d4 (0:15) ', ''), 'd4'); // Strips clock text
});

test('MoveTracker: does not replay moves on initial load', () => {
  const emitted = [];
  const tracker = new MoveTracker({
    onNewMove: (m) => emitted.push(m)
  });

  const existingGame = [
    { ply: 1, san: 'e4', color: 'white' },
    { ply: 2, san: 'e5', color: 'black' },
    { ply: 3, san: 'Nf3', color: 'white' }
  ];

  const result = tracker.sync(existingGame, { isInitialLoad: true });
  assert.equal(result.newMoves.length, 0);
  assert.equal(emitted.length, 0);
  assert.equal(tracker.lastMoves.length, 3);
});

test('MoveTracker: emits no duplicates on DOM rerender with same moves', () => {
  const emitted = [];
  const tracker = new MoveTracker({
    onNewMove: (m) => emitted.push(m)
  });

  const moves = [
    { ply: 1, san: 'e4', color: 'white' },
    { ply: 2, san: 'e5', color: 'black' }
  ];

  tracker.sync(moves, { isInitialLoad: true });

  // Simulate multiple DOM rerenders
  const rerender1 = tracker.sync([...moves]);
  const rerender2 = tracker.sync([...moves]);

  assert.equal(rerender1.newMoves.length, 0);
  assert.equal(rerender2.newMoves.length, 0);
  assert.equal(emitted.length, 0);
});

test('MoveTracker: detects single newly played move', () => {
  const emitted = [];
  const tracker = new MoveTracker({
    onNewMove: (m) => emitted.push(m)
  });

  const move1 = [{ ply: 1, san: 'e4', color: 'white' }];
  tracker.sync(move1, { isInitialLoad: true });

  const move2 = [
    { ply: 1, san: 'e4', color: 'white' },
    { ply: 2, san: 'c5', color: 'black' }
  ];

  const result = tracker.sync(move2);
  assert.equal(result.newMoves.length, 1);
  assert.equal(result.newMoves[0].san, 'c5');
  assert.equal(result.newMoves[0].ply, 2);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].san, 'c5');
});

test('MoveTracker: handles multiple moves in single DOM batch', () => {
  const emitted = [];
  const tracker = new MoveTracker({
    onNewMove: (m) => emitted.push(m)
  });

  tracker.sync([], { isInitialLoad: true });

  const batch = [
    { ply: 1, san: 'd4', color: 'white' },
    { ply: 2, san: 'Nf6', color: 'black' },
    { ply: 3, san: 'c4', color: 'white' }
  ];

  const result = tracker.sync(batch);
  assert.equal(result.newMoves.length, 3);
  assert.equal(emitted.length, 3);
  assert.equal(emitted[0].san, 'd4');
  assert.equal(emitted[1].san, 'Nf6');
  assert.equal(emitted[2].san, 'c4');
});

test('MoveTracker: resets cleanly when board is cleared or new game started', () => {
  let resetCalled = false;
  const tracker = new MoveTracker({
    onReset: () => { resetCalled = true; }
  });

  tracker.sync([
    { ply: 1, san: 'e4', color: 'white' },
    { ply: 2, san: 'e5', color: 'black' }
  ], { isInitialLoad: true });

  const result = tracker.sync([]);
  assert.equal(result.isReset, true);
  assert.equal(result.newMoves.length, 0);
  assert.equal(resetCalled, true);
  assert.equal(tracker.lastMoves.length, 0);
});

test('MoveTracker: handles game divergence (navigation to another game)', () => {
  let resetCalled = false;
  const emitted = [];
  const tracker = new MoveTracker({
    onNewMove: (m) => emitted.push(m),
    onReset: () => { resetCalled = true; }
  });

  tracker.sync([
    { ply: 1, san: 'e4', color: 'white' },
    { ply: 2, san: 'e5', color: 'black' }
  ], { isInitialLoad: true });

  // Navigated to game that started with d4
  const divergedGame = [
    { ply: 1, san: 'd4', color: 'white' },
    { ply: 2, san: 'd5', color: 'black' }
  ];

  const result = tracker.sync(divergedGame);
  assert.equal(result.isReset, true);
  assert.equal(result.newMoves.length, 0);
  assert.equal(resetCalled, true);
  assert.equal(tracker.lastMoves[0].san, 'd4');
});
