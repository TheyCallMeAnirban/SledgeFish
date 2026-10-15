const test = require('node:test');
const assert = require('node:assert/strict');
const initEngine = require('stockfish');
const StockfishAdapter = require('../engine/stockfishAdapter.js');

test('Stockfish Integration: analyzes live FEN with bundled Stockfish engine', async () => {
  // Wrap Node.js stockfish engine in an adapter-compatible interface
  let listenerCallback = null;
  const engineInstance = initEngine((line) => {
    if (listenerCallback) listenerCallback(line);
  });

  const workerBridge = {
    postMessage: (cmd) => engineInstance.processCommand(cmd),
    listener: (fn) => { listenerCallback = fn; },
    addMessageListener: (fn) => { listenerCallback = fn; },
    terminate: () => {
      try {
        engineInstance.processCommand('quit');
      } catch (e) {}
    }
  };

  const adapter = new StockfishAdapter({
    worker: workerBridge,
    initTimeoutMs: 5000
  });

  // Position: White to move, Scholar's Mate threat
  // FEN: r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4
  // Stockfish must find Qxf7# (mate 1)
  const mateFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const result = await adapter.analyze(mateFen, { depth: 5 });

  assert.equal(result.turn, 'white');
  assert.equal(result.bestmoveUci, 'h5f7');
  assert.equal(result.bestmoveSan, 'Qxf7#');
  assert.equal(result.isBestmoveLegal, true);
  assert(result.depth >= 1);
  assert.equal(result.scoreWhite.type, 'mate');
  assert.equal(result.scoreWhite.value, 1);
  assert.equal(result.scoreMover.type, 'mate');
  assert.equal(result.scoreMover.value, 1);

  adapter.terminate();
});
