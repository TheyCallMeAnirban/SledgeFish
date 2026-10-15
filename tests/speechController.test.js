const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SpeechController,
  BaseSpeechProvider,
  FishAudioSpeechProvider
} = require('../speechController.js');

class MockSpeechProvider extends BaseSpeechProvider {
  constructor() {
    super();
    this.spokenTexts = [];
    this.cancelled = false;
  }
  async speak(text) {
    this.spokenTexts.push(text);
    return Promise.resolve();
  }
  cancel() {
    this.cancelled = true;
  }
}

test('SpeechController: respects mute toggle', async () => {
  const mock = new MockSpeechProvider();
  const controller = new SpeechController({ provider: mock, autoSpeak: true });

  controller.setMuted(true);
  await controller.enqueue('शानदार चाल!');
  assert.equal(mock.spokenTexts.length, 0);

  controller.setMuted(false);
  await controller.enqueue('शानदार चाल!');
  assert.equal(mock.spokenTexts.length, 1);
  assert.equal(mock.spokenTexts[0], 'शानदार चाल!');
});

test('SpeechController: manual test speaks even when autoSpeak is disabled', async () => {
  const mock = new MockSpeechProvider();
  const controller = new SpeechController({ provider: mock, autoSpeak: false });

  await controller.enqueue('साधारण चाल', { isManualTest: false });
  assert.equal(mock.spokenTexts.length, 0);

  await controller.enqueue('नमस्ते! यह एक टेस्ट है।', { isManualTest: true });
  assert.equal(mock.spokenTexts.length, 1);
  assert.equal(mock.spokenTexts[0], 'नमस्ते! यह एक टेस्ट है।');
});

test('SpeechController: cancel stops playback cleanly', () => {
  const mock = new MockSpeechProvider();
  const controller = new SpeechController({ provider: mock });

  controller.stop();
  assert.equal(mock.cancelled, true);
});

test('FishAudioSpeechProvider: configured with exact reference ID', () => {
  const provider = new FishAudioSpeechProvider();
  assert.equal(provider.voiceModelId, 'b3e2e78dfa3f4100a7b9be30175b06a7');
  assert.equal(provider.serverUrl, 'http://127.0.0.1:8000/api/tts');
});
