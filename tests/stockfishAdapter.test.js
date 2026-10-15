const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInfoLine, parseBestmoveLine } = require('../engine/uciParser.js');
const StockfishAdapter = require('../engine/stockfishAdapter.js');

test('uciParser: parses standard info lines with cp score', () => {
  const line = 'info depth 10 seldepth 14 multipv 1 score cp 35 nodes 45200 nps 1120000 time 40 pv e2e4 e7e5 g1f3';
  const parsed = parseInfoLine(line);

  assert.equal(parsed.depth, 10);
  assert.equal(parsed.seldepth, 14);
  assert.equal(parsed.multipv, 1);
  assert.deepEqual(parsed.score, { type: 'cp', value: 35, perspective: 'engine' });
  assert.equal(parsed.nodes, 45200);
  assert.equal(parsed.nps, 1120000);
  assert.equal(parsed.timeMs, 40);
  assert.deepEqual(parsed.pv, ['e2e4', 'e7e5', 'g1f3']);
});

test('uciParser: parses mate score lines (positive and negative)', () => {
  const linePositive = 'info depth 4 score mate 2 pv h5f7';
  const parsedPos = parseInfoLine(linePositive);
  assert.equal(parsedPos.depth, 4);
  assert.deepEqual(parsedPos.score, { type: 'mate', value: 2, perspective: 'engine' });
  assert.deepEqual(parsedPos.pv, ['h5f7']);

  const lineNegative = 'info depth 3 score mate -1 nodes 15 pv a2a4';
  const parsedNeg = parseInfoLine(lineNegative);
  assert.deepEqual(parsedNeg.score, { type: 'mate', value: -1, perspective: 'engine' });
  assert.equal(parsedNeg.nodes, 15);
});

test('uciParser: handles missing fields and non-info lines safely', () => {
  assert.equal(parseInfoLine(''), null);
  assert.equal(parseInfoLine('uciok'), null);
  assert.equal(parseInfoLine('info string Starting new search'), null); // No depth or score
  const parsedDepthOnly = parseInfoLine('info depth 1');
  assert.equal(parsedDepthOnly.depth, 1);
  assert.equal(parsedDepthOnly.score, null);
});

test('uciParser: parses bestmove and ponder', () => {
  const b1 = parseBestmoveLine('bestmove e2e4 ponder e7e5');
  assert.deepEqual(b1, { bestmove: 'e2e4', ponder: 'e7e5' });

  const b2 = parseBestmoveLine('bestmove d8h4');
  assert.deepEqual(b2, { bestmove: 'd8h4', ponder: null });

  const b3 = parseBestmoveLine('bestmove (none)');
  assert.deepEqual(b3, { bestmove: '(none)', ponder: null });
});

// Mock Worker implementation for adapter unit testing
class MockWorker {
  constructor() {
    this.listener = null;
    this.sentCommands = [];
    this.isReady = false;
  }

  postMessage(cmd) {
    this.sentCommands.push(cmd);
    if (cmd === 'uci') {
      setTimeout(() => this._emit('uciok'), 10);
    } else if (cmd === 'isready') {
      this.isReady = true;
      setTimeout(() => this._emit('readyok'), 10);
    } else if (cmd.startsWith('go')) {
      setTimeout(() => {
        this._emit('info depth 5 score cp 50 nodes 1200 time 20 pv e2e4');
        this._emit('bestmove e2e4 ponder e7e5');
      }, 20);
    }
  }

  _emit(line) {
    if (this.listener) this.listener(line);
  }

  terminate() {
    this.listener = null;
  }
}

test('StockfishAdapter: initializes and performs analysis with mock worker', async () => {
  const mockWorker = new MockWorker();
  const adapter = new StockfishAdapter({ worker: mockWorker });

  assert.equal(adapter.status, 'UNINITIALIZED');

  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const result = await adapter.analyze(startFen, { depth: 5 });

  assert.equal(adapter.status, 'READY');
  assert.equal(result.bestmoveUci, 'e2e4');
  assert.equal(result.bestmoveSan, 'e4');
  assert.equal(result.isBestmoveLegal, true);
  assert.equal(result.turn, 'white');
  assert.deepEqual(result.scoreWhite, { type: 'cp', value: 50, perspective: 'white' });
  assert.deepEqual(result.scoreMover, { type: 'cp', value: 50, perspective: 'mover' });
  assert.equal(result.depth, 5);

  adapter.terminate();
  assert.equal(adapter.status, 'TERMINATED');
});

test('StockfishAdapter: handles cancellation properly', async () => {
  const mockWorker = new MockWorker();
  const adapter = new StockfishAdapter({ worker: mockWorker });

  await adapter.init();

  const promise = adapter.analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { depth: 10 });
  adapter.cancel();

  await assert.rejects(promise, /Analysis cancelled/);
  assert(mockWorker.sentCommands.includes('stop'));

  adapter.terminate();
});
