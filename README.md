# SledgeFish Lite ♟️🎣

> **"Chess.com provides the game. SledgeFish provides the personality."**

SledgeFish Lite is a lightweight, personality-driven Chrome extension that observes live Chess.com games and delivers contextual, humorous, and entertaining commentary in real time.

---

## Features

- **Real-Time Contextual Commentary:** Reacts dynamically to observable moves, captures, checks, checkmates, castling, and promotions.
- **4 Distinct Personalities:**
  - 🔥 **Unhinged:** Exaggerated, chaotic, and dramatic reactions.
  - 😏 **Sarcastic:** Dry wit, cynical observations, and mild roasts.
  - 🎙️ **Professional:** Calm, restrained sports-broadcast commentary.
  - 🌱 **Supportive:** Warm, encouraging, and constructive tactical praise.
- **Anti-Repetition Engine:** Avoids immediately repeating the same commentary line for the same event type.
- **Zero Historical Spam:** When opening or joining an ongoing game, SledgeFish silently synchronizes without replaying past reactions.
- **Deduplication & Rerender Safety:** DOM mutations caused by piece hovering, board animations, or framework rerenders are ignored.
- **Floating Overlay:** Sleek, glassmorphic dark-mode panel with minimize/expand controls and draggable header that avoids obstructing chessboard controls.
- **Zero External Dependencies / Client-Side Only:** No backend, no accounts, no Stockfish engine, and no AI API keys required.

---

## Installation (Chrome Developer Mode)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project directory:
   ```text
   c:\Users\anirb\Desktop\dev\Projects\Chess_trash_Talk
   ```
6. The extension is now installed and active!

---

## How It Works

```text
       Chess.com DOM (vertical-move-list)
                      │
                      ▼
               [moveTracker.js]
    (Extracts SAN, handles figurines,
     debounces mutations, deduplicates)
                      │  Emits new moves only
                      ▼
              [eventClassifier.js]
    (Classifies: CAPTURE, CHECK, CASTLING,
     CHECKMATE, PROMOTION, MOVE)
                      │  Structured event
                      ▼
             [commentaryEngine.js]
    (Selects reaction based on personality;
     applies repetition avoidance)
                      │  Commentary text
                      ▼
                 [overlay.js]
    (Renders reaction in floating UI panel)
```

### Supported Observable Events

| Event | Trigger Pattern | Example SAN |
|---|---|---|
| `CHECKMATE` | Ends with `#` | `Qh5#`, `Bxf7#` |
| `CHECK` | Ends with `+` | `Bb5+`, `Nf7+` |
| `CASTLING` | Starts with `O-O` or `O-O-O` | `O-O`, `O-O-O` |
| `PROMOTION` | Contains `=` | `e8=Q`, `b1=N+` |
| `CAPTURE` | Contains `x` | `exd5`, `Bxe5` |
| `MOVE` | Standard quiet move | `e4`, `Nf3`, `d5` |
| `GAME_STARTED` | Move count transitions from 0 to 1 | 1st ply |
| `GAME_ENDED` | Game-over dialog or checkmate | Concluded match |

---

## File Structure

```text
Chess_trash_Talk/
├── manifest.json            # Manifest V3 extension configuration
├── content.js               # Content script coordinator
├── moveTracker.js           # Move extraction, synchronization & deduplication
├── eventClassifier.js       # SAN event categorization
├── commentaryEngine.js      # Personality dictionaries & repetition avoidance
├── overlay.js               # Floating panel DOM manager
├── styles.css               # Styling for floating overlay
├── popup.html               # Extension popup settings UI
├── popup.css                # Popup styles
├── popup.js                 # Popup logic & storage persistence
├── package.json             # Test scripts
├── icons/                   # Extension icons (16, 48, 128px)
├── docs/                    # Technical documentation
└── tests/
    ├── moveTracker.test.js      # Tests for tracking & deduplication
    ├── eventClassifier.test.js  # Tests for SAN event classification
    └── commentaryEngine.test.js # Tests for personalities & anti-repetition
```

---

## Testing

The project includes unit tests using Node.js's built-in test runner (`node:test`):

```bash
npm test
```

### Test Coverage Highlights:
- **Move Tracker:**
  - Historical move suppression on initial load (0 moves replayed).
  - Deduplication on rerenders and piece hovering.
  - Single and multi-move batch append detection.
  - Game reset and divergence handling.
  - Figurine icon extraction (`data-figurine` + SAN).
- **Event Classifier:**
  - Quiet moves, captures, checks, checkmate, castling (kingside/queenside), and promotions.
  - Compound events (`CAPTURE` + `CHECK`).
- **Commentary Engine:**
  - Non-empty reaction verification across all 4 personalities.
  - Anti-repetition validation on consecutive identical events.
  - Fallback safety for unknown events or personalities.

---

## Known Limitations (v0.1.0)

1. **No Engine Evaluation:** SledgeFish Lite reacts strictly to observable notation events. It intentionally does not use Stockfish or compute centipawn advantages; it will never falsely label a move as a "blunder" or "brilliant" without genuine evaluation data.
2. **En Passant:** Standard algebraic notation represents en passant identically to a normal pawn capture (e.g. `exd6`). It is cleanly classified under `CAPTURE`.
3. **DOM Selector Resilience:** Centralized selector definitions (`SELECTORS`) provide fallbacks for `<vertical-move-list>`, `.vertical-move-list`, `wc-vertical-move-list`, and `.move-list-component`.
