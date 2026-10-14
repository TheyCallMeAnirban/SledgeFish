/**
 * SledgeFish Lite - Content Script
 * Coordinates move observation, event classification, and commentary on Chess.com
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__sledgefish_injected) {
    return;
  }
  window.__sledgefish_injected = true;

  // Global references
  const MoveTrackerModule = window.SledgeFishMoveTracker;
  const EventClassifier = window.SledgeFishEventClassifier;
  const CommentaryEngineModule = window.SledgeFishCommentaryEngine;
  const Overlay = window.SledgeFishOverlay;

  if (!MoveTrackerModule || !EventClassifier || !CommentaryEngineModule || !Overlay) {
    console.error('[SledgeFish] Missing required modules.');
    return;
  }

  const { SELECTORS, extractMoves, MoveTracker } = MoveTrackerModule;
  const commentaryEngine = new CommentaryEngineModule.CommentaryEngine();

  // Settings state
  let isEnabled = true;
  let currentPersonality = 'unhinged';

  // Instantiate UI overlay
  const overlay = new Overlay();
  overlay.setPersonality(currentPersonality);
  overlay.setStatus('Initializing...', false);

  // Allow user to click the "SF" logo to trigger a quick test reaction
  overlay.onTestRequested = () => {
    const sampleEvents = [
      { type: 'MOVE', san: 'e4', ply: 1, color: 'white' },
      { type: 'CAPTURE', san: 'Bxe5', ply: 12, color: 'white' },
      { type: 'CHECK', san: 'Bb5+', ply: 7, color: 'white' },
      { type: 'CASTLING', san: 'O-O', ply: 10, color: 'black' }
    ];
    const rand = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
    const reaction = commentaryEngine.generate(rand, currentPersonality);
    overlay.showReaction(reaction);
  };

  // Sync settings with storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sledgefish_enabled', 'sledgefish_personality'], (result) => {
      if (typeof result.sledgefish_enabled === 'boolean') {
        isEnabled = result.sledgefish_enabled;
      }
      if (result.sledgefish_personality) {
        currentPersonality = result.sledgefish_personality;
      }

      overlay.setPersonality(currentPersonality);
      if (!isEnabled) {
        overlay.setStatus('Paused (Disabled in settings)', true);
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.sledgefish_enabled) {
          isEnabled = changes.sledgefish_enabled.newValue;
          if (!isEnabled) {
            overlay.setStatus('Paused (Disabled in settings)', true);
          } else {
            overlay.setStatus('Active', false);
          }
        }
        if (changes.sledgefish_personality) {
          currentPersonality = changes.sledgefish_personality.newValue;
          overlay.setPersonality(currentPersonality);
        }
      }
    });
  }

  // Move Tracker instance
  const moveTracker = new MoveTracker({
    onNewMove: (move) => {
      if (!isEnabled) return;

      const event = EventClassifier.classify(move);
      const reaction = commentaryEngine.generate(event, currentPersonality);
      overlay.showReaction(reaction);
    },
    onReset: () => {
      overlay.setStatus('New game detected', false);
    }
  });

  let moveContainerObserver = null;
  let boardObserver = null;
  let activeContainer = null;
  let debounceTimeout = null;
  let gameOverDetected = false;

  /**
   * Processes current DOM move list
   */
  function processMoveList() {
    try {
      // Extract moves from activeContainer or anywhere in the document
      const currentMoves = extractMoves(activeContainer || document);
      
      if (currentMoves.length > 0) {
        moveTracker.sync(currentMoves);
      }

      // Check for game over dialog
      checkGameOver();
    } catch (err) {
      console.warn('[SledgeFish] Error reading moves:', err);
    }
  }

  /**
   * Debounced wrapper for DOM mutations
   */
  function handleMutation() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      processMoveList();
    }, 50);
  }

  /**
   * Checks for game over dialogs / modals
   */
  function checkGameOver() {
    if (gameOverDetected) return;

    const modal = document.querySelector(SELECTORS.gameOver);
    if (modal) {
      gameOverDetected = true;
      if (isEnabled) {
        const endEvent = {
          type: 'GAME_ENDED',
          san: '',
          ply: moveTracker.lastMoves.length,
          color: 'white'
        };
        const reaction = commentaryEngine.generate(endEvent, currentPersonality);
        overlay.showReaction(reaction);
      }
      overlay.setStatus('Game concluded', true);
    }
  }

  /**
   * Attaches mutation observers
   */
  function attachObservers(container) {
    if (container && container !== activeContainer) {
      if (moveContainerObserver) {
        moveContainerObserver.disconnect();
      }

      activeContainer = container;
      gameOverDetected = false;

      // Initial silent sync: do not replay existing historical moves
      const initialMoves = extractMoves(activeContainer);
      moveTracker.sync(initialMoves, { isInitialLoad: true });
      overlay.setInitialState(initialMoves);

      moveContainerObserver = new MutationObserver(handleMutation);
      moveContainerObserver.observe(activeContainer, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Also observe the chessboard directly if not already observing
    if (!boardObserver) {
      const boardEl = document.querySelector(SELECTORS.board);
      if (boardEl) {
        boardObserver = new MutationObserver(handleMutation);
        boardObserver.observe(boardEl, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        });
      }
    }
  }

  /**
   * Finds the move container in the DOM dynamically
   */
  function findMoveContainer() {
    // 1. Direct selector match
    let el = document.querySelector(SELECTORS.moveContainer);
    if (el) return el;

    // 2. Discover via any visible move element
    const plyEl = document.querySelector('[data-ply], .move-node, .node');
    if (plyEl) {
      const parent = plyEl.closest('vertical-move-list, [class*="move-list"], [class*="moveList"], [class*="move_list"], .move-list-component, .layout-move-list, #board-layout-sidebar, div');
      if (parent) return parent;
    }

    // 3. Fallback to sidebar container
    return document.querySelector('#board-layout-sidebar, .sidebar-component, #board-layout-main');
  }

  // Initial setup
  function initialScan() {
    const container = findMoveContainer();
    if (container) {
      attachObservers(container);
    } else {
      // Check if moves exist anywhere in the document
      const docMoves = extractMoves(document);
      if (docMoves.length > 0) {
        moveTracker.sync(docMoves, { isInitialLoad: true });
        overlay.setInitialState(docMoves);
      } else {
        overlay.setStatus('Waiting for game moves...', !isEnabled);
      }
    }
  }

  initialScan();

  // Periodic container check (handles SPA navigation, bot matches, and dynamic renders)
  setInterval(() => {
    const container = findMoveContainer();
    if (container && container !== activeContainer) {
      attachObservers(container);
    }
    // Also periodically process moves in case mutations were swallowed
    processMoveList();
  }, 1000);

  // Expose for testing and manual debugging in console
  window.__sledgefish_instance = {
    tracker: moveTracker,
    classifier: EventClassifier,
    engine: commentaryEngine,
    overlay: overlay,
    extractMoves: () => extractMoves(activeContainer || document)
  };

  console.log('[SledgeFish Lite] Extension loaded and actively monitoring the board.');
})();
