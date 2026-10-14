const test = require('node:test');
const assert = require('node:assert/strict');
const { CommentaryEngine, COMMENTARY_DICTIONARY } = require('../commentaryEngine.js');

const PERSONALITIES = ['unhinged', 'sarcastic', 'professional', 'supportive'];
const EVENTS = ['GAME_STARTED', 'MOVE', 'CAPTURE', 'CHECK', 'CHECKMATE', 'CASTLING', 'PROMOTION', 'GAME_ENDED'];

test('CommentaryEngine: all personalities have non-empty reactions for all events', () => {
  for (const p of PERSONALITIES) {
    assert(COMMENTARY_DICTIONARY[p], `Missing dictionary for personality: ${p}`);
    for (const e of EVENTS) {
      const lines = COMMENTARY_DICTIONARY[p][e];
      assert(Array.isArray(lines) && lines.length > 0, `Missing or empty lines for ${p}:${e}`);
      for (const line of lines) {
        assert(typeof line === 'string' && line.trim().length > 0, `Empty line in ${p}:${e}`);
      }
    }
  }
});

test('CommentaryEngine: generates reaction with valid metadata', () => {
  const engine = new CommentaryEngine();
  const event = {
    type: 'CAPTURE',
    san: 'Bxe5',
    ply: 12,
    color: 'white'
  };

  const reaction = engine.generate(event, 'unhinged');
  assert.equal(reaction.personality, 'unhinged');
  assert.equal(reaction.event, 'CAPTURE');
  assert.equal(reaction.san, 'Bxe5');
  assert.equal(reaction.ply, 12);
  assert.equal(reaction.color, 'white');
  assert(typeof reaction.text === 'string' && reaction.text.length > 0);
});

test('CommentaryEngine: avoids immediate duplicate reaction for same event', () => {
  const engine = new CommentaryEngine();
  const event = { type: 'CAPTURE', san: 'Bxe5', ply: 12, color: 'white' };

  const first = engine.generate(event, 'sarcastic');
  const second = engine.generate(event, 'sarcastic');

  assert(first.text.length > 0);
  assert(second.text.length > 0);
  assert.notEqual(first.text, second.text, 'Immediate consecutive reaction should not repeat');
});

test('CommentaryEngine: handles unknown personality gracefully', () => {
  const engine = new CommentaryEngine();
  const event = { type: 'MOVE', san: 'e4', ply: 1, color: 'white' };

  const reaction = engine.generate(event, 'unknown_alien_personality');
  assert(reaction.text.length > 0);
  assert.equal(reaction.event, 'MOVE');
});

test('CommentaryEngine: handles unknown event gracefully', () => {
  const engine = new CommentaryEngine();
  const event = { type: 'MYSTERIOUS_EVENT', san: '??', ply: 99, color: 'black' };

  const reaction = engine.generate(event, 'professional');
  assert(reaction.text.length > 0);
  assert.equal(reaction.event, 'MYSTERIOUS_EVENT');
});
