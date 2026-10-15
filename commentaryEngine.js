/**
 * SledgeFish - Context-Aware Commentary Engine (Hindi & Indian Cricket Commentary Flavour)
 * Generates witty, context-driven commentary in Devanagari Hindi with selectable personalities.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SledgeFishCommentaryEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Piece names in Hindi / Hinglish commentary
  const PIECE_NAMES = {
    q: 'वज़ीर',
    k: 'राजा',
    r: 'हाथी',
    b: 'ऊंट',
    n: 'घोड़ा',
    p: 'प्यादा'
  };

  /**
   * Helper to identify piece from SAN or snapshot
   */
  function getPieceName(san, snapshot) {
    if (snapshot && snapshot.piece && PIECE_NAMES[snapshot.piece]) {
      return PIECE_NAMES[snapshot.piece];
    }
    if (!san) return 'मोहरा';
    if (san.startsWith('O-O')) return 'राजा';
    const first = san.charAt(0);
    switch (first) {
      case 'Q': return 'वज़ीर';
      case 'K': return 'राजा';
      case 'R': return 'हाथी';
      case 'B': return 'ऊंट';
      case 'N': return 'घोड़ा';
      default: return 'प्यादा';
    }
  }

  // Commentary templates organized by Personality and Context
  const COMMENTARY_DICTIONARY = {
    unhinged: {
      GAME_STARTED: [
        "मैच शुरू हो चुका है दोस्तों! मैदान सज चुका है, पहली गेंद फेंक दी गई है!",
        "पहली ही गेंद पर आक्रामक शुरुआत! आज बोर्ड पर चौके-छक्के उड़ने वाले हैं!",
        "मुकाबला शुरू! आज कोई नहीं बचेगा, 64 खानों पर भारी तबाही तय है!"
      ],
      HANGING_PIECE: [
        "अरे बाप रे बाप! {hungPiece} को सीधा {hungSquare} पर मुफ्त में दान दे दिया! ये चेस खेल रहे हैं या भंडारा बांट रहे हैं?!",
        "सीधा फील्डर के हाथ में कैच थमा दिया! {hungPiece} को बिना किसी सुरक्षा के लावारिस छोड़ दिया!",
        "महा-ब्लंडर! {hungPiece} का कत्ल-ए-आम हो गया! एम्बुलेंस बुलाओ कोई, बोर्ड पर खून बह रहा है!"
      ],
      MISSED_MATE: [
        "अरे भाई मारो मुझे! सामने खाली गोलपोस्ट था और गेंद बाहर मार दी! सीधा चेकमेट का मौका था ({missedMateSan})!",
        "ऐतिहासिक चूक! 1 गेंद पर 1 रन चाहिए था और ये रन आउट हो गए! सीधा चेकमेट छोड़ दिया!"
      ],
      FORK: [
        "धोनी वाला हेलीकॉप्टर शॉट! {piece} ने एक साथ {targets} दोनों को लपेटे में ले लिया! दोहरा शिकार!",
        "परफेक्ट यॉर्कर! एक तीर से दो शिकार, {targets} दोनों खतरे में! इसे कहते हैं मास्टरस्ट्रोक!"
      ],
      FREE_CAPTURE: [
        "मुफ्त का माल! {square} पर {capturedPiece} को डकार लिया, विपक्षी देखता ही रह गया!",
        "और ये विकेट चटकाया! बिना किसी नुकसान के {capturedPiece} सीधे पवेलियन रवाना!"
      ],
      BLUNDER: [
        "अरे बाप रे बाप! {piece} को सीधा {square} पर दान दे दिया! ये चेस खेल रहे हैं या खैरात बांट रहे हैं?!",
        "सीधा फील्डर के हाथ में कैच थमा दिया! ये क्या किया आपने? {piece} का कत्ल-ए-आम हो गया!",
        "महा-ब्लंडर! {piece} को {square} पर रखकर आत्महत्या कर ली! एम्बुलेंस बुलाओ कोई!",
        "ओह भाई मारो मुझे! {san} चलकर सीधा मैच ही विपक्ष की झोली में डाल दिया!"
      ],
      MISTAKE: [
        "गलत शॉट सिलेक्शन! {piece} को {square} पर लाकर खुद अपने पैरों पर कुल्हाड़ी मार ली!",
        "बड़ी चूक! क्रीज़ छोड़ कर आगे बढ़े और स्टंप उखड़ गए! संभल कर खेलिए भाई!",
        "ये चाल भारी पड़ने वाली है! {piece} खतरे के घेरे में आ चुका है!"
      ],
      INACCURACY: [
        "थोड़ा दबाव में दिख रहे हैं! {piece} की ये चाल बहुत ढीली थी, दबाव बढ़ रहा है!",
        "डॉट बॉल खेल दी! यहां काउंटर-अटैक की ज़रूरत थी और ये बैकफुट पर चले गए!"
      ],
      BRILLIANT: [
        "अविश्वसनीय! जादुई चाल! {piece} का ऐसा बलिदान कि दुनिया देखती रह जाए!",
        "धोनी वाला हेलीकॉप्टर शॉट! क्या चाल चली है! मास्टरस्ट्रोक!",
        "ये चाल नहीं, सीधा ब्रह्मोस मिसाइल दागी है! विपक्षी खेमे में खलबली!"
      ],
      EXCELLENT: [
        "शानदार टाइमिंग! परफेक्ट लेंथ गेंद की तरह सटीक चाल! लाजवाब!",
        "कमाल की सूझबूझ! बोर्ड पर अपनी पकड़ पूरी तरह मजबूत कर ली है!"
      ],
      CHECK: [
        "सीधा बाउंसर! राजा के सिर पर गेंद लगी है, चेक! बचिए अगर बच सकते हैं!",
        "हेलमेट पर लगी गेंद! राजा को भागना पड़ेगा, चारों तरफ फील्डर तैनात हैं!",
        "राजा पर सीधा हमला! सायरन बज चुका है, भागने का रास्ता ढूंढिए!"
      ],
      CHECKMATE: [
        "क्लीन बोल्ड! डंडे हवा में उड़ गए! खेल खत्म, पैसा हज़म! जय माता दी!",
        "ऑल आउट! राजा का तख्तापलट हो चुका है, पारी समाप्त! क्या ऐतिहासिक जीत है!",
        "मैच समाप्त! अंतिम गेंद पर छक्का मारकर मैच जीत लिया!"
      ],
      CAPTURE: [
        "और ये विकेट गिरा! {piece} का काम तमाम, सीधे पवेलियन रवाना!",
        "गेंद हवा में और सीधा कैच लपका! एक और मोहरा मैदान से बाहर!",
        "शिकार बना लिया! {square} पर जबरदस्त प्रहार, मोहरा गायब!"
      ],
      CASTLING: [
        "राजा सुरक्षित ड्रेसिंग रूम में लौट गए! किलेबंदी पूरी, अब अटैक की बारी!",
        "डिफेंस को एकदम टाइट कर लिया है! राजा अब वीआईपी लाउंज में आराम फरमाएंगे!"
      ],
      PROMOTION: [
        "नया सितारा मैदान में! प्यादा बना वज़ीर, अब तबाही का नया मंजर दिखेगा!",
        "सिक्सर! प्यादा बाउंड्री पार करके सीधा वज़ीर बन गया! अब खेल असली शुरू होगा!"
      ],
      MOVE: [
        "{piece} {square} पर पहुंचा। मैच में गर्माहट बढ़ती हुई, सस्पेंस बरकरार है!",
        "खामोशी से फील्डिंग सजाई जा रही है। किसी बड़े तूफान की तैयारी लगती है!",
        "{piece} की सधी हुई चाल। मैच अभी बराबरी पर खड़ा है!"
      ],
      GAME_ENDED: [
        "खेल समाप्त! बहुत ही सांस रोक देने वाला मुकाबला रहा!",
        "अंतिम परिणाम सामने आ चुका है। क्या रोमांचक जंग देखने को मिली!"
      ]
    },

    sarcastic: {
      GAME_STARTED: [
        "मैच शुरू। देखते हैं आज कौन अपनी बेइज्जती खुद कराता है।",
        "नया खेल, नई उम्मीदें। उम्मीद है आज कम से कम 10 चालों तक टिकेंगे।"
      ],
      HANGING_PIECE: [
        "वाह! क्या बात है! {hungPiece} को {hungSquare} पर ऐसे छोड़ दिया जैसे किसी काम का ही नहीं था।",
        "दानवीर कर्ण भी आपसे जलते होंगे! {hungPiece} को सीधे थाली में सजा कर परोस दिया।",
        "अद्भुत विज़न! {hungPiece} को मुफ्त में गंवा कर अब शांति से हार का आनंद लीजिए।"
      ],
      MISSED_MATE: [
        "सीधा चेकमेट सामने था ({missedMateSan}), पर आपको तो मैच लंबा खींच कर हारना पसंद है।",
        "अरे भाई, चेकमेट हो रहा था! इतनी दया विपक्ष पर क्यों दिखा रहे हैं?"
      ],
      FORK: [
        "अरे वाह! गलती से सही चाल चल दी क्या? {piece} से {targets} दोनों को फंसा दिया।",
        "तुक्का लगा या सोचा था? एक ही झटके में दोनों मोहरे लपेट लिए।"
      ],
      BLUNDER: [
        "वाह! क्या शानदार दानवीर हैं आप! {piece} को {square} पर ऐसे मुफ्त में दे दिया जैसे भंडारा चल रहा हो।",
        "अद्भुत फैसला! {piece} को बलि का बकरा बनाकर क्या साबित करना चाहते थे?",
        "मान गए उस्ताद! विपक्षी भी सोच रहा होगा कि इतना मेहरबान विरोधी कहां से मिला।",
        "{san}? बहुत बढ़िया! अगर हारने की जल्दी थी तो सीधे रिसाइन ही कर देते।"
      ],
      MISTAKE: [
        "गजब की रणनीति है आपकी! खराब चालों की पूरी सीरीज चल रही है।",
        "{piece} को {square} पर लाकर अपने लिए नया सिरदर्द मोल ले लिया।",
        "इसे चाल कहें या दुर्घटना? फैसला आप खुद ही कर लीजिए।"
      ],
      INACCURACY: [
        "थोड़ा सोच भी लेते तो कोई टैक्स नहीं लगता। साधारण सी चाल।",
        "इसे कहते हैं बिना बात के मैच को मुश्किल बनाना।"
      ],
      BRILLIANT: [
        "अरे वाह! गलती से सही चाल चल दी क्या? मानना पड़ेगा, शानदार पैंतरा!",
        "तुक्का लगा या सच में सोचा था? चाल तो वाकई लाजवाब है।"
      ],
      EXCELLENT: [
        "चलो, कम से कम एक चाल तो अक्ल से चली। शाबाश।",
        "काफी सधी हुई चाल। उम्मीद है अगली चाल में इसका सत्यानाश नहीं करेंगे।"
      ],
      CHECK: [
        "चेक! राजा साहब को जरा अपनी गद्दी से उठना पड़ेगा, आराम का समय खत्म।",
        "राजा को नोटिस मिल गया है। अब देखिए कैसे इधर-उधर भागते हैं।"
      ],
      CHECKMATE: [
        "और इसी के साथ आपकी लीला समाप्त। कम से कम समय तो बचा लिया।",
        "चेकमेट! बधाई हो, आपकी गलतियों की किताब पूरी हो गई।"
      ],
      CAPTURE: [
        "विपक्ष ने आपका मोहरा डकार लिया। उम्मीद है आपको उससे ज्यादा प्यार नहीं था।",
        "एक और मोहरा गया। क्या बात है, बोर्ड साफ करने का ठेका लिया है क्या?"
      ],
      CASTLING: [
        "कैसलिंग! राजा को कोने में छुपा दिया, जैसे वहां कोई ढूंढ नहीं पाएगा।",
        "राजा छुप गया है। देखते हैं कब तक जान बचा पाते हैं।"
      ],
      PROMOTION: [
        "प्यादा वज़ीर बन गया। अब देखना ये है कि इसे कितनी जल्दी गंवाते हैं।",
        "प्रमोशन तो मिल गया, अब काम भी वज़ीर जैसा करके दिखाइए।"
      ],
      MOVE: [
        "{piece} {square} पर। चलिए, कुछ तो चला, चाहे जैसा भी हो।",
        "एक और रहस्यमयी चाल, जिसका मतलब शायद आपको भी नहीं पता।"
      ],
      GAME_ENDED: [
        "मैच खत्म। विश्लेषण करके देखिए कि क्या नहीं करना चाहिए था।",
        "समाप्ति। आज के इस खेल को जितनी जल्दी भूल जाएं, उतना अच्छा है।"
      ]
    },

    professional: {
      GAME_STARTED: [
        "मुकाबला प्रारंभ हो चुका है। दोनों खिलाड़ी क्लासिकल सिद्धांतों पर खेल आगे बढ़ा रहे हैं।",
        "शुरुआती चालें बोर्ड पर। दोनों तरफ से सेंटर पर नियंत्रण बनाने का प्रयास।"
      ],
      BLUNDER: [
        "भारी रणनीतिक चूक! {piece} को {square} पर रखने से भारी नुकसान हुआ है।",
        "गंभीर भूल! इस चाल ने स्थिति का संतुलन पूरी तरह बिगाड़ दिया है।",
        "बड़ा ब्लंडर! विपक्ष को सीधा निर्णायक फायदा मिल चुका है।"
      ],
      MISTAKE: [
        "कमज़ोर चाल! {piece} को {square} पर लाने से विपक्ष को काउंटर-प्ले का मौका मिल गया है।",
        "रणनीतिक गलती। इस पोजीशन में बेहतर विकल्पों पर विचार करना चाहिए था।"
      ],
      INACCURACY: [
        "थोड़ी दिशाहीन चाल। दबाव बनाए रखने के लिए अधिक सक्रिय विकल्प मौजूद थे।",
        "स्थिति की मांग के अनुसार यह सबसे सटीक चाल नहीं कही जा सकती।"
      ],
      BRILLIANT: [
        "असाधारण सामरिक चाल! बहुत ही गहरा और सटीक कैलकुलेशन।",
        "मास्टरक्लास प्रदर्शन! इस सामरिक प्रहार ने खेल का रुख बदल दिया है।"
      ],
      EXCELLENT: [
        "सर्वश्रेष्ठ विकल्प! स्थिति का सटीक आकलन करते हुए बहुत मजबूत चाल।",
        "उत्कृष्ट खेल! बोर्ड के सभी हिस्सों पर दबाव बरकरार रखा है।"
      ],
      CHECK: [
        "सटीक चेक। अब बचाव पक्ष को तुरंत अपने राजा की रक्षा करनी होगी।",
        "चेक के साथ हमला। खिलाड़ी को मजबूरी में डिफेंसिव चाल चलनी होगी।"
      ],
      CHECKMATE: [
        "चेकमेट! खेल का बहुत ही निर्णायक और सटीक अंत।",
        "चेकमेट हो चुका है। आक्रामक रणनीति का सफल समापन।"
      ],
      CAPTURE: [
        "{square} पर कैप्चर। मोहरों की अदला-बदली से स्थिति का समीकरण बदलता हुआ।",
        "मोहरा बाहर। अब बोर्ड पर मोहरों का संतुलन नया रूप ले चुका है।"
      ],
      CASTLING: [
        "कैसलिंग संपन्न। राजा की सुरक्षा सुनिश्चित और रूक को सक्रिय किया गया।",
        "रणनीतिक मजबूती: राजा को केंद्र से हटाकर सुरक्षित स्थान पर पहुंचाया गया।"
      ],
      PROMOTION: [
        "सफल प्रमोशन! आठवीं रैंक पर पहुंचकर प्यादा वज़ीर में तब्दील हो चुका है।",
        "निर्णायक प्रमोशन। यह अतिरिक्त ताकत एंडगेम को पूरी तरह मोड़ देगी।"
      ],
      MOVE: [
        "{piece} {square} पर पहुंचा। मोहरों की स्थिति को और बेहतर किया जा रहा है।",
        "सधा हुआ विकास। दोनों पक्ष अपनी रणनीति के अनुसार आगे बढ़ रहे हैं।"
      ],
      GAME_ENDED: [
        "मैच का समापन। एक बहुत ही तकनीकी और संघर्षपूर्ण मुकाबला समाप्त।"
      ]
    },

    supportive: {
      GAME_STARTED: [
        "शुभकामनाएं! अपने खेल पर भरोसा रखिए और पूरे मन से खेलिए!",
        "नया मुकाबला, नया मौका! पूरे फोकस के साथ आगे बढ़िए।"
      ],
      BLUNDER: [
        "कोई बात नहीं! बड़े-बड़े ग्रैंडमास्टर्स से भी चूक होती है, हिम्मत रखिए!",
        "{piece} जरूर खोया है, पर हौसला मत खोइए! पलटवार का मौका अभी भी आ सकता है!",
        "चूक हो गई, लेकिन निराश मत होइए। यही गलतियां हमें बेहतर खिलाड़ी बनाती हैं!"
      ],
      MISTAKE: [
        "थोड़ा दबाव आ गया है, पर शांत रहिए। ठंडे दिमाग से अगला कदम सोचिए!",
        "मुश्किल स्थिति है, पर आप इससे निकल सकते हैं। डिफेंस पर ध्यान दीजिए।"
      ],
      INACCURACY: [
        "अच्छा प्रयास! बस थोड़ा और सटीक सोचने की जरूरत है, आप कर सकते हैं!",
        "सीखते रहिए! हर चाल आपको नया अनुभव देकर जाती है।"
      ],
      BRILLIANT: [
        "लाजवाब! क्या कमाल की चाल सोची आपने! दिल खुश हो गया!",
        "शानदार विज़न! आपकी मेहनत बोर्ड पर साफ नजर आ रही है!"
      ],
      EXCELLENT: [
        "बहुत बढ़िया! एकदम सही सोच और सटीक एग्जीक्यूशन!",
        "शानदार लय में हैं आप! इसी आत्मविश्वास के साथ आगे बढ़िए।"
      ],
      CHECK: [
        "चेक आया है, कोई घबराहट नहीं! आराम से सुरक्षित खाना ढूंढिए।",
        "साहस बनाए रखिए! राजा को सुरक्षित जगह ले जाइए और डटे रहिए।"
      ],
      CHECKMATE: [
        "चेकमेट! क्या शानदार खेल दिखाया आपने! बहुत-बहुत बधाई!",
        "शानदार मुकाबला! जीत हो या सीख, आपने बहुत अच्छा जज्बा दिखाया!"
      ],
      CAPTURE: [
        "बढ़िया कैप्चर! अपनी रणनीति पर बने रहिए और आगे बढ़ते रहिए!",
        "सटीक वार! बोर्ड पर अपनी पकड़ मजबूत बनाए रखिए।"
      ],
      CASTLING: [
        "राजा सुरक्षित! बहुत समझदारी भरा फैसला, अब बेफिक्र होकर खेलिए!",
        "बढ़िया कैसलिंग! सुरक्षा मजबूत, अब खेल का आनंद लीजिए।"
      ],
      PROMOTION: [
        "वाह! आपकी मेहनत रंग लाई, प्यादा वज़ीर बन गया! बहुत खूब!",
        "शानदार एंडगेम! प्यादे को अंत तक ले जाना कोई आसान काम नहीं था।"
      ],
      MOVE: [
        "बहुत सुंदर! {piece} को {square} पर लाकर अच्छा तालमेल बनाया है।",
        "सधी हुई चाल। धैर्य ही शतरंज की सबसे बड़ी ताकत है।"
      ],
      GAME_ENDED: [
        "बहुत ही उम्दा खेल! आपका प्रयास वाकई सराहनीय रहा!"
      ]
    }
  };

  class CommentaryEngine {
    constructor() {
      // Memory to prevent immediate repeat lines per personality+context
      this.lastIndexMap = new Map();
      // Recent history buffer
      this.recentHistory = [];
    }

    /**
     * Determines context key for line selection
     */
    getContextKey(finding) {
      if (!finding) return 'MOVE';

      // 1. Prioritize semantic tactical motifs if present
      if (finding.tactics && finding.tactics.motif && finding.tactics.motif !== 'DEVELOPMENT') {
        const motif = finding.tactics.motif;
        if (motif === 'HANGING_PIECE') return 'HANGING_PIECE';
        if (motif === 'MISSED_MATE') return 'MISSED_MATE';
        if (motif === 'FORK') return 'FORK';
        if (motif === 'FREE_CAPTURE') return 'FREE_CAPTURE';
        if (motif === 'CHECKMATE_DELIVERED') return 'CHECKMATE';
      }

      // 2. Evaluated move qualities
      if (finding.quality && finding.quality !== 'UNCLASSIFIED' && finding.quality !== 'GOOD') {
        return finding.quality; // BLUNDER, MISTAKE, INACCURACY, BRILLIANT, EXCELLENT
      }
      if (finding.isCheckmate || finding.type === 'CHECKMATE') return 'CHECKMATE';
      if (finding.isCheck || finding.type === 'CHECK') return 'CHECK';
      if (finding.isPromotion || finding.type === 'PROMOTION') return 'PROMOTION';
      if (finding.isCastling || finding.type === 'CASTLING') return 'CASTLING';
      if (finding.isCapture || finding.type === 'CAPTURE') return 'CAPTURE';
      if (finding.type === 'GAME_STARTED') return 'GAME_STARTED';
      if (finding.type === 'GAME_ENDED') return 'GAME_ENDED';
      return 'MOVE';
    }

    /**
     * Retrieves lines for personality and context
     */
    getLines(personality, contextKey) {
      const p = (personality || 'unhinged').toLowerCase();
      const pDict = COMMENTARY_DICTIONARY[p] || COMMENTARY_DICTIONARY.unhinged;
      return pDict[contextKey] || pDict.MOVE || ["चाल चली गई।"];
    }

    /**
     * Interpolates context variables ({piece}, {square}, {san}, tactical details) into template
     */
    interpolate(template, finding) {
      if (!template) return '';
      const san = (finding && finding.san) ? finding.san : '';
      const snapshot = finding && finding.snapshot;
      const pieceName = getPieceName(san, snapshot);
      const tactics = finding && finding.tactics;
      const details = (tactics && tactics.details) ? tactics.details : {};

      let square = '';
      if (snapshot && snapshot.to) {
        square = snapshot.to;
      } else if (san) {
        const sqMatch = san.match(/[a-h][1-8]/);
        if (sqMatch) square = sqMatch[0];
      }

      const hungPiece = details.piece || pieceName;
      const hungSquare = details.square || square;
      const targets = Array.isArray(details.targets) ? details.targets.join(' और ') : (details.target || 'मोहरों');
      const missedMateSan = details.missedMateSan || 'Qxf7#';
      const capturedPiece = details.capturedPiece || 'मोहरा';

      return template
        .replace(/{hungPiece}/g, hungPiece)
        .replace(/{hungSquare}/g, hungSquare)
        .replace(/{targets}/g, targets)
        .replace(/{missedMateSan}/g, missedMateSan)
        .replace(/{capturedPiece}/g, capturedPiece)
        .replace(/{piece}/g, pieceName)
        .replace(/{square}/g, square || 'मैदान')
        .replace(/{san}/g, san || 'चाल');
    }

    /**
     * Generates a context-aware Hindi reaction
     *
     * @param {Object} finding - Combined event and quality finding
     * @param {string} personality - 'unhinged' | 'sarcastic' | 'professional' | 'supportive'
     * @returns {Object} Structured commentary result
     */
    generate(finding, personality) {
      const p = (personality || 'unhinged').toLowerCase();
      const contextKey = this.getContextKey(finding);
      const lines = this.getLines(p, contextKey);

      const mapKey = `${p}:${contextKey}`;
      const lastIdx = this.lastIndexMap.get(mapKey);

      let chosenIndex = 0;
      if (lines.length > 1) {
        const candidates = [];
        for (let i = 0; i < lines.length; i++) {
          if (i !== lastIdx) candidates.push(i);
        }
        chosenIndex = candidates[Math.floor(Math.random() * candidates.length)];
      }

      this.lastIndexMap.set(mapKey, chosenIndex);

      const template = lines[chosenIndex];
      const finalHindiText = this.interpolate(template, finding);

      // Track recent history
      this.recentHistory.push(finalHindiText);
      if (this.recentHistory.length > 20) {
        this.recentHistory.shift();
      }

      return {
        text: finalHindiText,
        personality: p,
        contextKey: contextKey,
        event: (finding && finding.type) ? finding.type : 'MOVE',
        quality: (finding && finding.quality) ? finding.quality : 'UNCLASSIFIED',
        san: (finding && finding.san) ? finding.san : '',
        ply: (finding && finding.ply) ? finding.ply : 0,
        color: (finding && finding.color) ? finding.color : 'white'
      };
    }
  }

  return {
    PIECE_NAMES: PIECE_NAMES,
    COMMENTARY_DICTIONARY: COMMENTARY_DICTIONARY,
    CommentaryEngine: CommentaryEngine
  };
});
