/**
 * SledgeFish Lite - Commentary Engine
 * Generates personality-driven contextual reactions for observed chess events
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishCommentaryEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Organized commentary dictionaries by personality and event
  const COMMENTARY_DICTIONARY = {
    unhinged: {
      GAME_STARTED: [
        "WE ARE UNDERWAY! Brace yourselves, nobody is safe!",
        "THE BATTLE COMMENCES! Blood will be spilled on these 64 squares!",
        "First pawn steps forward! The existential crisis begins now!"
      ],
      MOVE: [
        "A quiet move. Suspiciously quiet. I don't trust it one bit!",
        "Pieces shuffling! The cosmic tension is reaching unbearable levels!",
        "A casual push, but you can feel the imminent disaster brewing!",
        "The board shifts! Chaos is merely waiting for its cue!"
      ],
      CAPTURE: [
        "AND THE PIECE IS GONE! Somebody call the insurance company!",
        "TOTAL DESTRUCTION! That piece had a family, you monsters!",
        "DIRECT HIT! Wood flying across the room! Absolute mayhem!",
        "OBLITERATED! One less mouth to feed in this war zone!"
      ],
      CHECK: [
        "THE KING IS UNDER SIEGE! Panic in the royal quarters!",
        "AIR RAID SIREN! Your king just got an emergency broadcast!",
        "INCOMING! The royal crown is vibrating from the shockwave!"
      ],
      CHECKMATE: [
        "IT IS ALL OVER! The monarchy has collapsed completely!",
        "CHECKMATE! Pack up the board, turn off the lights, madness wins!",
        "THE FINAL BLOW! Absolute carnage! What an unforgettable ending!"
      ],
      CASTLING: [
        "EVACUATION COMPLETE! The king hid behind three pawns and a prayer!",
        "THE ROYAL TELEPORT! Run for the hills, king, run for the hills!",
        "Fortress mode engaged! Bunker down before the artillery strikes!"
      ],
      PROMOTION: [
        "BEHOLD THE MONSTER! That humble pawn just became a terrifying deity!",
        "ASCENSION! A new queen enters and demands total obedience!",
        "FROM THE MUD TO THE THRONE! This board will never be the same!"
      ],
      GAME_ENDED: [
        "The dust settles! The sheer emotional devastation remains!",
        "Peace talks? No, just complete and utter exhaustion!"
      ]
    },

    sarcastic: {
      GAME_STARTED: [
        "And so it begins. May the least terrible player win.",
        "A fresh board. Plenty of opportunities for regret ahead.",
        "Pawns move forward. Hope you know what you're doing."
      ],
      MOVE: [
        "Interesting decision. Let's generously call it a decision.",
        "A move was made. The pieces didn't protest, at least.",
        "Developing pieces or just passing the time? We shall see.",
        "Bold strategy. Not necessarily good, but definitely bold."
      ],
      CAPTURE: [
        "They took your piece. I hope you two weren't emotionally attached.",
        "Down goes a piece. I'm sure that was entirely part of the master plan.",
        "A trade? Or did someone just forget their piece was hanging?",
        "Material leaves the board. The board breathes a sigh of relief."
      ],
      CHECK: [
        "Your king just received an extremely uncomfortable notification.",
        "Check. Nothing says 'fun' quite like scrambling your king.",
        "The king has to move. So much for royal dignity."
      ],
      CHECKMATE: [
        "And that's checkmate. Well, at least the suffering has ended.",
        "Game over. Let's pretend that was just a warm-up round.",
        "Checkmate. You can always claim your mouse slipped."
      ],
      CASTLING: [
        "The king has relocated to a slightly less dangerous neighborhood.",
        "Castling: because standing in the center was getting awkward.",
        "Tucking the king away. Let's see how long that safety lasts."
      ],
      PROMOTION: [
        "That pawn just got the biggest promotion in corporate history.",
        "Promoted. Because having one queen wasn't dramatic enough.",
        "From grunt to royalty. Let's hope the power doesn't go to its head."
      ],
      GAME_ENDED: [
        "Match concluded. Time to analyze all the questions left unanswered.",
        "It's over. The scoreboard tells a story best forgotten quickly."
      ]
    },

    professional: {
      GAME_STARTED: [
        "The clock is running and the opening moves are on the board.",
        "Both players begin developing according to classical opening principles.",
        "Game underway. White establishes initial central stake."
      ],
      MOVE: [
        "A solid consolidating move. The tension gradually builds.",
        "Positional maneuvering continues as both sides contest key squares.",
        "Calm development. Both sides are preparing their long-term plans.",
        "Piece coordination remains the priority at this stage."
      ],
      CAPTURE: [
        "A capture changes the material balance. Play continues.",
        "Pieces are traded off. The board state becomes clearer.",
        "An exchange in the center. Tactical complications are emerging.",
        "Material taken off the board. Both sides recalculate imbalances."
      ],
      CHECK: [
        "Check delivered. The defender must address the direct threat.",
        "The king comes under pressure. Forcing defensive responses.",
        "A tactical check. Initiative stays with the attacking side."
      ],
      CHECKMATE: [
        "Checkmate on the board. A decisive and conclusive finish.",
        "The attack breaks through decisively. The game is over.",
        "Well-executed mating net. That concludes this contest."
      ],
      CASTLING: [
        "King safety secured and the rook is brought into active play.",
        "Castling executed cleanly. King reaches safety behind the pawn shield.",
        "Strategic consolidation: the king moves away from center lines."
      ],
      PROMOTION: [
        "Pawn reaches the eighth rank and promotes successfully.",
        "Decisive promotion. The extra material significantly impacts the endgame.",
        "Promotion realized after careful pawn breakthrough."
      ],
      GAME_ENDED: [
        "The game concludes. A hard-fought encounter comes to an end.",
        "Game over. Handshakes all around after a dynamic battle."
      ]
    },

    supportive: {
      GAME_STARTED: [
        "Best of luck! Trust your instincts and play your game!",
        "Every grandmaster started here. Have fun on the board!",
        "Great start! Stay focused and enjoy every turn."
      ],
      MOVE: [
        "Nice thoughtful move! Keeping things balanced and solid.",
        "Good positioning! Step by step, you're building your game.",
        "Patience pays off in chess. Looking very steady here.",
        "Smart developing move. Keep your eye on the board dynamics."
      ],
      CAPTURE: [
        "Tactical awareness on display! Every capture tells a story.",
        "Good trade! Stay sharp and look for your next opportunity.",
        "Piece off the board, but the game is still full of promise!",
        "Sharp play! Keep calculating your responses calmly."
      ],
      CHECK: [
        "Keep calm under pressure! Great kings know how to defend.",
        "Check called! Take a deep breath and find the best escape square.",
        "A good test of resilience! You've got this."
      ],
      CHECKMATE: [
        "What a thrilling game! Fantastic effort from both players!",
        "Checkmate delivered! What a memorable finish to the battle!",
        "GG! Win or learn, every match makes you stronger."
      ],
      CASTLING: [
        "Smart castling! Safety first is always a great strategy.",
        "King tucked safely away. Now your rooks are connected and ready!",
        "Wonderful fundamental chess! Safety and development combined."
      ],
      PROMOTION: [
        "Incredible determination! That pawn went the entire distance!",
        "Pawn promoted! Hard work all across the board paid off!",
        "What an inspiring march to the back rank! Well earned!"
      ],
      GAME_ENDED: [
        "Well played! Great spirit shown right until the final move.",
        "A wonderful game of chess. Rest up for the next one!"
      ]
    }
  };

  class CommentaryEngine {
    constructor() {
      // Memory to prevent repeating the immediate last comment per personality+event
      this.lastIndexMap = new Map();
    }

    /**
     * Retrieves available commentary lines for a given personality and event
     * @param {string} personality 
     * @param {string} event 
     * @returns {string[]}
     */
    getLines(personality, event) {
      const p = (personality || 'unhinged').toLowerCase();
      const personalityDict = COMMENTARY_DICTIONARY[p] || COMMENTARY_DICTIONARY.unhinged;
      const lines = personalityDict[event] || personalityDict.MOVE || [
        "A move has been made on the board."
      ];
      return lines;
    }

    /**
     * Generates a reaction for a given event and personality
     * @param {Object} event - Classified event object
     * @param {string} personality - 'unhinged' | 'sarcastic' | 'professional' | 'supportive'
     * @returns {Object} { text, personality, event, san, ply, color }
     */
    generate(event, personality) {
      const p = (personality || 'unhinged').toLowerCase();
      const eventType = (event && event.type) ? event.type : 'MOVE';
      const lines = this.getLines(p, eventType);

      const key = `${p}:${eventType}`;
      const lastIndex = this.lastIndexMap.get(key);

      let chosenIndex = 0;
      if (lines.length > 1) {
        // Pick an index different from lastIndex
        const candidateIndices = [];
        for (let i = 0; i < lines.length; i++) {
          if (i !== lastIndex) {
            candidateIndices.push(i);
          }
        }
        const rand = Math.floor(Math.random() * candidateIndices.length);
        chosenIndex = candidateIndices[rand];
      }

      this.lastIndexMap.set(key, chosenIndex);

      return {
        text: lines[chosenIndex],
        personality: p,
        event: eventType,
        san: (event && event.san) ? event.san : '',
        ply: (event && event.ply) ? event.ply : 0,
        color: (event && event.color) ? event.color : 'white'
      };
    }
  }

  return {
    COMMENTARY_DICTIONARY: COMMENTARY_DICTIONARY,
    CommentaryEngine: CommentaryEngine
  };
});
