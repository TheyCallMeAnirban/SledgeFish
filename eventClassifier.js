/**
 * SledgeFish Lite - Event Classifier
 * Identifies observable chess events from Standard Algebraic Notation (SAN)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishEventClassifier = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Classifies a normalized move object into a structured event
   * @param {Object} move - { ply: number, san: string, color: string }
   * @returns {Object} Structured event object
   */
  function classify(move) {
    if (!move || !move.san) {
      return {
        type: 'MOVE',
        san: '',
        ply: 0,
        color: 'white',
        isCapture: false,
        isCheck: false,
        isCheckmate: false,
        isCastling: false,
        isPromotion: false,
        flags: ['MOVE']
      };
    }

    const san = move.san.trim();
    const flags = [];

    // Checkmate
    const isCheckmate = san.endsWith('#');
    if (isCheckmate) flags.push('CHECKMATE');

    // Check (not checkmate)
    const isCheck = !isCheckmate && san.endsWith('+');
    if (isCheck) flags.push('CHECK');

    // Castling
    const isCastling = san.startsWith('O-O') || san.startsWith('0-0');
    if (isCastling) flags.push('CASTLING');

    // Promotion
    const isPromotion = san.includes('=');
    if (isPromotion) flags.push('PROMOTION');

    // Capture
    const isCapture = san.includes('x');
    if (isCapture) flags.push('CAPTURE');

    // If no special flags, it's an ordinary move
    if (flags.length === 0) {
      flags.push('MOVE');
    }

    // Determine primary type by priority
    let primaryType = 'MOVE';
    if (isCheckmate) {
      primaryType = 'CHECKMATE';
    } else if (isCastling) {
      primaryType = 'CASTLING';
    } else if (isPromotion) {
      primaryType = 'PROMOTION';
    } else if (isCapture) {
      primaryType = 'CAPTURE';
    } else if (isCheck) {
      primaryType = 'CHECK';
    }

    return {
      type: primaryType,
      san: san,
      ply: move.ply,
      color: move.color || (move.ply % 2 === 1 ? 'white' : 'black'),
      isCapture: isCapture,
      isCheck: isCheck,
      isCheckmate: isCheckmate,
      isCastling: isCastling,
      isPromotion: isPromotion,
      flags: flags
    };
  }

  return {
    classify: classify
  };
});
