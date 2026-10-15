# SledgeFish ♟️🎙️

> **"Every move has a consequence. Every blunder deserves commentary."**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](manifest.json)
[![Stockfish](https://img.shields.io/badge/Engine-Stockfish%20WASM-orange.svg)](engine/)
[![chess.js](https://img.shields.io/badge/Board-chess.js-informational.svg)](lib/chess.min.js)
[![Tests Passing](https://img.shields.io/badge/Tests-55%20Passing-brightgreen.svg)](tests/)

**SledgeFish** is a Chrome extension that turns live Chess.com matches into an entertaining, educational Hindi cricket-commentary experience. It observes your board in real time, parses positional tactics and engine evaluations where permitted, and delivers sharp, culturally vibrant reactions through a sleek floating HUD and optional voice commentary.

Whether you just sacrificed a piece for a brilliant mate or hung your Queen on move 6, SledgeFish ensures you never suffer in silence.

---

## Table of Contents

- [The Commentary Booth is Open](#the-commentary-booth-is-open)
- [How Fun Becomes Learning](#how-fun-becomes-learning)
- [Commentator Personalities](#commentator-personalities)
- [Under the Hood](#under-the-hood)
- [Fair Play by Design](#fair-play-by-design)
- [Getting Started](#getting-started)
- [Optional Voice Setup (Fish Audio)](#optional-voice-setup-fish-audio)
- [Running Tests](#running-tests)
- [Roadmap & Status](#roadmap--status)
- [Contributing](#contributing)

---

## The Commentary Booth is Open

Imagine playing a tense blitz match. Instead of staring at an emotionless evaluation bar, your commentary booth lights up with the drama, wit, and raw energy of a live sports broadcast:

> *Note: The following examples illustrate the tone and energy of SledgeFish reactions.*

### ⚡ The Tactical Strike (Brilliant / Fork)
> **"धोनी वाला हेलीकॉप्टर शॉट! क्या कमाल की चाल चली है! घोड़ा एक साथ दो-दो शिकार पर निशाना साध रहा है!"**  
> *(“A Dhoni-esque helicopter shot! What a move! The Knight is targeting two victims simultaneously!”)*

### 💥 The Catastrophic Blunder (Hanging Piece)
> **"अरे बाप रे बाप! वज़ीर को सीधा लावारिस छोड़ दिया! ये चेस खेल रहे हैं या भंडारा बांट रहे हैं?!"**  
> *(“Oh dear lord! The Queen has been left completely undefended! Are we playing chess or running a charity giveaway?!”)*

### 🤦 The Missed Opportunity (Missed Mate)
> **"अरे भाई मारो मुझे! सामने खाली गोलपोस्ट था और गेंद बाहर मार दी! सीधा चेकमेट का मौका छोड़ दिया!"**  
> *(“Somebody pinch me! The goalpost was wide open and they kicked it into the stands! Missed a direct checkmate!”)*

### 🛡️ The Quiet Positional Move (Sensible Development)
> **"स्ट्राइक रोटेट करते हुए, टेस्ट मैच की तरह आराम से मोहरों को तैयार किया जा रहा है।"**  
> *(“Rotating the strike—patiently prepping the pieces just like in a classic Test match.”)*

---

## How Fun Becomes Learning

Chess engines love telling you that you are **-4.2**, but numbers rarely help you remember *why*. SledgeFish uses humor and theatrical framing to make tactical patterns stick:

1. **Immediate Tactical Recognition:**  
   The extension's tactical analyzer parses the board snapshot after every move to highlight concrete motifs:
   - **Forks:** A single piece (frequently a Knight or Pawn) attacking two or more high-value targets at once.
   - **Pins:** A piece frozen in place because moving it exposes the King or Queen.
   - **Hanging Pieces:** Pieces left undefended on squares directly contested by enemy attackers.
   - **Missed Mates:** Positions where an immediate knockout blow was available but overlooked.

2. **Move Quality Feedback:**  
   In supported engine modes (vs Bot or Analysis), SledgeFish categorizes moves by centipawn loss ($\Delta CP$):
   - 🌟 **Brilliant:** Sound material sacrifice maintaining advantage.
   - 🎯 **Excellent / Best:** Optimal engine choice ($\Delta CP \le 15$).
   - ♟️ **Good:** Solid practical continuation ($\Delta CP \le 40$).
   - ⚠️ **Inaccuracy:** Mild positional concession ($40 < \Delta CP \le 100$).
   - ❌ **Mistake:** Significant drop in evaluation ($100 < \Delta CP \le 250$).
   - 🚨 **Blunder:** Dropping massive material or allowing forced mate ($\Delta CP > 250$).

3. **Emotion as a Memory Anchor:**  
   A dry red arrow doesn't stop you from hanging your Rook again next game. A witty roast about "leaving your elephant unattended on the boundary line" makes the mistake unforgettable.

---

## Commentator Personalities

Pick the commentator that matches your mood or resilience level via the extension popup:

| Personality | Style & Tone | Illustrative Reaction |
|---|---|---|
| 🔥 **Unhinged** | Maximum chaos, hyperbolic screams, crisis alerts | *"एम्बुलेंस बुलाओ कोई! बोर्ड पर खून बह रहा है, पूरा किला ढह चुका है!"*<br>*(“Call an ambulance! There's blood on the board, the fortress has collapsed!”)* |
| 😏 **Sarcastic** | Dry cynicism, intellectual roasts, polite disbelief | *"क्या चाल है! शायद प्रतिद्वंद्वी पर तरस खाकर मोहरा दान किया गया है।"*<br>*(“What a move! Truly charitable of you to donate that piece.”)* |
| 🎙️ **Professional** | Composed, analytical, broadcast-sports cadence | *"सटीक चाल। केंद्र पर नियंत्रण स्थापित करते हुए अपनी स्थिति मजबूत की है।"*<br>*(“Precise maneuver. Establishing central control and reinforcing the structure.”)* |
| 🌱 **Supportive** | Constructive, encouraging, focusing on the comeback | *"कोई बात नहीं! मैच अभी खत्म नहीं हुआ, वापसी की पूरी गुंजाइश है।"*<br>*(“No worries! The match isn't over yet, there's always room for a comeback.”)* |

---

## Under the Hood

SledgeFish is built using modern browser APIs, lightweight DOM observers, client-side WebAssembly, and an optional Python microservice.

```mermaid
graph LR
    subgraph Browser["Google Chrome (Chess.com)"]
        DOM["Chess.com DOM"] -->|MutationObserver| MT["moveTracker.js"]
        MT -->|SAN Moves| PM["positionManager.js<br/>(chess.js Board State)"]
        MT -->|Notation| EC["eventClassifier.js"]
        PM -->|Snapshot| TI["tacticalInterpreter.js<br/>(Motifs: Fork, Pin, Hang)"]
        PM -.->|FEN (Bot/Analysis Only)| SF["Stockfish WASM<br/>(Web Worker)"]
        SF -.->|Score / Best Move| MC["moveClassifier.js"]
        TI --> CE["commentaryEngine.js<br/>(Hindi Templates + LRU Anti-Repetition)"]
        MC -.-> CE
        EC --> CE
        CE --> UI["overlay.js<br/>(Glassmorphic HUD)"]
        CE -.->|Text| SC["speechController.js"]
    end

    subgraph Backend["Optional Local Service"]
        SC -.->|POST /api/tts| API["speech_server.py<br/>(FastAPI Proxy)"]
        API -.->|Audio Stream| SC
    end
```

### Architecture Highlights:
- **`moveTracker.js`**: Observes Chess.com's dynamic move list. Implements 50ms debouncing, figurine conversion (`data-figurine`), and silent historical synchronization to avoid replaying past commentary when opening an ongoing match.
- **`positionManager.js`**: Uses [`chess.js`](file:///c:/Users/anirb/Desktop/dev/Projects/Chess_trash_Talk/lib/chess.min.js) to maintain a complete virtual board state, validate moves, and compute legal move sets.
- **`stockfishAdapter.js`**: Runs Stockfish WASM inside an asynchronous Web Worker (`depth: 6`, `movetime: 120ms`) to deliver instant evaluations without freezing the browser tab.
- **`commentaryEngine.js`**: Curates rich Devanagari Hindi cricket-style commentary across all 4 personalities and includes a 5-entry LRU anti-repetition cache.
- **`overlay.js`**: A pure vanilla JavaScript, draggable, glassmorphic HUD that floats cleanly over Chess.com without blocking the chessboard or move controls.

---

## Fair Play by Design

SledgeFish is an **entertainment and post-game learning tool**, not a cheating utility.

* **Strict Route Isolation:** The Stockfish analysis worker is programmatically restricted in [`content.js`](file:///c:/Users/anirb/Desktop/dev/Projects/Chess_trash_Talk/content.js#L140-L165) to bot games (`/play/computer/*`), practice drills (`/practice`), and review tabs (`/analysis/*`).
* **Silent Evaluation in Live Play:** During live human-vs-human rated games (`/game/live/*`), Stockfish analysis is **completely deactivated**. In live games, SledgeFish operates strictly on observable notation heuristics (captures, checks, castling, promotions) and does not calculate centipawn advantages or best moves.
* **Community Integrity:** Always adhere to Chess.com's Fair Play policy. Never use any extension to seek external assistance in rated competitive play.

---

## Getting Started

### Prerequisites
- Google Chrome (or any Chromium-based browser like Brave or Edge)
- Node.js 18+ (only needed if running tests)

### Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/Chess_trash_Talk.git
   cd Chess_trash_Talk
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project directory (`Chess_trash_Talk`).
6. Open any game or bot match on [Chess.com](https://www.chess.com/play/computer) — the floating SledgeFish HUD will appear automatically!

---

## Optional Voice Setup (Fish Audio)

Want full Hindi voice commentary? SledgeFish includes a local speech proxy that connects to Fish Audio's TTS API (`s2.1-pro` model).

> [!NOTE]
> The extension works 100% in visual mode out of the box. Voice synthesis is completely optional and requires a local Python server so your API key is never exposed to the browser.

1. **Install Python dependencies:**
   ```bash
   pip install fastapi uvicorn httpx pydantic python-dotenv
   ```
2. **Configure your API key:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and insert your API key from [Fish Audio](https://fish.audio):
   ```env
   FISH_API_KEY=your_actual_api_key_here
   SPEECH_HOST=127.0.0.1
   SPEECH_PORT=8000
   FISH_VOICE_MODEL_ID=b3e2e78dfa3f4100a7b9be30175b06a7
   ```
3. **Start the local speech service:**
   ```bash
   python speech_server.py
   ```
4. **Test the voice:** Click the **Voice Test** button on the floating HUD to verify audio streaming!

---

## Running Tests

SledgeFish maintains an automated test suite verifying move tracking, UCI parsing, tactical interpretation, and score normalization using Node.js's native test runner:

```bash
npm test
```

```text
✔ MoveTracker: does not replay moves on initial load (0.67ms)
✔ MoveTracker: emits no duplicates on DOM rerender (0.38ms)
✔ PositionManager: captures, castling, and checks (84.4ms)
✔ classifyMoveQuality: classifies BLUNDER on major drop (0.47ms)
✔ CommentaryEngine: generates Hindi commentary with piece & square (4.9ms)
✔ StockfishAdapter: initializes and performs analysis (72.3ms)
...
1..55 tests passed (100% pass rate)
```

---

## Roadmap & Status

| Feature | Status | Notes |
|---|---|---|
| Real-time move tracking & deduplication | ✅ Implemented | MutationObserver with 50ms debouncing |
| Virtual board mirroring (`chess.js`) | ✅ Implemented | Full FEN tracking, legal move generator, desync recovery |
| Tactical motif detection (Forks, Pins, Hanging Pieces) | ✅ Implemented | Rule-based semantic analyzer (`tacticalInterpreter.js`) |
| Stockfish 16 WASM integration | ✅ Implemented | Sandboxed Web Worker for Bot & Analysis sessions |
| Centipawn evaluation loss & move classification | ✅ Implemented | Blunder, Mistake, Inaccuracy, Good, Excellent, Brilliant |
| 4 Commentary personalities (Hindi Cricket theme) | ✅ Implemented | Unhinged, Sarcastic, Professional, Supportive with LRU cache |
| Floating glassmorphic HUD overlay | ✅ Implemented | Draggable, minimizable, status indicator, test button |
| Optional local TTS speech server (Fish Audio) | ✅ Implemented | FastAPI proxy with rate-limit and error handling |
| Automatic speech playback on move | 🚧 In Progress | Queue implemented; auto-play disabled by default |
| Interactive post-game summary card | 🗺️ Planned | End-of-game report card with MVP and worst blunder |
| Additional language and dialect packs | 🗺️ Planned | Hinglish, Bhojpuri, and regional commentary modes |

---

## Contributing

Contributions are welcome! Whether you want to add more witty Hindi commentary lines, improve tactical motif detection, or design new overlay themes:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingCommentary`)
3. Commit your Changes (`git commit -m 'Add new witty lines for Queen sacrifices'`)
4. Ensure all tests pass: `npm test`
5. Push to the Branch (`git push origin feature/AmazingCommentary`)
6. Open a Pull Request

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
