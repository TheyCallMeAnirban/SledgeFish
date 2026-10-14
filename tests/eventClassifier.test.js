const test = require('node:test');
const assert = require('node:assert/strict');
const { classify } = require('../eventClassifier.js');

test('classify: ordinary moves', () => {
  const e4 = classify({ ply: 1, san: 'e4', color: 'white' });
  assert.equal(e4.type, 'MOVE');
  assert.equal(e4.isCapture, false);
  assert.equal(e4.isCheck, false);

  const nf3 = classify({ ply: 3, san: 'Nf3', color: 'white' });
  assert.equal(nf3.type, 'MOVE');
  assert.deepEqual(nf3.flags, ['MOVE']);
});

test('classify: captures', () => {
  const capture = classify({ ply: 5, san: 'Bxe5', color: 'white' });
  assert.equal(capture.type, 'CAPTURE');
  assert.equal(capture.isCapture, true);
  assert.equal(capture.isCheck, false);

  const pawnCapture = classify({ ply: 6, san: 'dxe4', color: 'black' });
  assert.equal(pawnCapture.type, 'CAPTURE');
  assert.equal(pawnCapture.isCapture, true);
});

test('classify: checks', () => {
  const check = classify({ ply: 7, san: 'Bb5+', color: 'white' });
  assert.equal(check.type, 'CHECK');
  assert.equal(check.isCheck, true);
  assert.equal(check.isCheckmate, false);
});

test('classify: checkmate', () => {
  const mate = classify({ ply: 8, san: 'Qh5#', color: 'white' });
  assert.equal(mate.type, 'CHECKMATE');
  assert.equal(mate.isCheckmate, true);
  assert.equal(mate.isCheck, false); // Checkmate supersedes simple check flag
});

test('classify: castling kingside and queenside', () => {
  const kingCastle = classify({ ply: 9, san: 'O-O', color: 'white' });
  assert.equal(kingCastle.type, 'CASTLING');
  assert.equal(kingCastle.isCastling, true);

  const queenCastle = classify({ ply: 10, san: 'O-O-O', color: 'black' });
  assert.equal(queenCastle.type, 'CASTLING');
  assert.equal(queenCastle.isCastling, true);
});

test('classify: promotions', () => {
  const promo = classify({ ply: 50, san: 'e8=Q', color: 'white' });
  assert.equal(promo.type, 'PROMOTION');
  assert.equal(promo.isPromotion, true);

  const promoCheck = classify({ ply: 51, san: 'd1=Q+', color: 'black' });
  assert.equal(promoCheck.isPromotion, true);
  assert.equal(promoCheck.isCheck, true);
  assert.deepEqual(promoCheck.flags, ['CHECK', 'PROMOTION']);
});

test('classify: compound events (capture + check)', () => {
  const captureCheck = classify({ ply: 15, san: 'Bxf7+', color: 'white' });
  assert.equal(captureCheck.type, 'CAPTURE');
  assert.equal(captureCheck.isCapture, true);
  assert.equal(captureCheck.isCheck, true);
  assert(captureCheck.flags.includes('CAPTURE'));
  assert(captureCheck.flags.includes('CHECK'));
});

test('classify: fallback on invalid or empty move', () => {
  const fallback = classify(null);
  assert.equal(fallback.type, 'MOVE');
  assert.equal(fallback.san, '');
});
