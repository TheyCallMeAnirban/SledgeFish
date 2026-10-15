/**
 * SledgeFish - Move Quality Classifier
 * Classifies chess moves based on engine evaluation loss, material balance, and legal positions.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const scoreNormalizer = require('./scoreNormalizer.js');
    module.exports = factory(scoreNormalizer);
  } else {
    const scoreNormalizer = root.SledgeFishScoreNormalizer;
    root.SledgeFishMoveClassifier = factory(scoreNormalizer);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (scoreNormalizer) {
  'use strict';

  if (!scoreNormalizer) {
    throw new Error('MoveClassifier requires scoreNormalizer module.');
  }

  const { calculateEvaluationLoss, normalizeToMover } = scoreNormalizer;

  /**
   * Move Quality Categories:
   * 'BRILLIANT'   - Exceptional tactical move, often involving a sound sacrifice that maintains winning advantage
   * 'EXCELLENT'   - Top engine move or near-zero evaluation loss (loss <= 15 cp)
   * 'GOOD'        - Solid practical move with negligible evaluation loss (loss <= 40 cp)
   * 'INACCURACY'  - Slight suboptimal move (40 < loss <= 100 cp)
   * 'MISTAKE'     - Significant error worsening the position (100 < loss <= 250 cp)
   * 'BLUNDER'     - Catastrophic error dropping significant material or allowing checkmate (loss > 250 cp)
   * 'UNCLASSIFIED'- When engine evaluation is unavailable (e.g. live human-vs-human games)
   */

  /**
   * Checks if a move was forced (only 1 legal move was available for the side to move).
   * Note: As specified, FORCED is a separate positional property, not a quality category.
   *
   * @param {Object} positionSnapshot - PositionManager snapshot containing legalMoves or position info
   * @returns {boolean}
   */
  function isMoveForced(positionSnapshot) {
    if (!positionSnapshot) return false;
    if (Array.isArray(positionSnapshot.legalMoves)) {
      return positionSnapshot.legalMoves.length === 1;
    }
    return false;
  }

  /**
   * Classifies a played move based on evaluation before and after, engine's best move, and position context.
   *
   * @param {Object} params
   * @param {Object} [params.scoreBefore] - Evaluation before move (any perspective)
   * @param {Object} [params.scoreAfter]  - Evaluation after move (any perspective)
   * @param {string} params.moverColor    - 'white' | 'black'
   * @param {string} [params.playedSan]   - Played move SAN (e.g. "Qd5")
   * @param {string} [params.playedLan]   - Played move LAN (e.g. "d8d5")
   * @param {string} [params.bestmoveUci] - Engine recommended best move in UCI
   * @param {string} [params.bestmoveSan] - Engine recommended best move in SAN
   * @param {Object} [params.snapshot]    - Position snapshot from PositionManager
   * @returns {Object} Structured classification
   */
  function classifyMoveQuality(params = {}) {
    const {
      scoreBefore,
      scoreAfter,
      moverColor,
      playedSan,
      playedLan,
      bestmoveUci,
      bestmoveSan,
      snapshot
    } = params;

    const isForced = isMoveForced(snapshot);

    // If no engine evaluations are provided (e.g. during live human-vs-human games)
    if (!scoreBefore || !scoreAfter || !moverColor) {
      return {
        quality: 'UNCLASSIFIED',
        lossCp: 0,
        lossType: 'none',
        isForced: isForced,
        isBestMove: false,
        playedSan: playedSan || (snapshot ? snapshot.san : ''),
        bestmoveSan: bestmoveSan || null,
        confidence: 'none',
        reason: 'Engine evaluation not available'
      };
    }

    const lossInfo = calculateEvaluationLoss(scoreBefore, scoreAfter, moverColor);
    const lossCp = lossInfo.lossCp;
    const lossType = lossInfo.lossType;

    const moverBefore = normalizeToMover(scoreBefore, moverColor);
    const moverAfter = normalizeToMover(scoreAfter, moverColor);

    // Check if played move matches engine's best move
    let isBestMove = false;
    if (playedSan && bestmoveSan && playedSan === bestmoveSan) {
      isBestMove = true;
    } else if (playedLan && bestmoveUci && (playedLan === bestmoveUci || playedLan.startsWith(bestmoveUci))) {
      isBestMove = true;
    }

    let quality = 'GOOD';
    let reason = 'Solid move';

    // 1. Blunder cases:
    if (lossType === 'mate_lost' || lossType === 'mate_allowed') {
      quality = 'BLUNDER';
      reason = lossType === 'mate_lost' ? 'Lost a forced checkmate' : 'Allowed opponent a forced checkmate';
    } else if (lossCp > 250) {
      quality = 'BLUNDER';
      reason = `Significant evaluation loss (-${(lossCp / 100).toFixed(1)} pawns)`;
    } else if (lossCp > 100) {
      quality = 'MISTAKE';
      reason = `Worsened position (-${(lossCp / 100).toFixed(1)} pawns)`;
    } else if (lossCp > 40) {
      quality = 'INACCURACY';
      reason = `Minor inaccuracy (-${(lossCp / 100).toFixed(1)} pawns)`;
    } else if (isBestMove || lossCp <= 15) {
      // Check for BRILLIANT:
      // Genuine criteria: Mover sacrifices a piece (piece captured or left hanging)
      // while preserving a completely winning position (mover evaluation > +200 cp or mate),
      // and it was the engine's best or only winning move.
      const isSacrifice = snapshot && (snapshot.piece !== 'p') && (snapshot.captured || snapshot.isSacrifice);
      const isWinningPosition = (moverAfter.type === 'mate' && moverAfter.value > 0) || (moverAfter.type === 'cp' && moverAfter.value >= 200);

      if (isBestMove && isSacrifice && isWinningPosition && lossCp === 0) {
        quality = 'BRILLIANT';
        reason = 'Verified tactical sacrifice maintaining winning advantage';
      } else {
        quality = isBestMove ? 'EXCELLENT' : 'GOOD';
        reason = isBestMove ? 'Engine top choice' : 'Accurate positional move';
      }
    } else {
      quality = 'GOOD';
      reason = 'Playable move';
    }

    return {
      quality: quality,
      lossCp: lossCp,
      lossType: lossType,
      isForced: isForced,
      isBestMove: isBestMove,
      playedSan: playedSan || (snapshot ? snapshot.san : ''),
      bestmoveSan: bestmoveSan || null,
      scoreMoverBefore: moverBefore,
      scoreMoverAfter: moverAfter,
      confidence: 'verified',
      reason: reason
    };
  }

  return {
    isMoveForced: isMoveForced,
    classifyMoveQuality: classifyMoveQuality
  };
});
