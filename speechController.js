/**
 * SledgeFish - Speech Provider Interface & Audio Queue
 * Handles speech synthesis with replaceable backend providers, speech queues,
 * mute/unmute toggling, overlap protection, and non-blocking failure tolerance.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishSpeechController = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Base Replaceable Speech Provider Interface
   */
  class BaseSpeechProvider {
    /**
     * @param {string} text - Text to speak
     * @param {Object} [options]
     * @returns {Promise<HTMLAudioElement|null>}
     */
    async speak(text, options = {}) {
      throw new Error('speak() must be implemented by SpeechProvider subclass.');
    }

    /**
     * Cancel / stop current playback
     */
    cancel() {}
  }

  /**
   * Fish Audio Speech Provider via Local FastAPI Proxy
   */
  class FishAudioSpeechProvider extends BaseSpeechProvider {
    /**
     * @param {Object} options
     * @param {string} [options.serverUrl='http://127.0.0.1:8000/api/tts']
     * @param {string} [options.voiceModelId='b3e2e78dfa3f4100a7b9be30175b06a7']
     */
    constructor(options = {}) {
      super();
      this.serverUrl = options.serverUrl || 'http://127.0.0.1:8000/api/tts';
      this.healthUrl = options.healthUrl || 'http://127.0.0.1:8000/health';
      this.voiceModelId = options.voiceModelId || 'b3e2e78dfa3f4100a7b9be30175b06a7';
      this.currentAudio = null;
    }

    async checkHealth() {
      try {
        const resp = await fetch(this.healthUrl, { method: 'GET' });
        if (resp.ok) {
          const data = await resp.json();
          return { available: true, ...data };
        }
      } catch (e) {
        // Server offline
      }
      return { available: false, api_key_configured: false };
    }

    async speak(text, options = {}) {
      if (!text || typeof text !== 'string') return null;

      const voiceId = options.voiceModelId || this.voiceModelId;
      const resp = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          reference_id: voiceId,
          format: 'mp3',
          mp3_bitrate: 128
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Speech server error (${resp.status}): ${errText}`);
      }

      const blob = await resp.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      this.currentAudio = audio;

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) this.currentAudio = null;
          resolve();
        };
        audio.onerror = (e) => {
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) this.currentAudio = null;
          reject(e);
        };
        audio.play().catch(reject);
      });
    }

    cancel() {
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
        } catch (e) {}
        this.currentAudio = null;
      }
    }
  }

  /**
   * Browser Native SpeechSynthesis Provider (Fallback / Zero-dependency)
   */
  class NativeBrowserSpeechProvider extends BaseSpeechProvider {
    speak(text, options = {}) {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = options.lang || 'hi-IN';
          utterance.rate = options.rate || 1.0;
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          resolve();
        }
      });
    }

    cancel() {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  }

  /**
   * Speech Controller & Audio Queue
   * Coordinates serialization, muting, and error containment so speech failures
   * never interrupt the game or commentary overlay.
   */
  class SpeechController {
    constructor(options = {}) {
      this.isMuted = options.isMuted || false;
      this.autoSpeak = options.autoSpeak || false; // Defaults to false until manual test succeeds
      this.provider = options.provider || new FishAudioSpeechProvider();
      this.fallbackProvider = new NativeBrowserSpeechProvider();
      this.queue = [];
      this.isPlaying = false;
      this.onError = options.onError || (() => {});
    }

    setMuted(muted) {
      this.isMuted = !!muted;
      if (this.isMuted) {
        this.stop();
      }
    }

    setAutoSpeak(enabled) {
      this.autoSpeak = !!enabled;
    }

    setProvider(newProvider) {
      this.stop();
      this.provider = newProvider;
    }

    /**
     * Enqueues or plays speech.
     * @param {string} text - Hindi commentary text
     * @param {Object} [options]
     * @param {boolean} [options.isManualTest=false] - If true, plays regardless of autoSpeak setting
     */
    async enqueue(text, options = {}) {
      if (this.isMuted) return;
      if (!options.isManualTest && !this.autoSpeak) return;

      // Discard queue backlog if more than 2 items to prevent delayed commentary pileup
      if (this.queue.length > 1) {
        this.queue.shift();
      }

      this.queue.push({ text: text, options: options });
      this._processQueue();
    }

    async _processQueue() {
      if (this.isPlaying || this.queue.length === 0) return;
      this.isPlaying = true;

      const item = this.queue.shift();

      try {
        await this.provider.speak(item.text, item.options);
      } catch (err) {
        console.warn('[SledgeFish Speech] Primary provider failed, attempting native fallback:', err.message);
        this.onError(err);
        try {
          // Attempt graceful fallback to native speech
          await this.fallbackProvider.speak(item.text, item.options);
        } catch (fallbackErr) {
          // Swallowed completely to protect move commentary
        }
      } finally {
        this.isPlaying = false;
        if (this.queue.length > 0) {
          this._processQueue();
        }
      }
    }

    stop() {
      this.queue = [];
      this.isPlaying = false;
      if (this.provider) this.provider.cancel();
      if (this.fallbackProvider) this.fallbackProvider.cancel();
    }
  }

  return {
    BaseSpeechProvider: BaseSpeechProvider,
    FishAudioSpeechProvider: FishAudioSpeechProvider,
    NativeBrowserSpeechProvider: NativeBrowserSpeechProvider,
    SpeechController: SpeechController
  };
});
