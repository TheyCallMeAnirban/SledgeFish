/**
 * SledgeFish - UCI Parser
 * Pure, testable parser for Stockfish UCI output protocol.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishUciParser = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Parses an "info ..." line from Stockfish UCI output.
   * Example:
   * "info depth 10 seldepth 14 multipv 1 score cp 35 nodes 45200 nps 1120000 time 40 pv e2e4 e7e5 g1f3"
   * "info depth 4 score mate 2 pv h5f7"
   * "info depth 4 score mate -1 pv a2a4"
   *
   * @param {string} line
   * @returns {Object|null} Parsed info object or null if not an info line
   */
  function parseInfoLine(line) {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed.startsWith('info ') && trimmed !== 'info') return null;
    // Lines like "info string ..." are purely informational logs, not engine search metrics
    if (trimmed.startsWith('info string')) return null;

    const tokens = trimmed.split(/\s+/);
    const info = {
      raw: trimmed,
      depth: null,
      seldepth: null,
      multipv: null,
      score: null,
      nodes: null,
      nps: null,
      timeMs: null,
      pv: []
    };

    let i = 1;
    while (i < tokens.length) {
      const token = tokens[i];

      if (token === 'depth' && i + 1 < tokens.length) {
        info.depth = parseInt(tokens[++i], 10);
      } else if (token === 'seldepth' && i + 1 < tokens.length) {
        info.seldepth = parseInt(tokens[++i], 10);
      } else if (token === 'multipv' && i + 1 < tokens.length) {
        info.multipv = parseInt(tokens[++i], 10);
      } else if (token === 'nodes' && i + 1 < tokens.length) {
        info.nodes = parseInt(tokens[++i], 10);
      } else if (token === 'nps' && i + 1 < tokens.length) {
        info.nps = parseInt(tokens[++i], 10);
      } else if (token === 'time' && i + 1 < tokens.length) {
        info.timeMs = parseInt(tokens[++i], 10);
      } else if (token === 'score' && i + 2 < tokens.length) {
        const scoreType = tokens[++i]; // 'cp' or 'mate'
        const scoreVal = parseInt(tokens[++i], 10);
        if ((scoreType === 'cp' || scoreType === 'mate') && !isNaN(scoreVal)) {
          // Perspective is 'engine' (i.e. from the perspective of the side whose turn it is to move)
          info.score = {
            type: scoreType,
            value: scoreVal,
            perspective: 'engine'
          };
        }
      } else if (token === 'pv') {
        // All remaining tokens are the Principal Variation moves
        info.pv = tokens.slice(i + 1);
        break;
      }
      i++;
    }

    return info;
  }

  /**
   * Parses a "bestmove ..." line from Stockfish UCI output.
   * Example:
   * "bestmove e2e4 ponder e7e5"
   * "bestmove (none)"
   *
   * @param {string} line
   * @returns {{ bestmove: string, ponder: string|null }|null}
   */
  function parseBestmoveLine(line) {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed.startsWith('bestmove ') && trimmed !== 'bestmove') return null;

    const tokens = trimmed.split(/\s+/);
    const bestmove = tokens[1] || '(none)';
    let ponder = null;

    const ponderIdx = tokens.indexOf('ponder');
    if (ponderIdx !== -1 && ponderIdx + 1 < tokens.length) {
      ponder = tokens[ponderIdx + 1];
    }

    return {
      bestmove: bestmove,
      ponder: ponder
    };
  }

  return {
    parseInfoLine: parseInfoLine,
    parseBestmoveLine: parseBestmoveLine
  };
});
