const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseEngineScore,
  normalizeToWhite,
  normalizeToMover,
  calculateEvaluationLoss
} = require('../scoreNormalizer.js');

test('parseEngineScore: valid centipawn inputs', () => {
  const s1 = parseEngineScore({ type: 'cp', value: 45, perspective: 'white' });
  assert.deepEqual(s1, { type: 'cp', value: 45, perspective: 'white' });

  const s2 = parseEngineScore({ cp: -120, perspective: 'black' });
  assert.deepEqual(s2, { type: 'cp', value: -120, perspective: 'black' });

  // Floating point rounds to integer
  const s3 = parseEngineScore({ type: 'cp', value: 34.6 });
  assert.equal(s3.value, 35);
  assert.equal(s3.perspective, 'white'); // Default perspective
});

test('parseEngineScore: valid mate inputs', () => {
  const m1 = parseEngineScore({ type: 'mate', value: 3, perspective: 'white' });
  assert.deepEqual(m1, { type: 'mate', value: 3, perspective: 'white' });

  const m2 = parseEngineScore({ mate: -1, perspective: 'black' });
  assert.deepEqual(m2, { type: 'mate', value: -1, perspective: 'black' });
});

test('parseEngineScore: rejects invalid, malformed, or 0 mate inputs', () => {
  assert.throws(() => parseEngineScore(null), /expected an object/);
  assert.throws(() => parseEngineScore({}), /must specify type/);
  assert.throws(() => parseEngineScore({ type: 'unknown', value: 10 }), /Unsupported score type/);
  assert.throws(() => parseEngineScore({ type: 'mate', value: 0 }), /cannot be 0/);
  assert.throws(() => parseEngineScore({ type: 'mate', value: 2.5 }), /must be an integer/);
  assert.throws(() => parseEngineScore({ type: 'cp', value: NaN }), /finite number/);
  assert.throws(() => parseEngineScore({ cp: 50, perspective: 'martian' }), /Invalid score perspective/);
});

test('normalizeToWhite: converts perspectives accurately', () => {
  // From White
  assert.deepEqual(
    normalizeToWhite({ cp: 75, perspective: 'white' }),
    { type: 'cp', value: 75, perspective: 'white' }
  );

  // From Black (inverted)
  assert.deepEqual(
    normalizeToWhite({ cp: 75, perspective: 'black' }),
    { type: 'cp', value: -75, perspective: 'white' }
  );

  assert.deepEqual(
    normalizeToWhite({ mate: 2, perspective: 'black' }),
    { type: 'mate', value: -2, perspective: 'white' }
  );

  // From Engine (UCI perspective of side to move)
  // White to move: +100 cp means White is +100
  assert.deepEqual(
    normalizeToWhite({ cp: 100, perspective: 'engine' }, { turn: 'w' }),
    { type: 'cp', value: 100, perspective: 'white' }
  );

  // Black to move: +100 cp means Black is +100, so White is -100
  assert.deepEqual(
    normalizeToWhite({ cp: 100, perspective: 'engine' }, { turn: 'b' }),
    { type: 'cp', value: -100, perspective: 'white' }
  );

  // From Mover
  // Black just moved, mover evaluation is +250 (Black is winning) -> White is -250
  assert.deepEqual(
    normalizeToWhite({ cp: 250, perspective: 'mover' }, { mover: 'black' }),
    { type: 'cp', value: -250, perspective: 'white' }
  );
});

test('normalizeToMover: converts any score to mover perspective', () => {
  // If White is mover, White's +150 cp stays +150
  const whiteMover = normalizeToMover({ cp: 150, perspective: 'white' }, 'white');
  assert.deepEqual(whiteMover, { type: 'cp', value: 150, perspective: 'mover' });

  // If Black is mover, White's -150 cp (Black is winning) becomes +150
  const blackMover = normalizeToMover({ cp: -150, perspective: 'white' }, 'black');
  assert.deepEqual(blackMover, { type: 'cp', value: 150, perspective: 'mover' });

  // If Black is mover and Black has forced mate (+M2 from Black's perspective)
  const blackMate = normalizeToMover({ mate: -2, perspective: 'white' }, 'black');
  assert.deepEqual(blackMate, { type: 'mate', value: 2, perspective: 'mover' });
});

test('calculateEvaluationLoss: centipawn drops', () => {
  // White was +200, after move White is +50 -> 150 cp loss
  const loss1 = calculateEvaluationLoss(
    { cp: 200, perspective: 'white' },
    { cp: 50, perspective: 'white' },
    'white'
  );
  assert.equal(loss1.lossCp, 150);
  assert.equal(loss1.netCpChange, -150);
  assert.equal(loss1.lossType, 'cp');

  // Black was -100 (from White perspective, so +100 for Black).
  // After move, White is +200 (so -200 for Black).
  // Black lost 300 centipawns!
  const loss2 = calculateEvaluationLoss(
    { cp: -100, perspective: 'white' },
    { cp: 200, perspective: 'white' },
    'black'
  );
  assert.equal(loss2.lossCp, 300);
  assert.equal(loss2.netCpChange, -300);
});

test('calculateEvaluationLoss: forced mate transitions', () => {
  // Had mate in 2 (+M2), played blunder and lost it to +200 cp
  const lossMate = calculateEvaluationLoss(
    { mate: 2, perspective: 'mover' },
    { cp: 200, perspective: 'mover' },
    'white'
  );
  assert.equal(lossMate.lossType, 'mate_lost');
  assert(lossMate.lossCp >= 1000);

  // Allowed mate (-M1) from an equal position
  const allowedMate = calculateEvaluationLoss(
    { cp: 0, perspective: 'mover' },
    { mate: -1, perspective: 'mover' },
    'white'
  );
  assert.equal(allowedMate.lossType, 'mate_allowed');
  assert(allowedMate.lossCp >= 1000);
});
