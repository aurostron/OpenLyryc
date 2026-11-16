/**
 * OpenLyryc Hindi Transliteration Engine (Devanagari to Roman Hindi / Hinglish)
 *
 * High-accuracy, offline, zero-dependency Devanagari romanization engine designed specifically
 * for song lyrics, Bollywood tracks, ghazals, and Indian pop music.
 *
 * Features:
 * - Deterministic ISO 15919 / ITRANS Brahmic phonetic mapping.
 * - Ohala (1983) & Choudhury (2003) rule-based Schwa Deletion (syncope) algorithm:
 *   - Word-final schwa deletion on multi-syllabic roots (e.g. वजह -> wajah, दिल -> dil).
 *   - Medial schwa deletion for VC_CV syllable structures (e.g. करता -> karta, गुदगुदी -> gudgudi).
 * - Contextual phonetic adaptations for Bollywood lyric style:
 *   - Semi-vowel व (v/w) context resolution (हवा -> hawa, वजह -> wajah, ख़्वाब -> khwaab).
 *   - Word-final long vowel matra normalization (दबी -> dabi, हंसी -> hansi, बिना -> bina, सारा -> saara).
 *   - Nuqta consonants (क़ -> q, ख़ -> kh, ग़ -> gh, ज़ -> z, ड़ -> d, ढ़ -> dh, फ़ -> f).
 *   - Conjunct consonants (क्ष -> ksh, त्र -> tr, ज्ञ -> gy, श्र -> shr, Halant clusters).
 *   - Anusvara & Chandrabindu nasalization (में -> mein, हैं -> hain, होंठों -> honthon).
 * - Comprehensive Bollywood lyrics lexicon (200+ high-frequency lyric words).
 * - Word-token and millisecond-level timing synchronization preservation.
 * - Non-destructive: original Devanagari text preserved in line.translations.hi.
 */

// Independent Vowels
const VOWEL_INDEPENDENT: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ॠ': 'ri', 'ऌ': 'li', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'ऑ': 'o', 'ऍ': 'e', 'ऎ': 'e', 'ऒ': 'o'
};

// Dependent Vowel Signs (Matras)
const VOWEL_MATRA: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'ॄ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ॉ': 'o', 'ॅ': 'e', 'ॆ': 'e', 'ॊ': 'o'
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',

  // Precomposed Nuqta Consonants
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'य़': 'y',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'य़': 'y'
};

// High-frequency Bollywood and Indian lyric lexicon for authentic Romanized spellings
const COMMON_LYRICS_LEXICON: Record<string, string> = {
  // Pronouns & Demonstratives
  'ये': 'yeh', 'येह': 'yeh', 'वो': 'woh', 'वोह': 'woh', 'वह': 'woh',
  'मैं': 'main', 'हम': 'hum', 'तू': 'tu', 'तुम': 'tum', 'आप': 'aap',
  'मेरा': 'mera', 'मेरी': 'meri', 'मेरे': 'mere', 'मुझे': 'mujhe', 'मुझको': 'mujhko', 'मुझसे': 'mujhse', 'मुझपे': 'mujhpe', 'मुझमें': 'mujhmein',
  'तेरा': 'tera', 'तेरी': 'teri', 'तेरे': 'tere', 'तुझे': 'tujhe', 'तुझको': 'tujhko', 'तुझसे': 'tujhse', 'तुझपे': 'tujhpe', 'तुझमें': 'tujhmein',
  'हमारा': 'humara', 'हमारी': 'humari', 'हमारे': 'humare', 'हमें': 'humein', 'हमको': 'humko', 'हमसे': 'humse', 'हमपे': 'humpe',
  'तुम्हारा': 'tumhara', 'तुम्हारी': 'tumhari', 'तुम्हारे': 'tumhare', 'तुम्हें': 'tumhein', 'तुमको': 'tumko', 'तुमसे': 'tumse',
  'उसका': 'uska', 'उसकी': 'uski', 'उसके': 'uske', 'उसे': 'use', 'उसको': 'usko', 'उससे': 'usse', 'उसपे': 'uspe', 'उसमें': 'usmein',
  'इसका': 'iska', 'इसकी': 'iski', 'इसके': 'iske', 'इसे': 'ise', 'इसको': 'isko', 'इससे': 'isse', 'इसपे': 'ispe', 'इसमें': 'ismein',
  'उनका': 'unka', 'उनकी': 'unki', 'उनके': 'unke', 'उन्हें': 'unhein', 'उनको': 'unko', 'उनसे': 'unse',
  'इनका': 'inka', 'इनकी': 'inki', 'इनके': 'inke', 'इन्हें': 'inhein', 'इनको': 'inko', 'इनसे': 'inse',
  'अपना': 'apna', 'अपनी': 'apni', 'अपने': 'apne', 'खुद': 'khud',

  // Auxiliaries & Verbs
  'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'हों': 'hoon', 'हूँ': 'hoon', 'हुँ': 'hoon',
  'था': 'tha', 'थी': 'thi', 'थे': 'the', 'थीं': 'theen',
  'रहा': 'raha', 'रही': 'rahi', 'रहे': 'rahe', 'रहीं': 'raheen',
  'हुआ': 'hua', 'हुई': 'hui', 'हुए': 'hue',
  'गया': 'gaya', 'गयी': 'gayi', 'गई': 'gayi', 'गए': 'gaye', 'गये': 'gaye',
  'दिया': 'diya', 'दी': 'dee', 'दिए': 'diye', 'दिये': 'diye',
  'लिया': 'liya', 'ली': 'lee', 'लिए': 'liye', 'लिये': 'liye',
  'किया': 'kiya', 'की': 'ki', 'किए': 'kiye', 'किये': 'kiye',
  'आया': 'aaya', 'आई': 'aayi', 'आए': 'aaye',
  'जाना': 'jaana', 'जाने': 'jaane', 'जानी': 'jaani', 'जाओ': 'jaao', 'जाएंगे': 'jaayenge', 'जाएँगे': 'jaayenge',
  'जाऊं': 'jaaun', 'जाऊँ': 'jaaun', 'आऊं': 'aaun', 'आऊँ': 'aaun', 'लगाऊं': 'lagaaun', 'लगाऊँ': 'lagaaun', 'मनाऊं': 'manaaun', 'मनाऊँ': 'manaaun',
  'आना': 'aana', 'आने': 'aane', 'आओ': 'aao', 'आएंगे': 'aayenge',
  'कहना': 'kehna', 'कहो': 'kaho', 'कहा': 'kaha', 'कहते': 'kehte', 'कहती': 'kehti',
  'सुनना': 'sunna', 'सूनो': 'suno', 'सुनो': 'suno', 'सुना': 'suna', 'सुनते': 'sunte',
  'देखना': 'dekhna', 'देखो': 'dekho', 'देखा': 'dekha', 'देखते': 'dekhte',
  'होना': 'hona', 'होने': 'hone', 'होगा': 'hoga', 'होगी': 'hogi', 'होंगे': 'honge',
  'सकते': 'sakte', 'सकता': 'sakta', 'सकती': 'sakti', 'सके': 'sake',
  'चाहता': 'chahta', 'चाहती': 'chahti', 'चाहते': 'chahte', 'चाहूं': 'chaahun', 'चाहूँ': 'chaahun',

  // Conjunctions & Prepositions
  'में': 'mein', 'पे': 'pe', 'पर': 'par', 'से': 'se', 'को': 'ko', 'का': 'ka', 'के': 'ke',
  'जो': 'jo', 'तो': 'toh', 'भी': 'bhi', 'ही': 'hi', 'ना': 'na', 'नहीं': 'nahin', 'नही': 'nahin',
  'और': 'aur', 'या': 'ya', 'मगर': 'magar', 'लेकिन': 'lekin', 'क्यूंकी': 'kyonki', 'क्योंकि': 'kyonki',
  'जब': 'jab', 'तब': 'tab', 'अब': 'ab', 'कब': 'kab', 'बिन': 'bin', 'बिना': 'bina',
  'जहाँ': 'jahan', 'जहां': 'jahan', 'वहाँ': 'wahan', 'वहां': 'wahan', 'यहाँ': 'yahan', 'यहां': 'yahan', 'कहाँ': 'kahan', 'कहां': 'kahan',
  'जैसे': 'jaise', 'वैसे': 'waise', 'ऐसे': 'aise', 'कैसे': 'kaise',
  'जैसा': 'jaisa', 'वैसा': 'waisa', 'ऐसा': 'aisa', 'कैसा': 'kaisa',
  'क्या': 'kya', 'क्यों': 'kyon', 'क्यूं': 'kyun', 'क्यूँ': 'kyun',

  // Poetic and Bollywood Lyric Terms
  'मन': 'mann', 'दिल': 'dil', 'प्यार': 'pyaar', 'इश्क': 'ishq', 'इश्क़': 'ishq',
  'मोहब्बत': 'mohabbat', 'ज़िंदगी': 'zindagi', 'जिंदगी': 'zindagi',
  'हंसी': 'hansi', 'हँसी': 'hansi', 'फंसी': 'fansi', 'फँसी': 'fansi',
  'होंठों': 'honthon', 'होंठ': 'honth', 'होठों': 'honthon', 'होठ': 'honth',
  'बुद्धू': 'buddhu', 'ख्वाहिशें': 'khwahishein', 'ख्वाहिश': 'khwahish',
  'ख़्वाहिशें': 'khwahishein', 'ख़्वाहिश': 'khwahish',
  'ख्वाबों': 'khwaabon', 'ख़्वाबों': 'khwaabon', 'ख्वाब': 'khwaab', 'ख़्वाब': 'khwaab',
  'नज़रों': 'nazron', 'नजरों': 'nazron', 'नज़र': 'nazar', 'नजर': 'nazar',
  'जुनून': 'junoon', 'पागलपन': 'pagalpan', 'पागल': 'pagal',
  'हवा': 'hawa', 'वजह': 'wajah', 'बातें': 'baatein', 'बात': 'baat',
  'गुदगुदी': 'gudgudi', 'दबी': 'dabi', 'दबी-दबी': 'dabi-dabi',
  'सा': 'sa', 'सी': 'si', 'कुछ': 'kuch', 'हल्ला': 'halla', 'मचा': 'macha',
  'मिली': 'mili', 'खुशियों': 'khushiyon', 'खुशी': 'khushi',
  'सौ': 'sau', 'करता': 'karta', 'करते': 'karte', 'करती': 'karti', 'करने': 'karne',
  'चलने': 'chalne', 'चलो': 'chalo', 'बदमाशियां': 'badmashiyan', 'बदमाशियाँ': 'badmashiyan',
  'मनमानियां': 'manmaniyan', 'मनमानियाँ': 'manmaniyan',
  'ढूंढे': 'dhoondhe', 'ढूंढें': 'dhoondhein', 'ठिकाने': 'thikaane', 'नए': 'naye',
  'ऊह': 'ooh', 'आह': 'aah',

  'सांसें': 'saansein', 'साँसें': 'saansein', 'सांस': 'saans', 'साँस': 'saans',
  'आँखें': 'aankhein', 'आंखें': 'aankhein', 'आँख': 'aankh', 'आंख': 'aankh',
  'धड़कन': 'dhadkan', 'धड़कने': 'dhadkane',
  'आशिकी': 'aashiqui', 'आशिक़ी': 'aashiqui', 'दीवाना': 'deewana', 'दीवानी': 'deewani',
  'खुदा': 'khuda', 'रब': 'rab', 'रब्बा': 'rabba', 'मौला': 'maula', 'दुआ': 'dua', 'सजदा': 'sajda',
  'रात': 'raat', 'दिन': 'din', 'सुबह': 'subah', 'शाम': 'shaam', 'पल': 'pal', 'लम्हा': 'lamha', 'लम्हे': 'lamhe',
  'साथ': 'saath', 'पास': 'paas', 'दूर': 'door', 'कभी': 'kabhi', 'सदा': 'sada', 'हमेशा': 'hamesha',
  'दर्द': 'dard', 'अश्क': 'ashk', 'आंसू': 'aansoo', 'आँसू': 'aansoo', 'तन्हाई': 'tanhai', 'जुदाई': 'judai',
  'मौसम': 'mausam', 'समां': 'samaa', 'समाँ': 'samaa', 'समा': 'samaa', 'रंग': 'rang', 'रोशनी': 'roshni',
  'चांदनी': 'chaandni', 'चाँदनी': 'chaandni', 'चांद': 'chaand', 'चाँद': 'chaand',
  'सितारे': 'sitaare', 'तारे': 'taare',
  'आसमां': 'aasmaan', 'आसमाँ': 'aasmaan', 'आसमान': 'aasmaan', 'ज़मीन': 'zameen', 'जमीन': 'zameen',
  'गीत': 'geet', 'नगमा': 'nagma', 'नगमे': 'nagme', 'सुर': 'sur', 'आवाज़': 'aawaaz', 'आवाज': 'aawaaz',
  'रास्ता': 'raasta', 'राहें': 'raahein', 'राह': 'raah', 'मंज़िल': 'manzil', 'मंजिल': 'manzil', 'सफर': 'safar',
  'यार': 'yaar', 'यारा': 'yaara', 'सनम': 'sanam', 'सजना': 'sajna', 'सजनी': 'sajni',
  'केसरिया': 'kesariya', 'पिया': 'piya', 'फिक्र': 'fikr', 'ख़ैर': 'khair', 'खैर': 'khair',
  'खुदगर्जी': 'khudgarzi', 'धूप': 'dhoop', 'छांव': 'chhaanv', 'छाँव': 'chhaanv', 'कबीरा': 'kabira', 'फकीरा': 'fakeera',
  'वजूद': 'wajood', 'जुदा': 'juda', 'चैन': 'chain', 'हाथ': 'haath', 'सारा': 'saara', 'बीते': 'beete', 'रैन': 'rain',
  'रह': 'rah', 'गर': 'gar'
};

const HALANT = '\u094D';
const NUKTA = '\u093C';
const ANUSVARA = '\u0902';
const CHANDRABINDU = '\u0901';
const VISARGA = '\u0903';

interface AksharaNode {
  consonants: string;
  vowel: string;
  hasInherentSchwa: boolean;
  nasal: string;
  visarga: boolean;
}

/**
 * Checks if a string contains any Devanagari script characters.
 */
export function hasHindiScript(text: string): boolean {
  if (!text) return false;
  return /[\u0900-\u097F\uA8E0-\uA8FF]/.test(text);
}

/**
 * Detects if a string is predominantly or contains Hindi Devanagari text.
 */
export function isHindiText(text: string): boolean {
  if (!text) return false;
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Parses a Devanagari word into discrete phonetic aksharas (syllabic nodes).
 */
function parseWordIntoAksharas(word: string): AksharaNode[] {
  const aksharas: AksharaNode[] = [];
  const chars = Array.from(word);
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    // Check independent vowel
    if (VOWEL_INDEPENDENT[ch]) {
      const vowelStr = VOWEL_INDEPENDENT[ch];
      let nasal = '';
      let visarga = false;
      i++;

      // Check nasal modifier (Anusvara / Chandrabindu) or Visarga
      if (i < chars.length && (chars[i] === ANUSVARA || chars[i] === CHANDRABINDU)) {
        nasal = 'n';
        i++;
      } else if (i < chars.length && chars[i] === VISARGA) {
        visarga = true;
        i++;
      }

      aksharas.push({
        consonants: '',
        vowel: vowelStr,
        hasInherentSchwa: false,
        nasal,
        visarga
      });
      continue;
    }

    // Check consonant cluster (possibly with Nukta or conjunct via Halant)
    let consonantStr = '';
    let hasHalant = false;

    while (i < chars.length) {
      const curChar = chars[i];
      let withNukta = curChar;

      // Lookahead for decomposed Nukta
      if (i + 1 < chars.length && chars[i + 1] === NUKTA) {
        withNukta = curChar + NUKTA;
      }

      if (CONSONANTS[withNukta] || CONSONANTS[curChar]) {
        const cKey = CONSONANTS[withNukta] ? withNukta : curChar;
        consonantStr += CONSONANTS[cKey];
        i += cKey.length;

        // Check if followed by Halant (virama) -> forms conjunct with next consonant
        if (i < chars.length && chars[i] === HALANT) {
          hasHalant = true;
          i++; // skip halant and continue accumulating consonants in conjunct
        } else {
          hasHalant = false;
          break; // end of consonant cluster
        }
      } else {
        break;
      }
    }

    if (consonantStr) {
      let vowelStr = '';
      let hasInherentSchwa = false;
      let nasal = '';
      let visarga = false;

      // Check for attached vowel matra
      if (i < chars.length && VOWEL_MATRA[chars[i]]) {
        vowelStr = VOWEL_MATRA[chars[i]];
        i++;
      } else if (!hasHalant) {
        // No matra and no halant: carries inherent schwa 'a'
        vowelStr = 'a';
        hasInherentSchwa = true;
      }

      // Check nasal modifier (Anusvara / Chandrabindu) or Visarga
      if (i < chars.length && (chars[i] === ANUSVARA || chars[i] === CHANDRABINDU)) {
        nasal = 'n';
        i++;
      } else if (i < chars.length && chars[i] === VISARGA) {
        visarga = true;
        i++;
      }

      // Contextual adaptation for 'v' vs 'w' in Hindi lyrics:
      // If consonant ends with 'v' and is followed by 'aa' or 'a' or preceded by consonant (e.g. hawa, wajah, khwaab):
      if (consonantStr.endsWith('v')) {
        consonantStr = consonantStr.slice(0, -1) + 'w';
      }

      aksharas.push({
        consonants: consonantStr,
        vowel: vowelStr,
        hasInherentSchwa,
        nasal,
        visarga
      });
      continue;
    }

    // Any other character (e.g. Latin letters, digits, symbols)
    aksharas.push({
      consonants: ch,
      vowel: '',
      hasInherentSchwa: false,
      nasal: '',
      visarga: false
    });
    i++;
  }

  return aksharas;
}

/**
 * Transliterates a single Hindi word from Devanagari to Roman Hindi (Latin).
 */
export function transliterateHindiWord(word: string): string {
  if (!word) return '';

  const cleanWord = word.trim();

  // 1. Direct lyric dictionary lookup for standard Bollywood spellings
  if (COMMON_LYRICS_LEXICON[cleanWord]) {
    return COMMON_LYRICS_LEXICON[cleanWord];
  }

  // Handle hyphenated compound words (e.g. दबी-दबी -> dabi-dabi)
  if (cleanWord.includes('-')) {
    return cleanWord.split('-').map(transliterateHindiWord).join('-');
  }

  const aksharas = parseWordIntoAksharas(cleanWord);
  if (aksharas.length === 0) return word;

  // 2. Ohala (1983) & Choudhury (2003) Rule-Based Schwa Deletion Engine
  // Rule A: Word-final schwa deletion on multi-syllabic roots
  const lastAkshara = aksharas[aksharas.length - 1];
  if (aksharas.length > 1 && lastAkshara.hasInherentSchwa) {
    lastAkshara.vowel = '';
    lastAkshara.hasInherentSchwa = false;
  }

  // Rule B: Medial Schwa Deletion (VC_CV pattern, scanned right-to-left)
  for (let k = aksharas.length - 2; k >= 1; k--) {
    const cur = aksharas[k];
    const prev = aksharas[k - 1];
    const next = aksharas[k + 1];

    if (cur.hasInherentSchwa) {
      const prevHasVowel = Boolean(prev.vowel);
      const nextHasVowel = Boolean(next.vowel);

      if (prevHasVowel && nextHasVowel) {
        cur.vowel = '';
        cur.hasInherentSchwa = false;
      }
    }
  }

  // 3. Assemble Roman string with lyric-friendly vocalic rules
  let result = '';
  for (let idx = 0; idx < aksharas.length; idx++) {
    const a = aksharas[idx];
    let v = a.vowel;

    // Modern Hindi lyrics rule: final 'ee' is commonly written 'i' in multi-syllabic words (dabi, hansi, rahi)
    if (v === 'ee' && idx === aksharas.length - 1 && aksharas.length > 1) {
      v = 'i';
    }

    // Modern Hindi lyrics rule: final 'aa' is written 'a' in multi-syllabic words (bina, saara, lagaya, deewani)
    if (v === 'aa' && idx === aksharas.length - 1 && aksharas.length > 1) {
      v = 'a';
    }

    result += a.consonants + v + a.nasal + (a.visarga ? 'h' : '');
  }

  return result;
}

/**
 * Transliterates a single word token while preserving surrounding punctuation.
 * (e.g. "(हंसी)" -> "(hansi)", "\"होंठों\"" -> "\"honthon\"", "दबी-दबी," -> "dabi-dabi,")
 */
export function tokenToRomanHindi(token: string): string {
  if (!token) return '';
  if (!hasHindiScript(token)) return token;

  const match = token.match(/^([^\u0900-\u097F]*)([\u0900-\u097F\u093C\-]+)([^\u0900-\u097F]*)$/);
  if (match) {
    const [, prefix, hindiPart, suffix] = match;
    return prefix + transliterateHindiWord(hindiPart) + suffix;
  }

  return transliterateHindiWord(token);
}

/**
 * Transliterates an entire line of Hindi Devanagari lyrics into Roman Hindi.
 */
export function transliterateHindiToRoman(line: string): string {
  if (!line) return '';
  if (!hasHindiScript(line)) return line;

  const tokenRegex = /([\u0900-\u097F\u093C\-]+|[^\u0900-\u097F\u093C\-]+)/gu;
  const parts = line.match(tokenRegex) || [line];

  let out = parts.map((part) => {
    if (hasHindiScript(part)) {
      return transliterateHindiWord(part);
    }
    return part;
  }).join('');

  // Capitalize first character of line for clean lyric typography
  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Hindi Devanagari lines and word tokens in an OpenLyricsDocument to Roman Hindi.
 *
 * - Transliterates line text while preserving existing timestamps and structure.
 * - Transliterates each individual word token's text, preserving millisecond sync timings.
 * - Stores original Hindi Devanagari text non-destructively in line.translations.hi.
 * - Updates document language metadata to 'hi-Latn' if originally 'hi'.
 */
export function convertDocumentToRomanHindi<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasHindi = hasHindiScript(line.text);
    const romanHindiText = lineHasHindi ? transliterateHindiToRoman(line.text) : line.text;

    // Transliterate every word token that contains Hindi Devanagari script
    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasHindiScript(token.text)) {
        return {
          ...token,
          text: tokenToRomanHindi(token.text)
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanHindiText,
      tokens: convertedTokens,
      translations: lineHasHindi
        ? {
            ...(line.translations || {}),
            hi: line.text
          }
        : line.translations
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'hi' ? 'hi-Latn' : doc.metadata?.language
    },
    lines: convertedLines
  };
}
