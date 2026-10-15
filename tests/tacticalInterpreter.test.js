const test = require('node:test');
const assert = require('node:assert/strict');
const { PositionManager } = require('../positionManager.js');
const {
  interpretTactics,
  detectMissedMateInOne,
  detectFork,
  detectHangingPiece
} = require('../tacticalInterpreter.js');

test('TacticalInterpreter: detects hanging queen blunder', () => {
  const pm = new PositionManager();
  pm.playMove('e4');
  pm.playMove('e5');
  pm.playMove('Qh5');
  pm.playMove('Nf6');
  // White blunders and plays a3 leaving Queen on h5 hanging to knight
  const snap = pm.playMove('a3');
  const tactics = interpretTactics({ snapshot: snap, quality: 'BLUNDER' });
  assert.equal(tactics.motif, 'HANGING_PIECE');
  assert.equal(tactics.details.piece, 'वज़ीर');
  assert.equal(tactics.details.square, 'h5');
});

test('TacticalInterpreter: detects hanging piece when undefended piece moved to attacked square', () => {
  const pm = new PositionManager();
  pm.playMove('e4');
  pm.playMove('e5');
  pm.playMove('Nf3');
  pm.playMove('Nc6');
  // White blunders knight by moving to d4 (attacked by Nc6, defended by 0 pieces)
  const hungSnap = pm.playMove('Nd4');
  const tactics = interpretTactics({ snapshot: hungSnap, quality: 'BLUNDER' });
  assert.equal(tactics.motif, 'HANGING_PIECE');
  assert.equal(tactics.details.piece, 'घोड़ा');
  assert.equal(tactics.details.square, 'd4');
});

test('TacticalInterpreter: detects royal fork by knight', () => {
  const pm = new PositionManager();
  // Set up position where Nc7+ forks King and Rook
  pm.playMove('e4');
  pm.playMove('e5');
  pm.playMove('Nf3');
  pm.playMove('Nc6');
  pm.playMove('Bc4');
  pm.playMove('Nf6');
  pm.playMove('Ng5');
  pm.playMove('d5');
  pm.playMove('exd5');
  pm.playMove('Nd4');
  pm.playMove('c3');
  pm.playMove('b5');
  pm.playMove('Bf1');
  pm.playMove('Nxd5');
  const snap = pm.playMove('Nxf7'); // Attacks Queen d8 and Rook h8
  const tactics = interpretTactics({ snapshot: snap, quality: 'EXCELLENT' });
  assert.equal(tactics.motif, 'FORK');
  assert.equal(tactics.details.piece, 'घोड़ा');
  assert.ok(tactics.details.targets.includes('वज़ीर') || tactics.details.targets.includes('हाथी'));
});

test('TacticalInterpreter: detects missed checkmate in 1', () => {
  const pm = new PositionManager();
  // Scholar's mate setup: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6. White has Qxf7# (mate in 1).
  pm.playMove('e4');
  pm.playMove('e5');
  pm.playMove('Qh5');
  pm.playMove('Nc6');
  pm.playMove('Bc4');
  pm.playMove('Nf6');
  // Instead of Qxf7#, White blunders and plays a3
  const blunderSnap = pm.playMove('a3');
  const tactics = interpretTactics({ snapshot: blunderSnap, quality: 'BLUNDER' });
  assert.equal(tactics.motif, 'MISSED_MATE');
  assert.equal(tactics.details.missedMateSan, 'Qxf7#');
});

test('TacticalInterpreter: detects checkmate delivered', () => {
  const pm = new PositionManager();
  pm.playMove('f3');
  pm.playMove('e5');
  pm.playMove('g4');
  const mateSnap = pm.playMove('Qh4#');
  const tactics = interpretTactics({ snapshot: mateSnap, quality: 'BRILLIANT' });
  assert.equal(tactics.motif, 'CHECKMATE_DELIVERED');
});
