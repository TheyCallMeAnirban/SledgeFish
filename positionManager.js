/**
 * SledgeFish - Position Manager
 * Manages chess positions, PGN parsing, and sequential state reconstruction using chess.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    let chessModule;
    try {
      chessModule = require('chess.js');
    } catch (e) {
      // In case path resolution needs dist
      chessModule = require('./lib/chess.min.js');
    }
    const Chess = chessModule.Chess || chessModule;
    module.exports = factory(Chess);
  } else {
    const Chess = (root.ChessJs && root.ChessJs.Chess) || root.Chess;
    root.SledgeFishPositionManager = factory(Chess);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ChessConstructor) {
  'use strict';

  if (!ChessConstructor) {
    throw new Error('PositionManager requires Chess constructor from chess.js.');
  }

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  /**
   * PositionManager manages a chess game state and move progression.
   */
  class PositionManager {
    /**
     * @param {string} [initialFen] - Optional starting FEN
     */
    constructor(initialFen) {
      this.initialFen = initialFen ? initialFen.trim() : START_FEN;
      this.chess = new ChessConstructor(this.initialFen);
      this.history = []; // Array of move snapshots
    }

    /**
     * Resets to initial position or a new FEN.
     * @param {string} [fen]
     */
    reset(fen) {
      this.initialFen = fen ? fen.trim() : START_FEN;
      this.chess = new ChessConstructor(this.initialFen);
      this.history = [];
    }

    /**
     * Returns the current FEN string.
     * @returns {string}
     */
    getFen() {
      return this.chess.fen();
    }

    /**
     * Returns whose turn it is ('w' or 'b').
     * @returns {'w'|'b'}
     */
    getTurn() {
      return this.chess.turn();
    }

    /**
     * Plays a single move and returns a detailed snapshot before and after the move.
     *
     * @param {string|Object} move - SAN (e.g. "e4", "Nf3") or move object (e.g. { from: 'e2', to: 'e4', promotion: 'q' })
     * @returns {Object} Snapshot
     * @throws {Error} If move is illegal
     */
    playMove(move) {
      const fenBefore = this.chess.fen();
      const ply = this.history.length + 1;
      const turnBefore = this.chess.turn();
      const moverColor = turnBefore === 'w' ? 'white' : 'black';
      const moveNumber = Math.floor(this.history.length / 2) + 1;

      let result;
      try {
        result = this.chess.move(move);
      } catch (err) {
        throw new Error(`Illegal move at ply ${ply} (${moverColor} move #${moveNumber}): ${err.message || move}`);
      }

      if (!result) {
        throw new Error(`Illegal move at ply ${ply} (${moverColor} move #${moveNumber}): "${typeof move === 'string' ? move : JSON.stringify(move)}"`);
      }

      const fenAfter = this.chess.fen();

      const snapshot = {
        ply: ply,
        moveNumber: moveNumber,
        moverColor: moverColor,
        san: result.san,
        lan: result.lan || `${result.from}${result.to}${result.promotion || ''}`,
        from: result.from,
        to: result.to,
        piece: result.piece,
        captured: result.captured || null,
        promotion: result.promotion || null,
        flags: result.flags,
        fenBefore: fenBefore,
        fenAfter: fenAfter,
        legalMoves: this.chess.moves({ verbose: true }),
        isCheck: this.chess.inCheck(),
        isCheckmate: this.chess.isCheckmate(),
        isDraw: this.chess.isDraw(),
        isGameOver: this.chess.isGameOver()
      };

      this.history.push(snapshot);
      return snapshot;
    }

    /**
     * Replays an ordered sequence of moves.
     *
     * @param {Array<string|Object>} moveList - Array of moves
     * @returns {Array<Object>} Array of all snapshots generated
     * @throws {Error} On any illegal move (never silently skips)
     */
    loadMoveSequence(moveList) {
      if (!Array.isArray(moveList)) {
        throw new TypeError('loadMoveSequence expects an array of moves.');
      }

      this.reset(this.initialFen);
      const snapshots = [];

      for (let i = 0; i < moveList.length; i++) {
        const move = moveList[i];
        const snapshot = this.playMove(move);
        snapshots.push(snapshot);
      }

      return snapshots;
    }

    /**
     * Parses and replays a complete PGN string.
     * Supports standard PGN tags including [FEN "..."] for custom starts.
     *
     * @param {string} pgnString
     * @returns {{ headers: Object, snapshots: Array<Object>, result: string }}
     * @throws {Error} If PGN is malformed or contains illegal moves
     */
    loadPgn(pgnString) {
      if (typeof pgnString !== 'string' || pgnString.trim().length === 0) {
        throw new Error('loadPgn expects a non-empty string.');
      }

      const tempGame = new ChessConstructor();
      try {
        tempGame.loadPgn(pgnString);
      } catch (err) {
        throw new Error(`Malformed PGN: ${err.message}`);
      }

      const headers = tempGame.header ? tempGame.header() : {};
      const customFen = headers.FEN || headers.fen;

      // Extract moves from the parsed game history
      const historyMoves = tempGame.history({ verbose: true });

      // Initialize this instance with the FEN (standard or custom)
      this.reset(customFen || START_FEN);
      const snapshots = [];

      for (let i = 0; i < historyMoves.length; i++) {
        const m = historyMoves[i];
        // Use SAN to replay sequentially through playMove
        const snapshot = this.playMove(m.san);
        snapshots.push(snapshot);
      }

      return {
        headers: headers,
        snapshots: snapshots,
        result: headers.Result || (tempGame.isGameOver() ? (tempGame.isCheckmate() ? (tempGame.turn() === 'b' ? '1-0' : '0-1') : '1/2-1/2') : '*')
      };
    }
  }

  return {
    START_FEN: START_FEN,
    PositionManager: PositionManager
  };
});
