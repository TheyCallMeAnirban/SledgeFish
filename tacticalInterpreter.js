/**
 * SledgeFish - Tactical Motif Interpreter
 * Analyzes chess positions to extract semantic tactical motifs:
 * - HANGING_PIECE (piece left completely undefended and attacked)
 * - FORK (single piece attacks two or more valuable opponent pieces)
 * - PIN (piece cannot move without exposing a higher value piece or king)
 * - MISSED_MATE (mover missed a 1-move checkmate)
 * - FREE_CAPTURE (capturing an undefended piece without giving up material)
 * - CHECKMATE_ATTACK (delivering checkmate or devastating mating net)
 * - DEVELOPMENT (routine positional or opening piece development)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    let chessModule;
    try {
      chessModule = require('chess.js');
    } catch (e) {
      chessModule = require('./lib/chess.min.js');
    }
    const Chess = chessModule.Chess || chessModule;
    module.exports = factory(Chess);
  } else {
    const Chess = (root.ChessJs && root.ChessJs.Chess) || root.Chess;
    root.SledgeFishTacticalInterpreter = factory(Chess);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ChessConstructor) {
  'use strict';

  if (!ChessConstructor) {
    throw new Error('TacticalInterpreter requires Chess constructor from chess.js.');
  }

  // Piece material point values for tactical severity assessment
  const PIECE_VALUES = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 100
  };

  const HINDI_PIECE_NAMES = {
    p: 'प्यादा',
    n: 'घोड़ा',
    b: 'ऊंट',
    r: 'हाथी',
    q: 'वज़ीर',
    k: 'राजा'
  };

  /**
   * Identifies all pieces of a given color currently attacked by the opponent.
   *
   * @param {Object} chess - Chess instance
   * @param {'w'|'b'} targetColor - Color of the pieces to evaluate
   * @returns {Array<{square: string, piece: string, attackers: string[]}>}
   */
  function findAttackedPieces(chess, targetColor) {
    const opponentColor = targetColor === 'w' ? 'b' : 'w';
    const attacked = [];

    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === targetColor) {
          const square = piece.square;
          // Check if opponent attacks this square
          if (chess.isAttacked(square, opponentColor)) {
            const attackers = typeof chess.attackers === 'function' ?
              chess.attackers(square, opponentColor) : [];
            attacked.push({
              square: square,
              piece: piece.type,
              attackers: attackers
            });
          }
        }
      }
    }
    return attacked;
  }

  /**
   * Checks if a square is defended by friendly pieces.
   *
   * @param {Object} chess - Chess instance
   * @param {string} square - Square to test (e.g. 'e4')
   * @param {'w'|'b'} friendlyColor - Color of defending pieces
   * @returns {boolean}
   */
  function isSquareDefended(chess, square, friendlyColor) {
    if (typeof chess.attackers === 'function') {
      const defenders = chess.attackers(square, friendlyColor);
      return defenders && defenders.length > 0;
    }
    // Fallback: check friendly attack
    return chess.isAttacked(square, friendlyColor);
  }

  /**
   * Detects if the played move missed an immediate 1-move checkmate.
   *
   * @param {string} fenBefore - FEN before the move was played
   * @returns {string|null} Mate-in-1 move SAN if missed, else null
   */
  function detectMissedMateInOne(fenBefore) {
    if (!fenBefore) return null;
    try {
      const c = new ChessConstructor(fenBefore);
      const moves = c.moves({ verbose: true });
      for (let i = 0; i < moves.length; i++) {
        c.move(moves[i]);
        const isMate = c.isCheckmate();
        c.undo();
        if (isMate) {
          return moves[i].san;
        }
      }
    } catch (e) {
      // Ignore fen parsing errors
    }
    return null;
  }

  /**
   * Detects if the moved piece forks 2 or more opponent pieces of value >= 3 or King.
   *
   * @param {Object} chessAfter - Chess instance after the move
   * @param {string} toSquare - Square the piece moved to
   * @param {'w'|'b'} moverColor - Color of the mover
   * @returns {Array<{square: string, piece: string}>|null}
   */
  function detectFork(chessAfter, toSquare, moverColor) {
    const opponentColor = moverColor === 'w' ? 'b' : 'w';
    const forkedTargets = [];

    const board = chessAfter.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const target = board[r][c];
        if (target && target.color === opponentColor) {
          // Check if moved piece attacks this target
          if (typeof chessAfter.attackers === 'function') {
            const attackers = chessAfter.attackers(target.square, moverColor);
            if (attackers.includes(toSquare)) {
              if (target.type === 'k' || target.type === 'q' || target.type === 'r' || target.type === 'b' || target.type === 'n') {
                forkedTargets.push({
                  square: target.square,
                  piece: target.type,
                  hindiPiece: HINDI_PIECE_NAMES[target.type]
                });
              }
            }
          } else {
            // General attack check
            if (chessAfter.isAttacked(target.square, moverColor) && (target.type === 'k' || target.type === 'q' || target.type === 'r')) {
              forkedTargets.push({
                square: target.square,
                piece: target.type,
                hindiPiece: HINDI_PIECE_NAMES[target.type]
              });
            }
          }
        }
      }
    }

    return forkedTargets.length >= 2 ? forkedTargets : null;
  }

  /**
   * Detects if mover hung a piece:
   * 1. Moved piece was placed on an attacked, undefended square.
   * 2. Or mover left an existing high-value piece (Queen, Rook, Bishop, Knight) undefended and under attack.
   *
   * @param {Object} chessAfter - Chess instance after move
   * @param {string} toSquare - Target square
   * @param {string} pieceType - Piece type ('q','r','b','n','p')
   * @param {'w'|'b'} moverColor - Color of mover
   * @returns {{ hungPiece: string, square: string }|null}
   */
  function detectHangingPiece(chessAfter, toSquare, pieceType, moverColor) {
    const opponentColor = moverColor === 'w' ? 'b' : 'w';

    // 1. Check if the piece that just moved was hung
    if (pieceType !== 'p' && pieceType !== 'k') {
      const isAttacked = chessAfter.isAttacked(toSquare, opponentColor);
      if (isAttacked) {
        const isDefended = isSquareDefended(chessAfter, toSquare, moverColor);
        if (!isDefended) {
          return { hungPiece: pieceType, square: toSquare };
        }
        // Attacked by lower value piece?
        if (typeof chessAfter.attackers === 'function') {
          const attackers = chessAfter.attackers(toSquare, opponentColor);
          for (let i = 0; i < attackers.length; i++) {
            const attackerPiece = chessAfter.get(attackers[i]);
            if (attackerPiece && PIECE_VALUES[attackerPiece.type] < PIECE_VALUES[pieceType]) {
              return { hungPiece: pieceType, square: toSquare };
            }
          }
        }
      }
    }

    // 2. Check if an existing valuable piece (Q, R, B, N) was left hanging
    const board = chessAfter.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === moverColor && piece.type !== 'p' && piece.type !== 'k') {
          const sq = piece.square;
          if (chessAfter.isAttacked(sq, opponentColor)) {
            const isDefended = isSquareDefended(chessAfter, sq, moverColor);
            if (!isDefended) {
              return { hungPiece: piece.type, square: sq };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Interprets a move and extracts semantic chess tactical motifs.
   *
   * @param {Object} params
   * @param {Object} params.snapshot - PositionManager move snapshot
   * @param {string} [params.quality] - Classified move quality ('BLUNDER', 'MISTAKE', etc.)
   * @returns {Object} Tactical interpretation
   */
  function interpretTactics(params = {}) {
    const { snapshot, quality } = params;

    if (!snapshot || !snapshot.fenBefore || !snapshot.fenAfter) {
      return {
        motif: 'DEVELOPMENT',
        description: 'Standard move',
        details: {}
      };
    }

    const cBefore = new ChessConstructor(snapshot.fenBefore);
    const cAfter = new ChessConstructor(snapshot.fenAfter);

    const moverColorShort = snapshot.moverColor === 'white' ? 'w' : 'b';
    const toSquare = snapshot.to;
    const pieceType = snapshot.piece;
    const isBlunderOrMistake = quality === 'BLUNDER' || quality === 'MISTAKE';

    // 1. Check for Checkmate
    if (snapshot.isCheckmate) {
      return {
        motif: 'CHECKMATE_DELIVERED',
        description: 'Delivered game-ending checkmate',
        details: { piece: HINDI_PIECE_NAMES[pieceType], square: toSquare }
      };
    }

    // 2. Check for Missed Mate (If blunder and mate in 1 was available before)
    if (isBlunderOrMistake) {
      const missedMateSan = detectMissedMateInOne(snapshot.fenBefore);
      if (missedMateSan && missedMateSan !== snapshot.san) {
        return {
          motif: 'MISSED_MATE',
          description: `Missed immediate checkmate in 1 (${missedMateSan})`,
          details: { missedMateSan: missedMateSan, piece: HINDI_PIECE_NAMES[pieceType], square: toSquare }
        };
      }
    }

    // 3. Check for Hanging Piece (Blunder or Mistake where piece was hung)
    if (isBlunderOrMistake) {
      const hungInfo = detectHangingPiece(cAfter, toSquare, pieceType, moverColorShort);
      if (hungInfo) {
        return {
          motif: 'HANGING_PIECE',
          description: `Hung ${HINDI_PIECE_NAMES[hungInfo.hungPiece]} on ${hungInfo.square}`,
          details: { piece: HINDI_PIECE_NAMES[hungInfo.hungPiece], square: hungInfo.square, pieceType: hungInfo.hungPiece }
        };
      }
    }

    // 4. Check for Free Capture
    if (snapshot.captured && snapshot.captured !== 'p') {
      const wasCapturedSquareDefended = isSquareDefended(cBefore, toSquare, moverColorShort === 'w' ? 'b' : 'w');
      if (!wasCapturedSquareDefended) {
        return {
          motif: 'FREE_CAPTURE',
          description: `Won free ${HINDI_PIECE_NAMES[snapshot.captured]} on ${toSquare}`,
          details: { capturedPiece: HINDI_PIECE_NAMES[snapshot.captured], square: toSquare }
        };
      }
    }

    // 5. Check for Fork (Knight, Queen, Pawn or Rook forking multiple pieces)
    const forkTargets = detectFork(cAfter, toSquare, moverColorShort);
    if (forkTargets && forkTargets.length >= 2) {
      return {
        motif: 'FORK',
        description: `Forked multiple pieces with ${HINDI_PIECE_NAMES[pieceType]}`,
        details: {
          piece: HINDI_PIECE_NAMES[pieceType],
          targets: forkTargets.map(t => t.hindiPiece),
          targetSquares: forkTargets.map(t => t.square)
        }
      };
    }

    // 6. Check for Discovered Check / Check
    if (snapshot.isCheck) {
      return {
        motif: 'CHECK_ATTACK',
        description: `Attacked the King with ${HINDI_PIECE_NAMES[pieceType]}`,
        details: { piece: HINDI_PIECE_NAMES[pieceType], square: toSquare }
      };
    }

    // 7. Check for Castling
    if (snapshot.flags && (snapshot.flags.includes('k') || snapshot.flags.includes('q'))) {
      return {
        motif: 'CASTLING_SAFETY',
        description: 'Tucked King into shelter',
        details: { square: toSquare }
      };
    }

    // Default: Development / Positional move
    return {
      motif: 'DEVELOPMENT',
      description: 'Standard strategic development',
      details: { piece: HINDI_PIECE_NAMES[pieceType], square: toSquare }
    };
  }

  return {
    PIECE_VALUES: PIECE_VALUES,
    HINDI_PIECE_NAMES: HINDI_PIECE_NAMES,
    findAttackedPieces: findAttackedPieces,
    isSquareDefended: isSquareDefended,
    detectMissedMateInOne: detectMissedMateInOne,
    detectFork: detectFork,
    detectHangingPiece: detectHangingPiece,
    interpretTactics: interpretTactics
  };
});
