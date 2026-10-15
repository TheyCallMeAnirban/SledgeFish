/**
 * SledgeFish - Stockfish Adapter
 * Manages engine lifecycle, UCI message exchanges, position evaluations, and request cancellation.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const uciParser = require('./uciParser.js');
    const scoreNormalizer = require('../scoreNormalizer.js');
    let chessModule;
    try {
      chessModule = require('chess.js');
    } catch (e) {
      chessModule = require('../lib/chess.min.js');
    }
    const Chess = chessModule.Chess || chessModule;
    module.exports = factory(uciParser, scoreNormalizer, Chess);
  } else {
    const uciParser = root.SledgeFishUciParser;
    const scoreNormalizer = root.SledgeFishScoreNormalizer;
    const Chess = (root.ChessJs && root.ChessJs.Chess) || root.Chess;
    root.SledgeFishStockfishAdapter = factory(uciParser, scoreNormalizer, Chess);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (uciParser, scoreNormalizer, ChessConstructor) {
  'use strict';

  if (!uciParser || !scoreNormalizer) {
    throw new Error('StockfishAdapter requires uciParser and scoreNormalizer.');
  }

  const { parseInfoLine, parseBestmoveLine } = uciParser;
  const { normalizeToWhite } = scoreNormalizer;

  /**
   * Adapter States:
   * 'UNINITIALIZED' -> 'INITIALIZING' -> 'READY' -> 'SEARCHING' -> 'READY' -> 'TERMINATED'
   */
  class StockfishAdapter {
    /**
     * @param {Object} options
     * @param {Function|Object} options.worker - Worker instance or factory function returning a worker
     * @param {string} [options.workerUrl] - URL to worker script (in browser extension environment)
     */
    constructor(options = {}) {
      this.options = options;
      this.worker = null;
      this.status = 'UNINITIALIZED';
      this.activeRequestId = 0;
      this.currentRequest = null;
      this.messageListeners = new Set();
      this.lastInfo = null;
      this.isReadyPromise = null;
    }

    /**
     * Initializes the engine and sends initial UCI setup.
     * @returns {Promise<boolean>}
     */
    async init() {
      if (this.status === 'READY') return true;
      if (this.status === 'INITIALIZING' && this.isReadyPromise) {
        return this.isReadyPromise;
      }

      this.status = 'INITIALIZING';

      this.isReadyPromise = new Promise((resolve, reject) => {
        try {
          if (this.options.worker) {
            if (typeof this.options.worker === 'function') {
              this.worker = this.options.worker();
            } else {
              this.worker = this.options.worker;
            }
          } else if (typeof Worker !== 'undefined') {
            const workerUrl = this.options.workerUrl ||
              (typeof chrome !== 'undefined' && chrome.runtime?.getURL ?
                chrome.runtime.getURL('engine/stockfish.worker.js') :
                'engine/stockfish.worker.js');
            this.worker = new Worker(workerUrl);
          } else {
            throw new Error('No Worker implementation or worker option provided.');
          }

          const onWorkerMessage = (e) => {
            const line = typeof e === 'string' ? e : (e.data || '');
            this._handleLine(line);
          };

          if (this.worker.addEventListener) {
            this.worker.addEventListener('message', onWorkerMessage);
          } else if (this.worker.onmessage !== undefined) {
            this.worker.onmessage = onWorkerMessage;
          } else if (typeof this.worker.addMessageListener === 'function') {
            this.worker.addMessageListener(onWorkerMessage);
          } else if (this.worker.listener !== undefined) {
            this.worker.listener = onWorkerMessage;
          }

          let uciOkReceived = false;
          let readyOkReceived = false;

          const initListener = (line) => {
            if (line === 'uciok') {
              uciOkReceived = true;
              this.sendCommand('isready');
            } else if (line === 'readyok') {
              readyOkReceived = true;
              this.removeMessageListener(initListener);
              this.status = 'READY';
              resolve(true);
            }
          };

          this.addMessageListener(initListener);
          this.sendCommand('uci');

          // Timeout fallback for initialization
          setTimeout(() => {
            if (!readyOkReceived) {
              this.removeMessageListener(initListener);
              this.status = 'ERROR';
              reject(new Error('Engine initialization timed out waiting for readyok.'));
            }
          }, this.options.initTimeoutMs || 10000);

        } catch (err) {
          this.status = 'ERROR';
          reject(err);
        }
      });

      return this.isReadyPromise;
    }

    /**
     * Sends a raw command line to the worker.
     * @param {string} cmd
     */
    sendCommand(cmd) {
      if (!this.worker) return;
      if (typeof this.worker.postMessage === 'function') {
        this.worker.postMessage(cmd);
      } else if (typeof this.worker.processCommand === 'function') {
        this.worker.processCommand(cmd);
      }
    }

    /**
     * Adds a listener for raw UCI output lines.
     * @param {Function} fn
     */
    addMessageListener(fn) {
      this.messageListeners.add(fn);
    }

    /**
     * Removes a listener for raw UCI output lines.
     * @param {Function} fn
     */
    removeMessageListener(fn) {
      this.messageListeners.delete(fn);
    }

    /**
     * Central dispatch for incoming lines from Stockfish.
     * @param {string} line
     * @private
     */
    _handleLine(line) {
      if (!line) return;
      const trimmed = line.trim();

      // Dispatch to external listeners
      for (const listener of this.messageListeners) {
        try {
          listener(trimmed);
        } catch (err) {
          console.error('[StockfishAdapter] Error in message listener:', err);
        }
      }

      // If we are currently executing an analysis request
      if (this.currentRequest && this.status === 'SEARCHING') {
        // Parse info lines
        if (trimmed.startsWith('info ')) {
          const info = parseInfoLine(trimmed);
          if (info && info.depth) {
            this.lastInfo = info;
            if (typeof this.currentRequest.onProgress === 'function') {
              this.currentRequest.onProgress(info);
            }
          }
        } else if (trimmed.startsWith('bestmove ')) {
          const parsed = parseBestmoveLine(trimmed);
          const req = this.currentRequest;
          this.currentRequest = null;
          this.status = 'READY';

          if (req && !req.isCancelled) {
            const finalResult = this._formatResult(req, this.lastInfo, parsed);
            req.resolve(finalResult);
          }
        }
      }
    }

    /**
     * Formats the final analysis result.
     * @private
     */
    _formatResult(req, info, bestmoveParsed) {
      const bestmoveUci = bestmoveParsed ? bestmoveParsed.bestmove : '(none)';
      const ponderUci = bestmoveParsed ? bestmoveParsed.ponder : null;

      // Determine mover turn from FEN
      const fenTokens = (req.fen || '').trim().split(/\s+/);
      const turn = fenTokens[1] || 'w';

      let scoreWhite = null;
      let scoreMover = null;

      if (info && info.score) {
        // Stockfish reports score from the perspective of the side to move
        scoreWhite = normalizeToWhite(info.score, { turn: turn });
        const isWhite = turn === 'w';
        scoreMover = {
          type: scoreWhite.type,
          value: isWhite ? scoreWhite.value : -scoreWhite.value,
          perspective: 'mover'
        };
      }

      // Convert bestmove UCI (e.g. e2e4) to SAN if ChessConstructor is available
      let bestmoveSan = bestmoveUci;
      let isBestmoveLegal = false;

      if (ChessConstructor && bestmoveUci && bestmoveUci !== '(none)') {
        try {
          const c = new ChessConstructor(req.fen);
          const from = bestmoveUci.slice(0, 2);
          const to = bestmoveUci.slice(2, 4);
          const promotion = bestmoveUci.length > 4 ? bestmoveUci[4] : undefined;
          const m = c.move({ from: from, to: to, promotion: promotion });
          if (m) {
            bestmoveSan = m.san;
            isBestmoveLegal = true;
          }
        } catch (e) {
          isBestmoveLegal = false;
        }
      }

      return {
        requestId: req.id,
        fen: req.fen,
        turn: turn === 'w' ? 'white' : 'black',
        bestmoveUci: bestmoveUci,
        bestmoveSan: bestmoveSan,
        isBestmoveLegal: isBestmoveLegal,
        ponderUci: ponderUci,
        scoreWhite: scoreWhite,
        scoreMover: scoreMover,
        depth: (info && info.depth) ? info.depth : null,
        seldepth: (info && info.seldepth) ? info.seldepth : null,
        nodes: (info && info.nodes) ? info.nodes : null,
        timeMs: (info && info.timeMs) ? info.timeMs : null,
        pv: (info && info.pv) ? info.pv : []
      };
    }

    /**
     * Cancels any active search.
     */
    cancel() {
      if (this.currentRequest) {
        this.currentRequest.isCancelled = true;
        this.currentRequest.reject(new Error('Analysis cancelled.'));
        this.currentRequest = null;
      }
      if (this.status === 'SEARCHING') {
        this.sendCommand('stop');
        this.status = 'READY';
      }
    }

    /**
     * Evaluates a chess position given by FEN.
     *
     * @param {string} fen - Valid FEN string
     * @param {Object} [options]
     * @param {number} [options.depth=8] - Target search depth
     * @param {number} [options.movetime] - Max search time in ms
     * @param {Function} [options.onProgress] - Optional progress callback
     * @returns {Promise<Object>} Structured analysis result
     */
    analyze(fen, options = {}) {
      if (!fen || typeof fen !== 'string') {
        return Promise.reject(new TypeError('analyze() requires a valid FEN string.'));
      }

      if (this.status !== 'READY' && this.status !== 'SEARCHING') {
        return this.init().then(() => this.analyze(fen, options));
      }

      // Cancel previous search if still running to prevent stale results
      this.cancel();

      this.status = 'SEARCHING';
      this.lastInfo = null;
      const requestId = ++this.activeRequestId;

      const depth = options.depth || 8;
      const movetime = options.movetime || null;

      let reqResolve, reqReject;
      const promise = new Promise((resolve, reject) => {
        reqResolve = resolve;
        reqReject = reject;
      });

      const req = {
        id: requestId,
        fen: fen.trim(),
        depth: depth,
        movetime: movetime,
        onProgress: options.onProgress,
        isCancelled: false,
        resolve: reqResolve,
        reject: reqReject
      };

      this.currentRequest = req;

      // Send UCI position & search commands
      this.sendCommand(`position fen ${req.fen}`);
      if (movetime) {
        this.sendCommand(`go movetime ${movetime}`);
      } else {
        this.sendCommand(`go depth ${depth}`);
      }

      return promise;
    }

    /**
     * Terminates the worker.
     */
    terminate() {
      this.cancel();
      this.sendCommand('quit');
      if (this.worker && typeof this.worker.terminate === 'function') {
        this.worker.terminate();
      }
      this.worker = null;
      this.status = 'TERMINATED';
      this.messageListeners.clear();
    }
  }

  return StockfishAdapter;
});
