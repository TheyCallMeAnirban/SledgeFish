/**
 * SledgeFish - Score Normalizer
 * Explicit input contracts and perspective normalization for engine evaluations.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishScoreNormalizer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Score types:
   * 'cp'   - Centipawn evaluation (integer or finite number)
   * 'mate' - Forced mate in N moves:
   *          positive (+N) means the side with the advantage mates in N moves.
   *          negative (-N) means the side is getting mated in N moves.
   *          0 is disallowed or represents immediate mate.
   */

  /**
   * Parses and validates raw engine score inputs.
   * Accepted input forms:
   * 1. Object: { type: 'cp', value: 35, perspective: 'white' }
   * 2. Object: { type: 'mate', value: 2, perspective: 'mover' }
   * 3. Object: { cp: 35, perspective: 'engine' }
   * 4. Object: { mate: -3, perspective: 'white' }
   *
   * @param {Object} raw
   * @returns {{ type: 'cp'|'mate', value: number, perspective: 'white'|'black'|'mover'|'engine' }}
   */
  function parseEngineScore(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new TypeError('Invalid score input: expected an object.');
    }

    let type = raw.type;
    let value = raw.value;

    if (type === undefined) {
      if (typeof raw.cp === 'number' && Number.isFinite(raw.cp)) {
        type = 'cp';
        value = raw.cp;
      } else if (typeof raw.mate === 'number' && Number.isInteger(raw.mate)) {
        type = 'mate';
        value = raw.mate;
      } else {
        throw new Error('Malformed score object: must specify type ("cp" or "mate") or numeric cp/mate property.');
      }
    }

    if (type !== 'cp' && type !== 'mate') {
      throw new Error(`Unsupported score type: "${type}". Expected "cp" or "mate".`);
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`Invalid score value: expected finite number, got ${value}`);
    }

    if (type === 'mate') {
      if (!Number.isInteger(value)) {
        throw new TypeError(`Mate distance must be an integer, got: ${value}`);
      }
      if (value === 0) {
        throw new RangeError('Mate score cannot be 0 (mate distance is 1 or greater, sign indicates who mates).');
      }
    } else if (type === 'cp') {
      // Round to nearest integer centipawn if float passed
      value = Math.round(value);
    }

    const perspective = String(raw.perspective || 'white').toLowerCase();
    if (!['white', 'black', 'mover', 'engine'].includes(perspective)) {
      throw new Error(`Invalid score perspective: "${raw.perspective}". Expected "white", "black", "mover", or "engine".`);
    }

    return {
      type: type,
      value: value,
      perspective: perspective
    };
  }

  /**
   * Normalizes an engine score to White's perspective.
   *
   * @param {Object} rawScore - Raw score object
   * @param {Object} context - Optional context { turn: 'w'|'b'|'white'|'black', mover: 'w'|'b'|'white'|'black' }
   * @returns {{ type: 'cp'|'mate', value: number, perspective: 'white' }}
   */
  function normalizeToWhite(rawScore, context = {}) {
    const parsed = parseEngineScore(rawScore);
    const perspective = parsed.perspective;

    // Already White perspective
    if (perspective === 'white') {
      return {
        type: parsed.type,
        value: parsed.value,
        perspective: 'white'
      };
    }

    // Black perspective: invert sign
    if (perspective === 'black') {
      return {
        type: parsed.type,
        value: -parsed.value,
        perspective: 'white'
      };
    }

    // "engine" perspective in standard UCI means score from the perspective of the side whose turn it is to move.
    if (perspective === 'engine') {
      const turn = String(context.turn || context.mover || '').toLowerCase();
      if (!turn || !['w', 'b', 'white', 'black'].includes(turn)) {
        throw new Error('Context "turn" (or "mover") is required to normalize an "engine" perspective score.');
      }
      const isWhiteTurn = turn === 'w' || turn === 'white';
      return {
        type: parsed.type,
        value: isWhiteTurn ? parsed.value : -parsed.value,
        perspective: 'white'
      };
    }

    // "mover" perspective: score from the perspective of the player who just moved
    if (perspective === 'mover') {
      const mover = String(context.mover || context.turn || '').toLowerCase();
      if (!mover || !['w', 'b', 'white', 'black'].includes(mover)) {
        throw new Error('Context "mover" is required to normalize a "mover" perspective score.');
      }
      const isWhiteMover = mover === 'w' || mover === 'white';
      return {
        type: parsed.type,
        value: isWhiteMover ? parsed.value : -parsed.value,
        perspective: 'white'
      };
    }

    throw new Error(`Unhandled perspective: ${perspective}`);
  }

  /**
   * Converts a score (from any perspective, using context) to the mover's perspective.
   * Positive value = mover is winning / ahead.
   * Negative value = mover is losing / behind.
   *
   * @param {Object} rawScore
   * @param {string|Object} moverOrContext - 'white'|'black'|'w'|'b' or context object
   * @returns {{ type: 'cp'|'mate', value: number, perspective: 'mover' }}
   */
  function normalizeToMover(rawScore, moverOrContext) {
    let moverColor = '';
    let context = {};

    if (typeof moverOrContext === 'string') {
      moverColor = moverOrContext.toLowerCase();
      context = { mover: moverColor };
    } else if (moverOrContext && typeof moverOrContext === 'object') {
      context = moverOrContext;
      moverColor = String(context.mover || context.turn || '').toLowerCase();
    }

    if (!moverColor || !['w', 'b', 'white', 'black'].includes(moverColor)) {
      throw new Error(`Valid mover color is required for normalizeToMover, got: "${moverColor}".`);
    }

    const isWhite = moverColor === 'w' || moverColor === 'white';
    const whiteScore = normalizeToWhite(rawScore, context);

    return {
      type: whiteScore.type,
      value: isWhite ? whiteScore.value : -whiteScore.value,
      perspective: 'mover'
    };
  }

  /**
   * Calculates evaluation loss from the mover's perspective.
   * Both scores are first normalized to the mover's perspective.
   * Loss = Score_before_move - Score_after_move (from mover's perspective).
   * Positive loss means the mover made a worse position (e.g. lost 150 centipawns).
   *
   * @param {Object} scoreBefore
   * @param {Object} scoreAfter
   * @param {string} moverColor - 'white'|'black'|'w'|'b'
   * @returns {{ lossCp: number|null, lossType: 'cp'|'mate_lost'|'mate_allowed'|'mate_delayed'|'mate_to_mate' }}
   */
  function calculateEvaluationLoss(scoreBefore, scoreAfter, moverColor) {
    const before = normalizeToMover(scoreBefore, moverColor);
    const after = normalizeToMover(scoreAfter, moverColor);

    // Case 1: Both are centipawn scores
    if (before.type === 'cp' && after.type === 'cp') {
      const loss = before.value - after.value;
      return {
        lossCp: Math.max(0, loss),
        netCpChange: -loss, // Positive = improved, Negative = worsened
        lossType: 'cp'
      };
    }

    // Case 2: Mover had forced mate, now lost it (e.g. +M2 -> cp)
    if (before.type === 'mate' && before.value > 0 && after.type === 'cp') {
      return {
        lossCp: 1000, // Significant proxy penalty
        lossType: 'mate_lost'
      };
    }

    // Case 3: Mover was not getting mated, now getting mated (e.g. cp -> -M1)
    if (before.type === 'cp' && after.type === 'mate' && after.value < 0) {
      return {
        lossCp: 1000,
        lossType: 'mate_allowed'
      };
    }

    // Case 4: Both are mate scores
    if (before.type === 'mate' && after.type === 'mate') {
      // Had mate (+M2), now opponent has mate (-M1) -> catastrophic
      if (before.value > 0 && after.value < 0) {
        return {
          lossCp: 2000,
          lossType: 'mate_lost'
        };
      }
      // Had mate in 2 (+2), now mate in 4 (+4) -> delayed mate
      if (before.value > 0 && after.value > 0) {
        const delayedMoves = after.value - before.value;
        return {
          lossCp: delayedMoves > 0 ? delayedMoves * 50 : 0,
          lossType: 'mate_delayed'
        };
      }
      return {
        lossCp: 0,
        lossType: 'mate_to_mate'
      };
    }

    return {
      lossCp: 0,
      lossType: 'cp'
    };
  }

  return {
    parseEngineScore: parseEngineScore,
    normalizeToWhite: normalizeToWhite,
    normalizeToMover: normalizeToMover,
    calculateEvaluationLoss: calculateEvaluationLoss
  };
});
