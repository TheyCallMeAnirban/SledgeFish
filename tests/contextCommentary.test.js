const test = require('node:test');
const assert = require('node:assert/strict');
const { CommentaryEngine } = require('../commentaryEngine.js');

test('CommentaryEngine Context: generates Hindi commentary with specific piece and square', () => {
  const engine = new CommentaryEngine();

  // Test Black playing Qd5
  const findingQd5 = {
    type: 'MOVE',
    quality: 'BLUNDER',
    san: 'Qd5',
    ply: 12,
    color: 'black',
    snapshot: { piece: 'q', from: 'd8', to: 'd5' }
  };

  const reaction = engine.generate(findingQd5, 'unhinged');
  assert(reaction.text.includes('वज़ीर') || reaction.text.includes('d5') || reaction.text.includes('कैच'), `Reaction should mention piece or square: ${reaction.text}`);
  assert.equal(reaction.quality, 'BLUNDER');
  assert.equal(reaction.contextKey, 'BLUNDER');
});

test('CommentaryEngine Context: checks mention राजा and cricket boundary/check themes', () => {
  const engine = new CommentaryEngine();
  const checkFinding = {
    type: 'CHECK',
    san: 'Bb5+',
    ply: 7,
    color: 'white',
    isCheck: true,
    snapshot: { piece: 'b', from: 'f1', to: 'b5' }
  };

  const reaction = engine.generate(checkFinding, 'sarcastic');
  assert(reaction.text.includes('राजा') || reaction.text.includes('चेक'), `Expected check reaction: ${reaction.text}`);
});

test('CommentaryEngine Context: checkmate triggers cricket match-winning termination in Hindi', () => {
  const engine = new CommentaryEngine();
  const mateFinding = {
    type: 'CHECKMATE',
    san: 'Qxf7#',
    ply: 7,
    color: 'white',
    isCheckmate: true,
    snapshot: { piece: 'q', from: 'h5', to: 'f7' }
  };

  const reaction = engine.generate(mateFinding, 'unhinged');
  assert(
    reaction.text.includes('क्लीन बोल्ड') || reaction.text.includes('ऑल आउट') || reaction.text.includes('छक्का'),
    `Expected dramatic cricket termination commentary: ${reaction.text}`
  );
});

test('CommentaryEngine Context: recent history buffer tracks generated lines', () => {
  const engine = new CommentaryEngine();
  const finding = {
    type: 'MOVE',
    san: 'Nf3',
    snapshot: { piece: 'n', to: 'f3' }
  };

  engine.generate(finding, 'professional');
  assert.equal(engine.recentHistory.length, 1);
  assert(typeof engine.recentHistory[0] === 'string');
});
