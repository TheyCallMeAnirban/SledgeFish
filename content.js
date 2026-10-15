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

  // Instantiate SpeechController
  let speechController = null;
  if (window.SledgeFishSpeech && window.SledgeFishSpeech.SpeechController) {
    try {
      speechController = new window.SledgeFishSpeech.SpeechController({
        autoSpeak: false, // Default false until manual test is verified
        speechServerUrl: 'http://127.0.0.1:8000/api/tts',
        referenceId: 'b3e2e78dfa3f4100a7b9be30175b06a7'
      });
      console.log('[SledgeFish] SpeechController initialized.');
    } catch (speechErr) {
      console.warn('[SledgeFish] SpeechController init failed:', speechErr);
    }
  }

  // Voice test button handler in overlay
  overlay.onTestVoiceRequested = () => {
    if (speechController) {
      overlay.setStatus('Testing Fish Audio voice...', false);
      const testSample = 'धोनी वाला हेलीकॉप्टर शॉट! क्या कमाल की चाल चली है!';
      speechController.enqueue(testSample, {
        isManualTest: true,
        onStart: () => {
          overlay.setStatus('Speaking sample...', false);
        },
        onEnd: () => {
          overlay.setStatus('Active', false);
        },
        onError: (err) => {
          console.warn('[SledgeFish] Speech sample error:', err);
          overlay.setStatus('Voice error: ' + (err.message || 'Check server'), true);
        }
      });
    } else {
      overlay.setStatus('SpeechController not available', true);
    }
  };

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
    if (speechController && speechController.autoSpeak && reaction.text) {
      speechController.enqueue(reaction.text);
    }
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

  // PositionManager instance for real-time move validation and snapshot generation
  let positionManager = null;
  if (window.SledgeFishPositionManager && window.SledgeFishPositionManager.PositionManager) {
    try {
      positionManager = new window.SledgeFishPositionManager.PositionManager();
    } catch (e) {
      console.warn('[SledgeFish] PositionManager init failed:', e);
    }
  }

  // MoveClassifier & TacticalInterpreter references
  const MoveClassifier = window.SledgeFishMoveClassifier;
  const TacticalInterpreter = window.SledgeFishTacticalInterpreter;

  // Stockfish Adapter instance for bot matches & post-game analysis
  // Engine analysis is only enabled on permitted pages (/play/computer/*, /analysis/*) and NEVER during live human-vs-human matches (/game/live/*)
  const isEnginePermittedPage = window.location.pathname.includes('/play/computer') ||
                                window.location.pathname.includes('/analysis') ||
                                window.location.pathname.includes('/practice');

  let stockfishAdapter = null;
  if (isEnginePermittedPage && window.SledgeFishStockfishAdapter) {
    try {
      let workerUrl = 'engine/stockfish.worker.js';
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        const scriptUrl = chrome.runtime.getURL('engine/stockfish.worker.js');
        const wasmUrl = chrome.runtime.getURL('engine/stockfish.wasm');
        workerUrl = `${scriptUrl}#${encodeURIComponent(wasmUrl)}`;
      }
      stockfishAdapter = new window.SledgeFishStockfishAdapter({ workerUrl: workerUrl });
      stockfishAdapter.init().then(() => {
        console.log('[SledgeFish] Stockfish engine initialized for bot/analysis session.');
      }).catch(err => {
        console.warn('[SledgeFish] Stockfish init deferred/failed:', err);
      });
    } catch (e) {
      console.warn('[SledgeFish] Could not create StockfishAdapter:', e);
    }
  }

  // Cache last position evaluation to calculate move quality
  let lastEvalScore = null;

  // Move Tracker instance
  const moveTracker = new MoveTracker({
    onNewMove: async (move) => {
      if (!isEnabled) return;

      const event = EventClassifier.classify(move);
      let snapshot = null;

      // Update position manager
      if (positionManager) {
        try {
          snapshot = positionManager.playMove(move.san);
        } catch (err) {
          try {
            positionManager.reset();
            const allMoves = moveTracker.lastMoves || [];
            for (let i = 0; i < allMoves.length; i++) {
              snapshot = positionManager.playMove(allMoves[i].san);
            }
          } catch (resyncErr) {
            console.warn('[SledgeFish] PositionManager resync failed:', resyncErr);
          }
        }
      }

      // Initial reaction with snapshot metadata (piece, square) immediately
      let initialFinding = {
        ...event,
        snapshot: snapshot,
        quality: 'UNCLASSIFIED',
        san: move.san,
        ply: move.ply,
        color: move.color
      };

      // Always display immediate reaction for responsiveness
      const initialReaction = commentaryEngine.generate(initialFinding, currentPersonality);
      overlay.showReaction(initialReaction);

      // If engine is permitted and active, evaluate move quality dynamically
      if (stockfishAdapter && snapshot && snapshot.fenAfter) {
        try {
          // If we do not have an evaluation for fenBefore yet, get it first
          let evalBefore = lastEvalScore;
          if (!evalBefore && snapshot.fenBefore) {
            const beforeResult = await stockfishAdapter.analyze(snapshot.fenBefore, { depth: 6, movetime: 120 });
            evalBefore = beforeResult.scoreWhite;
          }

          // Analyze position after the move
          const evalResult = await stockfishAdapter.analyze(snapshot.fenAfter, { depth: 6, movetime: 120 });
          const currentEval = evalResult.scoreWhite;

          if (MoveClassifier && evalBefore && currentEval) {
            const qualityResult = MoveClassifier.classifyMoveQuality({
              scoreBefore: evalBefore,
              scoreAfter: currentEval,
              moverColor: move.color,
              playedSan: move.san,
              playedLan: snapshot.lan,
              bestmoveUci: evalResult.bestmoveUci,
              bestmoveSan: evalResult.bestmoveSan,
              snapshot: snapshot
            });

            // Extract tactical motifs (hanging piece, royal fork, missed mate, free capture)
            let tacticalFinding = null;
            if (TacticalInterpreter && TacticalInterpreter.interpretTactics) {
              tacticalFinding = TacticalInterpreter.interpretTactics({
                snapshot: snapshot,
                quality: qualityResult.quality
              });
            }

            // Update overlay with evaluated move quality and tactical motif
            if (qualityResult.quality && qualityResult.quality !== 'UNCLASSIFIED') {
              const qualityFinding = {
                ...event,
                ...qualityResult,
                tactics: tacticalFinding,
                snapshot: snapshot,
                san: move.san,
                ply: move.ply,
                color: move.color
              };
              const qualityReaction = commentaryEngine.generate(qualityFinding, currentPersonality);
              overlay.showReaction(qualityReaction);
              if (speechController && speechController.autoSpeak && qualityReaction.text) {
                speechController.enqueue(qualityReaction.text);
              }
            }
          }

          lastEvalScore = currentEval;
        } catch (engineErr) {
          console.warn('[SledgeFish] Engine move evaluation error:', engineErr);
        }
      } else {
        // If not using Stockfish evaluation (e.g. live game or engine disabled), speak initial reaction if autoSpeak is true
        if (speechController && speechController.autoSpeak && initialReaction.text) {
          speechController.enqueue(initialReaction.text);
        }
      }
    },
    onReset: () => {
      if (positionManager) positionManager.reset();
      lastEvalScore = null;
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
      if (positionManager && initialMoves.length > 0) {
        try {
          positionManager.reset();
          for (let i = 0; i < initialMoves.length; i++) {
            positionManager.playMove(initialMoves[i].san);
          }
        } catch (e) {
          console.warn('[SledgeFish] Initial positionManager sync failed:', e);
        }
      }
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
