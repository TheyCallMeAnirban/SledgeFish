/**
 * SledgeFish Lite - Popup Script
 * Handles settings persistence and preview in the extension popup
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled');
  const selectPersonality = document.getElementById('select-personality');
  const statusDot = document.getElementById('popup-status-dot');
  const statusText = document.getElementById('popup-status-text');
  const previewQuote = document.getElementById('preview-quote');
  const previewTag = document.getElementById('preview-tag');
  const btnTestReaction = document.getElementById('btn-test-reaction');

  const engine = (typeof SledgeFishCommentaryEngine !== 'undefined')
    ? new SledgeFishCommentaryEngine.CommentaryEngine()
    : null;

  function updateStatus(enabled) {
    if (enabled) {
      statusDot.classList.remove('inactive');
      statusText.textContent = 'Active';
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = 'Paused';
    }
  }

  function updatePreview() {
    if (!engine) return;
    const personality = selectPersonality.value || 'unhinged';
    const sampleEvents = [
      { type: 'CAPTURE', san: 'Bxe5' },
      { type: 'CHECK', san: 'Bb5+' },
      { type: 'CASTLING', san: 'O-O' },
      { type: 'PROMOTION', san: 'e8=Q' },
      { type: 'MOVE', san: 'Nf3' }
    ];
    const randEvent = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
    const reaction = engine.generate(randEvent, personality);
    
    previewQuote.textContent = `"${reaction.text}"`;
    previewTag.textContent = `${personality.toUpperCase()} · ${randEvent.type}`;
  }

  // Load saved settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sledgefish_enabled', 'sledgefish_personality'], (result) => {
      if (typeof result.sledgefish_enabled === 'boolean') {
        toggleEnabled.checked = result.sledgefish_enabled;
      } else {
        toggleEnabled.checked = true;
      }

      if (result.sledgefish_personality) {
        selectPersonality.value = result.sledgefish_personality;
      } else {
        selectPersonality.value = 'unhinged';
      }

      updateStatus(toggleEnabled.checked);
      updatePreview();
    });
  } else {
    updatePreview();
  }

  // Handle toggle change
  toggleEnabled.addEventListener('change', () => {
    const isEnabled = toggleEnabled.checked;
    updateStatus(isEnabled);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ sledgefish_enabled: isEnabled });
    }
  });

  // Handle personality change
  selectPersonality.addEventListener('change', () => {
    const personality = selectPersonality.value;
    updatePreview();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ sledgefish_personality: personality });
    }
  });

  // Test reaction button
  btnTestReaction.addEventListener('click', () => {
    updatePreview();
  });
});
