/**
 * SledgeFish Lite - Move Tracker
 * Extracts, tracks, and synchronizes visible move history on Chess.com
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishMoveTracker = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Centralized selectors with extensive fallbacks across all Chess.com layouts
  // (Live, Play Computer/Bots, Analysis, Daily, Puzzles)
  const SELECTORS = {
    // Containers holding the move list
    moveContainer: [
      'vertical-move-list',
      '.vertical-move-list',
      'wc-vertical-move-list',
      'wc-move-list',
      '.move-list',
      '[class*="move-list"]',
      '[class*="moveList"]',
      '[class*="move_list"]',
      '.move-list-component',
      '.layout-move-list',
      '[data-cy*="move-list"]',
      '#board-layout-sidebar',
      '.sidebar-component'
    ].join(', '),

    // Move rows containing half-moves
    moveRows: '.move, div[data-whole-move-number], [class*="move-row"]',

    // Individual half-move nodes (plies)
    moveNodes: [
      '[data-ply]',
      '.node',
      '.move-node',
      '[class*="move-node"]',
      '[class*="node-"]',
      '.move-text-component',
      '.san',
      '.move [class*="text"]'
    ].join(', '),

    // Figurine icons inside move nodes
    figurine: '[data-figurine], [class*="icon-font-chess"]',

    // Board container
    board: 'wc-chess-board, chess-board, #board-layout-chessboard, .board',

    // Game over dialogs/modals
    gameOver: [
      '.game-over-modal',
      'div[role="dialog"][class*="game-over"]',
      'div[class*="game-over-dialog"]',
      'div[data-cy="game-over-modal"]'
    ].join(', ')
  };

  /**
   * Cleans raw text into standard algebraic notation (SAN)
   */
  function cleanSan(rawText, figurine) {
    if (!rawText && !figurine) return '';

    let text = (rawText || '').trim();

    // Remove any embedded evaluation scores or clock annotations (e.g., "$1", "0.05", "(0:15)", "1.")
    text = text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

    // Remove move numbers if accidentally captured (e.g. "1. e4" -> "e4", "2... Nf3" -> "Nf3")
    text = text.replace(/^\d+[\.\s]+/, '').trim();

    // If figurine is provided and text doesn't already start with it, prepend it
    const fig = (figurine || '').trim().toUpperCase();
    if (fig && !text.toUpperCase().startsWith(fig)) {
      // Clean non-standard glyphs or whitespace at start
      text = fig + text.replace(/^[^\w+x#=O0-]/, '');
    }

    // Standardize castling notation to uppercase O-O / O-O-O
    if (text === '0-0' || text === 'o-o') text = 'O-O';
    if (text === '0-0-0' || text === 'o-o-o') text = 'O-O-O';

    return text;
  }

  /**
   * Extracts move history from a container element or document
   * @param {Element} container - The DOM element containing move nodes
   * @returns {Array<{ply: number, san: string, color: string}>}
   */
  function extractMoves(container) {
    const root = container || (typeof document !== 'undefined' ? document : null);
    if (!root || !root.querySelectorAll) return [];

    // Query move nodes (prioritizing [data-ply])
    let nodes = root.querySelectorAll('[data-ply]');
    if (!nodes || nodes.length === 0) {
      nodes = root.querySelectorAll(SELECTORS.moveNodes);
    }
    // Fallback: search whole document if container didn't yield results
    if ((!nodes || nodes.length === 0) && typeof document !== 'undefined' && root !== document) {
      nodes = document.querySelectorAll('[data-ply]');
      if (!nodes || nodes.length === 0) {
        nodes = document.querySelectorAll(SELECTORS.moveNodes);
      }
    }

    if (!nodes || nodes.length === 0) return [];

    const plyMap = new Map();
    let autoPly = 1;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // Extract ply index
      let ply = null;
      if (node.dataset && node.dataset.ply) {
        ply = parseInt(node.dataset.ply, 10);
      } else if (node.getAttribute && node.getAttribute('data-ply')) {
        ply = parseInt(node.getAttribute('data-ply'), 10);
      }

      if (ply === null || isNaN(ply)) {
        ply = autoPly;
      }

      // If we already parsed this ply, skip duplicate inner elements
      if (plyMap.has(ply)) continue;

      // Extract figurine
      let figurine = '';
      const figurineEl = node.querySelector ? node.querySelector(SELECTORS.figurine) : null;
      if (figurineEl && figurineEl.getAttribute) {
        figurine = figurineEl.getAttribute('data-figurine') || '';
      }

      const san = cleanSan(node.textContent, figurine);

      // Validate SAN: must be non-empty and look like a chess move (e.g. e4, Nf3, O-O, etc.)
      if (san && san.length > 0 && !san.match(/^\d+$/)) {
        let color = (ply % 2 === 1) ? 'white' : 'black';
        if (node.classList && node.classList.contains('white')) color = 'white';
        if (node.classList && node.classList.contains('black')) color = 'black';

        plyMap.set(ply, {
          ply: ply,
          san: san,
          color: color
        });
        autoPly = ply + 1;
      }
    }

    // Return chronologically sorted moves
    return Array.from(plyMap.values()).sort((a, b) => a.ply - b.ply);
  }

  /**
   * Core MoveTracker class that maintains state and handles deduplication
   */
  class MoveTracker {
    constructor(options = {}) {
      this.lastMoves = [];
      this.isInitialized = false;
      this.onNewMove = options.onNewMove || (() => {});
      this.onReset = options.onReset || (() => {});
    }

    reset() {
      this.lastMoves = [];
      this.isInitialized = true;
      this.onReset();
    }

    sync(currentMoves, options = {}) {
      const safeMoves = Array.isArray(currentMoves) ? currentMoves : [];
      const isInitial = options.isInitialLoad || !this.isInitialized;

      // 1. Initial silent sync: do not replay historical reactions
      if (isInitial) {
        this.lastMoves = [...safeMoves];
        this.isInitialized = true;
        return { newMoves: [], isReset: false };
      }

      // 2. Board cleared / new game
      if (safeMoves.length === 0 && this.lastMoves.length > 0) {
        this.lastMoves = [];
        this.onReset();
        return { newMoves: [], isReset: true };
      }

      // 3. Move count decreased (navigation or takeback)
      if (safeMoves.length < this.lastMoves.length) {
        this.lastMoves = [...safeMoves];
        this.onReset();
        return { newMoves: [], isReset: true };
      }

      // 4. Prefix divergence check
      for (let i = 0; i < this.lastMoves.length; i++) {
        const oldMove = this.lastMoves[i];
        const newMove = safeMoves[i];
        if (!newMove || oldMove.san !== newMove.san || oldMove.ply !== newMove.ply) {
          this.lastMoves = [...safeMoves];
          this.onReset();
          return { newMoves: [], isReset: true };
        }
      }

      // 5. Identical history length -> rerender / hover / animation
      if (safeMoves.length === this.lastMoves.length) {
        return { newMoves: [], isReset: false };
      }

      // 6. New moves appended
      const newMoves = safeMoves.slice(this.lastMoves.length);
      this.lastMoves = [...safeMoves];

      for (let i = 0; i < newMoves.length; i++) {
        this.onNewMove(newMoves[i]);
      }

      return { newMoves: newMoves, isReset: false };
    }
  }

  return {
    SELECTORS: SELECTORS,
    cleanSan: cleanSan,
    extractMoves: extractMoves,
    MoveTracker: MoveTracker
  };
});
