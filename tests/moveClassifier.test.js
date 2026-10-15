const test = require('node:test');
const assert = require('node:assert/strict');
const { isMoveForced, classifyMoveQuality } = require('../moveClassifier.js');

test('isMoveForced: correctly identifies forced moves', () => {
  assert.equal(isMoveForced(null), false);
  assert.equal(isMoveForced({ legalMoves: ['Kh1'] }), true);
  assert.equal(isMoveForced({ legalMoves: ['Kh1', 'Kg1'] }), false);
});

test('classifyMoveQuality: unclassified when engine evaluation is absent', () => {
  const result = classifyMoveQuality({
    moverColor: 'white',
    playedSan: 'e4',
    snapshot: { legalMoves: ['e4', 'd4'] }
  });
  assert.equal(result.quality, 'UNCLASSIFIED');
  assert.equal(result.confidence, 'none');
  assert.equal(result.isForced, false);
});

test('classifyMoveQuality: detects EXCELLENT for top engine move', () => {
  const result = classifyMoveQuality({
    scoreBefore: { cp: 20, perspective: 'white' },
    scoreAfter: { cp: 25, perspective: 'white' },
    moverColor: 'white',
    playedSan: 'Nf3',
    bestmoveSan: 'Nf3'
  });
  assert.equal(result.quality, 'EXCELLENT');
  assert.equal(result.isBestMove, true);
  assert.equal(result.lossCp, 0);
});

test('classifyMoveQuality: classifies INACCURACY for small drop (40-100 cp)', () => {
  const result = classifyMoveQuality({
    scoreBefore: { cp: 100, perspective: 'white' },
    scoreAfter: { cp: 40, perspective: 'white' }, // dropped 60 cp
    moverColor: 'white',
    playedSan: 'h3',
    bestmoveSan: 'd4'
  });
  assert.equal(result.quality, 'INACCURACY');
  assert.equal(result.lossCp, 60);
});

test('classifyMoveQuality: classifies MISTAKE for moderate drop (100-250 cp)', () => {
  const result = classifyMoveQuality({
    scoreBefore: { cp: 0, perspective: 'white' },
    scoreAfter: { cp: -150, perspective: 'white' }, // dropped 150 cp
    moverColor: 'white',
    playedSan: 'Bc4',
    bestmoveSan: 'd4'
  });
  assert.equal(result.quality, 'MISTAKE');
  assert.equal(result.lossCp, 150);
});

test('classifyMoveQuality: classifies BLUNDER for major evaluation drop (> 250 cp)', () => {
  // Black plays Qd5 and drops from equal (0 cp) to -400 cp (White is +400)
  const result = classifyMoveQuality({
    scoreBefore: { cp: 0, perspective: 'white' },
    scoreAfter: { cp: 400, perspective: 'white' }, // White is +400, so Black dropped 400 cp
    moverColor: 'black',
    playedSan: 'Qd5',
    bestmoveSan: 'Nf6'
  });
  assert.equal(result.quality, 'BLUNDER');
  assert.equal(result.lossCp, 400);
});

test('classifyMoveQuality: classifies BLUNDER when forced mate is allowed', () => {
  const result = classifyMoveQuality({
    scoreBefore: { cp: 0, perspective: 'white' },
    scoreAfter: { mate: 1, perspective: 'white' }, // White has mate in 1 after Black's move
    moverColor: 'black',
    playedSan: 'g5',
    bestmoveSan: 'd5'
  });
  assert.equal(result.quality, 'BLUNDER');
  assert.equal(result.lossType, 'mate_allowed');
});

test('classifyMoveQuality: preserves FORCED as separate property on blunder', () => {
  // A forced king move that still leads to mate
  const result = classifyMoveQuality({
    scoreBefore: { mate: -1, perspective: 'white' },
    scoreAfter: { mate: -1, perspective: 'white' },
    moverColor: 'white',
    playedSan: 'Kh1',
    snapshot: { legalMoves: ['Kh1'] }
  });
  assert.equal(result.isForced, true);
});
