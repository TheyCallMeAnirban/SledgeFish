/**
 * SledgeFish Lite - Floating Commentary Overlay
 * Manages the rendered commentary panel on Chess.com
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishOverlay = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class Overlay {
    constructor() {
      this.root = null;
      this.panel = null;
      this.isMinimized = false;
      this.currentPersonality = 'unhinged';
      this.onTestRequested = null;
      this.init();
    }

    init() {
      if (document.getElementById('sledgefish-overlay-root')) {
        this.root = document.getElementById('sledgefish-overlay-root');
        this.panel = this.root.querySelector('.sf-panel');
        return;
      }

      this.root = document.createElement('div');
      this.root.id = 'sledgefish-overlay-root';

      this.panel = document.createElement('div');
      this.panel.className = 'sf-panel';

      // Header
      const header = document.createElement('div');
      header.className = 'sf-header';

      const titleBox = document.createElement('div');
      titleBox.className = 'sf-title-box';

      const icon = document.createElement('span');
      icon.className = 'sf-logo-icon';
      icon.textContent = 'SF';
      icon.title = 'Click to test commentary reaction';
      icon.style.cursor = 'pointer';
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.onTestRequested === 'function') {
          this.onTestRequested();
        }
      });

      const title = document.createElement('span');
      title.className = 'sf-title';
      title.textContent = 'SledgeFish';

      const personaBadge = document.createElement('span');
      personaBadge.className = 'sf-persona-badge sf-persona-unhinged';
      personaBadge.id = 'sf-persona-badge';
      personaBadge.textContent = 'Unhinged';

      titleBox.appendChild(icon);
      titleBox.appendChild(title);
      titleBox.appendChild(personaBadge);

      const controls = document.createElement('div');
      controls.className = 'sf-controls';

      const voiceBtn = document.createElement('button');
      voiceBtn.className = 'sf-btn sf-voice-btn';
      voiceBtn.id = 'sf-voice-test-btn';
      voiceBtn.title = 'Test Voice / Speech (Fish Audio)';
      voiceBtn.innerHTML = '🔊';
      voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.onTestVoiceRequested === 'function') {
          this.onTestVoiceRequested();
        }
      });

      const minBtn = document.createElement('button');
      minBtn.className = 'sf-btn';
      minBtn.id = 'sf-min-btn';
      minBtn.title = 'Minimize / Expand';
      minBtn.textContent = '—';
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'sf-btn';
      closeBtn.id = 'sf-close-btn';
      closeBtn.title = 'Hide Panel';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
      });

      controls.appendChild(voiceBtn);
      controls.appendChild(minBtn);
      controls.appendChild(closeBtn);

      header.appendChild(titleBox);
      header.appendChild(controls);

      // Body
      const body = document.createElement('div');
      body.className = 'sf-body';

      const metaRow = document.createElement('div');
      metaRow.className = 'sf-meta-row';

      const eventBadge = document.createElement('span');
      eventBadge.className = 'sf-event-badge';
      eventBadge.id = 'sf-event-badge';
      eventBadge.textContent = 'READY';

      const moveInfo = document.createElement('span');
      moveInfo.className = 'sf-move-info';
      moveInfo.id = 'sf-move-info';
      moveInfo.textContent = 'Waiting for moves...';

      metaRow.appendChild(eventBadge);
      metaRow.appendChild(moveInfo);

      const textEl = document.createElement('p');
      textEl.className = 'sf-commentary-text';
      textEl.id = 'sf-commentary-text';
      textEl.textContent = 'Listening to the board. Play your move!';

      const statusBar = document.createElement('div');
      statusBar.className = 'sf-status-bar';

      const statusLeft = document.createElement('span');
      statusLeft.id = 'sf-status-left';
      const ind = document.createElement('span');
      ind.className = 'sf-indicator';
      ind.id = 'sf-indicator';
      statusLeft.appendChild(ind);
      statusLeft.appendChild(document.createTextNode(' Active'));

      const statusRight = document.createElement('span');
      statusRight.id = 'sf-status-right';
      statusRight.textContent = 'v0.1.0';

      statusBar.appendChild(statusLeft);
      statusBar.appendChild(statusRight);

      body.appendChild(metaRow);
      body.appendChild(textEl);
      body.appendChild(statusBar);

      this.panel.appendChild(header);
      this.panel.appendChild(body);
      this.root.appendChild(this.panel);

      document.body.appendChild(this.root);

      this.setupDragging(header);
    }

    setupDragging(handle) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.classList.contains('sf-logo-icon')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = this.root.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        this.root.style.right = 'auto';
        this.root.style.left = initialLeft + 'px';
        this.root.style.top = initialTop + 'px';

        const onMouseMove = (moveEvent) => {
          if (!isDragging) return;
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          const newLeft = Math.max(10, Math.min(window.innerWidth - 340, initialLeft + dx));
          const newTop = Math.max(10, Math.min(window.innerHeight - 80, initialTop + dy));

          this.root.style.left = newLeft + 'px';
          this.root.style.top = newTop + 'px';
        };

        const onMouseUp = () => {
          isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    setPersonality(personality) {
      this.currentPersonality = personality || 'unhinged';
      const badge = document.getElementById('sf-persona-badge');
      if (badge) {
        badge.className = `sf-persona-badge sf-persona-${this.currentPersonality}`;
        badge.textContent = this.currentPersonality.charAt(0).toUpperCase() + this.currentPersonality.slice(1);
      }
    }

    setInitialState(moves) {
      const moveInfo = document.getElementById('sf-move-info');
      const textEl = document.getElementById('sf-commentary-text');
      const eventBadge = document.getElementById('sf-event-badge');

      if (moves && moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        const moveNumber = Math.ceil(lastMove.ply / 2);
        const colorName = lastMove.color ? (lastMove.color.charAt(0).toUpperCase() + lastMove.color.slice(1)) : 'White';
        
        if (moveInfo) {
          moveInfo.textContent = `Move ${moveNumber} (${colorName}): ${lastMove.san}`;
        }
        if (eventBadge) {
          eventBadge.className = 'sf-event-badge';
          eventBadge.textContent = 'SYNCED';
        }
        if (textEl) {
          textEl.textContent = `Watching game in progress (${moves.length} moves). Play your next move!`;
        }
        this.setStatus(`Watching game (${moves.length} moves)`, false);
      } else {
        if (moveInfo) {
          moveInfo.textContent = 'Game ready';
        }
        if (textEl) {
          textEl.textContent = 'Listening to the board. Play your move!';
        }
        this.setStatus('Active · Ready for move 1', false);
      }
    }

    showReaction(data) {
      if (!data) return;

      this.show();

      const textEl = document.getElementById('sf-commentary-text');
      const eventBadge = document.getElementById('sf-event-badge');
      const moveInfo = document.getElementById('sf-move-info');

      if (data.personality) {
        this.setPersonality(data.personality);
      }

      if (eventBadge) {
        let badgeLabel = (data.quality && data.quality !== 'UNCLASSIFIED') ? data.quality : (data.event || 'MOVE');
        if (data.contextKey && (data.contextKey === 'HANGING_PIECE' || data.contextKey === 'FORK' || data.contextKey === 'MISSED_MATE')) {
          badgeLabel = data.contextKey;
        }
        eventBadge.className = `sf-event-badge sf-ev-${badgeLabel}`;
        eventBadge.textContent = badgeLabel.replace('_', ' ');
      }

      if (moveInfo && data.san) {
        const moveNumber = data.ply ? Math.ceil(data.ply / 2) : 1;
        const colorName = data.color ? (data.color.charAt(0).toUpperCase() + data.color.slice(1)) : 'White';
        moveInfo.textContent = `Move ${moveNumber} (${colorName}): ${data.san}`;
      }

      if (textEl) {
        textEl.classList.remove('sf-fade-in');
        void textEl.offsetWidth; // Trigger reflow
        textEl.textContent = data.text || '';
        textEl.classList.add('sf-fade-in');
      }
    }

    setStatus(text, isPaused = false) {
      const statusLeft = document.getElementById('sf-status-left');
      const ind = document.getElementById('sf-indicator');
      if (ind) {
        if (isPaused) {
          ind.classList.add('sf-paused');
        } else {
          ind.classList.remove('sf-paused');
        }
      }
      if (statusLeft) {
        statusLeft.innerHTML = '';
        if (ind) statusLeft.appendChild(ind);
        statusLeft.appendChild(document.createTextNode(' ' + text));
      }
    }

    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
      if (this.panel) {
        this.panel.classList.toggle('sf-minimized', this.isMinimized);
      }
      const minBtn = document.getElementById('sf-min-btn');
      if (minBtn) {
        minBtn.textContent = this.isMinimized ? '□' : '—';
      }
    }

    show() {
      if (this.root) {
        this.root.style.display = 'block';
      }
    }

    hide() {
      if (this.root) {
        this.root.style.display = 'none';
      }
    }

    destroy() {
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
      this.panel = null;
    }
  }

  return Overlay;
});
