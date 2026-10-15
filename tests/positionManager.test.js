const test = require('node:test');
const assert = require('node:assert/strict');
const { PositionManager, START_FEN } = require('../positionManager.js');

test('PositionManager: initialization with start FEN', () => {
  const pm = new PositionManager();
  assert.equal(pm.getFen(), START_FEN);
  assert.equal(pm.getTurn(), 'w');
  assert.equal(pm.history.length, 0);
});

test('PositionManager: sequential opening moves with snapshots', () => {
  const pm = new PositionManager();
  const s1 = pm.playMove('e4');
  assert.equal(s1.ply, 1);
  assert.equal(s1.moveNumber, 1);
  assert.equal(s1.moverColor, 'white');
  assert.equal(s1.san, 'e4');
  assert.equal(s1.from, 'e2');
  assert.equal(s1.to, 'e4');
  assert.equal(s1.fenBefore, START_FEN);
  assert.equal(pm.getFen(), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');

  const s2 = pm.playMove('c5'); // Sicilian Defense
  assert.equal(s2.ply, 2);
  assert.equal(s2.moveNumber, 1);
  assert.equal(s2.moverColor, 'black');
  assert.equal(s2.san, 'c5');
  assert.equal(s2.from, 'c7');
  assert.equal(s2.to, 'c5');
});

test('PositionManager: captures, castling, and checks', () => {
  const pm = new PositionManager();
  // Scholar's Mate variation
  pm.playMove('e4');
  pm.playMove('e5');
  pm.playMove('Bc4');
  pm.playMove('Nc6');
  pm.playMove('Qh5');
  pm.playMove('Nf6');
  const mateSnap = pm.playMove('Qxf7#');

  assert.equal(mateSnap.san, 'Qxf7#');
  assert.equal(mateSnap.captured, 'p');
  assert.equal(mateSnap.isCheck, true);
  assert.equal(mateSnap.isCheckmate, true);
  assert.equal(mateSnap.isGameOver, true);

  // Castling in another game
  const pm2 = new PositionManager();
  pm2.loadMoveSequence(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
  const last = pm2.history[pm2.history.length - 1];
  assert.equal(last.san, 'O-O');
  assert.equal(last.from, 'e1');
  assert.equal(last.to, 'g1');
});

test('PositionManager: pawn promotion', () => {
  // Setup FEN with pawn 1 move away from promotion
  const promoFen = '8/4P3/8/8/8/8/8/k6K w - - 0 1';
  const pm = new PositionManager(promoFen);
  const snap = pm.playMove('e8=Q');

  assert.equal(snap.san, 'e8=Q');
  assert.equal(snap.promotion, 'q');
  assert.equal(snap.piece, 'p');
});

test('PositionManager: custom starting positions', () => {
  // Classic endgame FEN: White king on e3, White pawn on e2, Black king on e6
  const customFen = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';
  const pm = new PositionManager(customFen);
  assert.equal(pm.getFen(), customFen);
  // King moves away from e3 to d4, opening path for pawn
  const snap1 = pm.playMove('Kd4');
  assert.equal(snap1.san, 'Kd4');
  assert.equal(snap1.fenBefore, customFen);

  // Black king responds
  const snap2 = pm.playMove('Kd6');
  assert.equal(snap2.san, 'Kd6');

  // Now White can legally push e4
  const snap3 = pm.playMove('e4');
  assert.equal(snap3.san, 'e4');
});

test('PositionManager: explicit rejection of illegal moves', () => {
  const pm = new PositionManager();
  pm.playMove('e4');
  // Black tries an illegal move: e4 (square occupied) or moving white piece
  assert.throws(() => pm.playMove('e4'), /Illegal move/);
  assert.throws(() => pm.playMove('Nf3'), /Illegal move/);
  // King cannot fly across the board
  assert.throws(() => pm.playMove('Ke7'), /Illegal move/);
});

test('PositionManager: loadMoveSequence rejects invalid sequence without silently skipping', () => {
  const pm = new PositionManager();
  const sequenceWithIllegal = ['e4', 'e5', 'Nf3', 'Ke2', 'Nxe5']; // Ke2 is illegal for Black at ply 4

  assert.throws(() => pm.loadMoveSequence(sequenceWithIllegal), /Illegal move at ply 4/);
  // State should not silently proceed
});

test('PositionManager: loadPgn successfully parses standard game with headers and custom FEN', () => {
  const operaGamePgn = `
[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.10.21"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
`;

  const pm = new PositionManager();
  const result = pm.loadPgn(operaGamePgn);

  assert.equal(result.headers.White, 'Paul Morphy');
  assert.equal(result.headers.Result, '1-0');
  assert.equal(result.snapshots.length, 33);
  assert.equal(result.snapshots[32].san, 'Rd8#');
  assert.equal(result.snapshots[32].isCheckmate, true);
});

test('PositionManager: loadPgn rejects malformed PGN', () => {
  const pm = new PositionManager();
  assert.throws(() => pm.loadPgn(''), /non-empty string/);
  assert.throws(() => pm.loadPgn('1. e4 e5 2. BlahBlahInvalidMove'), /Malformed PGN|Illegal move/);
});
