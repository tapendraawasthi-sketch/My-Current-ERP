/**
 * Nepali / Romanized Nepali / Hindi-mixed trader language model for e-Khata.
 * Covers Devanagari script, roman spelling variants (ka/kha, a/aa, cha/chha),
 * and khata-domain vocabulary so the parser accepts how people actually type.
 */

/** Devanagari vowels (swar) → roman */
export const DEVANAGARI_VOWELS: Record<string, string> = {
  "अ": "a",
  "आ": "aa",
  "इ": "i",
  "ई": "ee",
  "उ": "u",
  "ऊ": "oo",
  "ऋ": "ri",
  "ए": "e",
  "ऐ": "ai",
  "ओ": "o",
  "औ": "au",
};

/** Devanagari consonants (vyanjan) base → roman */
export const DEVANAGARI_CONSONANTS: Record<string, string> = {
  "क": "ka",
  "ख": "kha",
  "ग": "ga",
  "घ": "gha",
  "ङ": "nga",
  "च": "cha",
  "छ": "chha",
  "ज": "ja",
  "झ": "jha",
  "ञ": "nya",
  "ट": "ta",
  "ठ": "tha",
  "ड": "da",
  "ढ": "dha",
  "ण": "na",
  "त": "ta",
  "थ": "tha",
  "द": "da",
  "ध": "dha",
  "न": "na",
  "प": "pa",
  "फ": "pha",
  "ब": "ba",
  "भ": "bha",
  "म": "ma",
  "य": "ya",
  "र": "ra",
  "ल": "la",
  "व": "wa",
  "श": "sha",
  "ष": "sha",
  "स": "sa",
  "ह": "ha",
  "क्ष": "ksha",
  "त्र": "tra",
  "ज्ञ": "gya",
};

/** Vowel signs (matra) appended after consonants */
export const DEVANAGARI_MATRA: Record<string, string> = {
  "ा": "aa",
  "ि": "i",
  "ी": "ee",
  "ु": "u",
  "ू": "oo",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ृ": "ri",
};

export const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/**
 * Spelling variants → canonical lemma (sorted longest-first at runtime).
 * Covers a/aa/ah, i/ee/ii, ch/chh/chha, v/w, gyo/gya/vayo/bhayo, etc.
 */
export const SPELLING_ALIASES: Record<string, string> = {
  // Time
  aaja: "aja",
  ajj: "aja",
  aaj: "aja",
  ajha: "aja",
  bholi: "parsi",
  kal: "hijo",
  kaliko: "hijo",
  yesterday: "hijo",
  tomorrow: "parsi",
  today: "aja",

  // Cash
  nagad: "nagad",
  nakad: "nagad",
  nakat: "nakit",
  nakitt: "nakit",
  cash: "cash",
  kesh: "cash",
  nakadma: "nagad",

  // Credit / udhaar
  udhar: "udhaar",
  udharo: "udhaar",
  udaro: "udhaar",
  udhhar: "udhaar",
  udhhaar: "udhaar",
  udaar: "udhaar",
  udaaro: "udhaar",
  credit: "udhaar",
  karz: "udhaar",
  karja: "udhaar",
  उधार: "udhaar",

  // Sale
  bikri: "bikri",
  bikree: "bikri",
  bikry: "bikri",
  becheko: "becheko",
  beche: "becheko",
  bechyo: "becheko",
  bechiyeko: "becheko",
  bikyo: "bikri",
  bikyayo: "bikri",
  sale: "bikri",
  sold: "bikri",

  // Purchase
  kineko: "kineko",
  kine: "kineko",
  kiniyo: "kineko",
  kinyo: "kineko",
  kinna: "kineko",
  kharid: "kineko",
  kharido: "kineko",
  kharidyo: "kineko",
  purchase: "kineko",

  // Payment in
  tiryo: "tiryo",
  tireko: "tiryo",
  tire: "tiryo",
  tira: "tiryo",
  tiryoo: "tiryo",
  tirnu: "tiryo",
  jama: "tiryo",
  jamayo: "tiryo",
  aayo: "tiryo",
  aayeko: "tiryo",
  aaye: "tiryo",
  payo: "tiryo",
  paye: "tiryo",
  received: "tiryo",
  milyo: "tiryo",

  // Payment out
  "payment gareko": "payment gareko",
  "payment made": "payment gareko",
  "paisa diye": "payment gareko",
  "tirna diye": "payment gareko",
  bhugtan: "payment gareko",

  // Expense
  kharcha: "kharcha",
  kharcho: "kharcha",
  kharch: "kharcha",
  karcha: "kharcha",
  expense: "kharcha",

  // Verbs / tense
  diye: "diye",
  die: "diye",
  diya: "diye",
  diae: "diye",
  diyo: "diye",
  diyeko: "diye",
  दिए: "diye",
  gareko: "gareko",
  garne: "gareko",
  garyo: "gareko",
  vayo: "vayo",
  bhayo: "vayo",
  vayeko: "vayo",
  bhayeko: "vayo",
  gyo: "vayo",
  gayo: "vayo",
  gaya: "vayo",
  gya: "vayo",
  gyi: "vayo",
  hune: "vayo",
  hunxa: "vayo",
  huncha: "vayo",

  // Particles (kept for matching, some stripped later)
  lai: "lai",
  le: "le",
  sanga: "sanga",
  bata: "bata",
  bhand: "bata",

  // Money
  rs: "rs",
  rupees: "rs",
  rupiya: "rs",
  rupya: "rs",
  rupiye: "rs",
  rupiah: "rs",
  npr: "rs",
  "₨": "rs",

  // Numbers (Hindi/Nepali words → canonical)
  ek: "ek",
  one: "ek",
  dui: "dui",
  do: "dui",
  two: "dui",
  tin: "tin",
  teen: "tin",
  three: "tin",
  char: "char",
  chaar: "char",
  four: "char",
  panch: "panch",
  paanch: "panch",
  five: "panch",
  chha: "chha",
  cha: "chha",
  chh: "chha",
  six: "chha",
  saat: "saat",
  sat: "saat",
  seven: "saat",
  aath: "aath",
  aat: "aath",
  eight: "aath",
  nau: "nau",
  no: "nau",
  nine: "nau",
  das: "das",
  dus: "das",
  ten: "das",
  saya: "saya",
  sau: "saya",
  hundred: "saya",
  hajar: "hajar",
  hazar: "hajar",
  thousand: "hajar",
  lakh: "lakh",
  lac: "lakh",

  // Chat
  namaste: "namaste",
  namaskar: "namaste",
  namaskaar: "namaste",
  hello: "namaste",
  hi: "namaste",
  hey: "namaste",
  dhanyabad: "dhanyabad",
  dhanybaad: "dhanyabad",
  thanks: "dhanyabad",
  thankyou: "dhanyabad",
  shukriya: "dhanyabad",
  help: "help",
  madat: "help",
  sahayata: "help",
};

/** Multi-word phrases (longer matches first) */
export const PHRASE_ALIASES: [string, string][] = [
  ["cash ma", "cash ma"],
  ["nagad ma", "nagad ma"],
  ["nagad bikri", "nagad bikri"],
  ["nakad bikri", "nagad bikri"],
  ["ko nagad bikri", "ko nagad bikri"],
  ["udhaar diye", "udhaar diye"],
  ["udhar diye", "udhaar diye"],
  ["udharo diye", "udhaar diye"],
  ["credit diye", "udhaar diye"],
  ["payment gareko", "payment gareko"],
  ["payment received", "tiryo"],
  ["paisa aayo", "tiryo"],
  ["kitna udhaar", "balance"],
  ["kati udhaar", "balance"],
  ["udhaar kati", "balance"],
  ["balance kati", "balance"],
  ["ke garna milcha", "help"],
  ["kasari entry garne", "help"],
  ["kasari lekhne", "help"],
  ["udhaar becheko", "udhaar becheko"],
  ["udharo becheko", "udhaar becheko"],
  ["ko udhaar becheko", "ko udhaar becheko"],
];

/** Canonical vocabulary grouped by meaning (for docs / future ML) */
export const VOCABULARY = {
  time: ["aja", "hijo", "parsi", "bholi"],
  money: ["rs", "rupiya", "npr", "saya", "hajar", "lakh"],
  credit: ["udhaar", "udharo", "credit", "karz"],
  cash: ["cash", "nagad", "nakit"],
  sale: ["bikri", "becheko", "beche", "sale"],
  purchase: ["kineko", "kharid", "kiniyo"],
  paymentIn: ["tiryo", "jama", "aayo", "milyo"],
  paymentOut: ["payment gareko", "bhugtan"],
  expense: ["kharcha", "kharcho"],
  verbs: ["diye", "gareko", "vayo", "bhayo", "gyo", "gayo"],
  particles: ["lai", "le", "ko", "ma", "ra", "sanga", "bata"],
  greeting: ["namaste", "namaskar"],
  thanks: ["dhanyabad", "shukriya"],
} as const;

/** Greeting / chat triggers */
export const CHAT_GREETING =
  /\b(namaste|namaskar|namaskaar|hello|hi|hey|good\s*(morning|evening|afternoon))\b/i;
/** Casual Nepali small-talk (k xa, ke cha, kasto cha, etc.) */
export const CHAT_CASUAL =
  /^(?:k|ke|ki)\s*(?:xa|x|chha|cha|ho|huncha|hunu\s*huncha)(?:\s*ta)?$|^(?:kasto|kasari|kina)\s*(?:cha|chha|ho|huncha)(?:\s*ta)?$|^(?:sab|sabb?)\s*(?:thik|ramro)(?:\s*cha|\s*chha)?$|^(?:thik|ramro)\s*(?:cha|chha)(?:\s*ta)?$|^(?:hajur|hajurr?|ji)(?:\s*ji)?$/i;
export const CHAT_THANKS = /\b(dhanyabad|dhanybaad|thanks|thank\s*you|shukriya)\b/i;
export const CHAT_HELP =
  /\b(help|madat|sahayata|kasari|ke\s*garne|ke\s*garna|example|udaharan|sikau|siknus)\b/i;
export const CHAT_BALANCE =
  /\b(balance|kati\s*(cha|chha|ho|huncha)|kitna|udhaar\s*kati|kati\s*udhaar|udharo\s*kati|total\s*udhaar)\b/i;
export const CHAT_BYE = /\b(bye|goodbye|paxi|feri|alvida)\b/i;

export const NEPALI_DIGIT_MAP: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

export const WORD_TO_NUMBER: Record<string, number> = {
  ek: 1,
  dui: 2,
  tin: 3,
  char: 4,
  panch: 5,
  chha: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  bis: 20,
  tis: 30,
  chaalis: 40,
  pachaas: 50,
  saath: 60,
  sattar: 70,
  assi: 80,
  nabbe: 90,
  saya: 100,
  sau: 100,
  hajar: 1000,
  hazar: 1000,
  lakh: 100000,
  lac: 100000,
};
