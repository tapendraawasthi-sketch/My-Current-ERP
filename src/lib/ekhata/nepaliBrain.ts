/**
 * Self-contained Nepali language brain for e-Khata.
 * Understands Roman/Devanagari Nepali, Hindi-mixed trader speech, and generates
 * contextual human-like replies — no Ollama, WebLLM, or external APIs.
 */

import { normalizeNepaliText, tokenizeNepali } from "./normalizeNepali";
import type { LedgerBalanceSnapshot } from "./conversationEngine";
import { replyBalance, replyHelp } from "./conversationEngine";

export type NepaliTopic =
  | "greeting"
  | "status"
  | "food"
  | "drink"
  | "health"
  | "identity"
  | "thanks"
  | "bye"
  | "help"
  | "balance"
  | "emotion"
  | "time"
  | "weather"
  | "business"
  | "affirmation"
  | "negation"
  | "general";

export type QuestionKind = "yes_no" | "what" | "who" | "how" | "when" | "why" | "where" | "how_much" | "none";

export interface NepaliAnalysis {
  normalized: string;
  tokens: string[];
  topics: NepaliTopic[];
  primaryTopic: NepaliTopic;
  isQuestion: boolean;
  questionKind: QuestionKind;
  mentionsYou: boolean;
  mentionsMe: boolean;
  sentiment: "positive" | "negative" | "neutral";
}

/** Topic lexicons — lemmas after normalization */
const LEXICON: Record<NepaliTopic, string[]> = {
  greeting: [
    "namaste", "namaskar", "hello", "hi", "hey", "subha", "subha prabhat", "shubha",
    "bihana", "beluka", "sandhya", "good", "morning", "evening",
  ],
  status: [
    "xa", "x", "chha", "cha", "ho", "huncha", "hunu", "thik", "ramro", "sab", "kasto",
    "k xa", "ke cha", "kasto cha", "sanchai", "theek", "tik",
  ],
  food: [
    "khana", "khaye", "khayeu", "khayo", "khannu", "bhok", "bhoko", "pakyo", "pakayeu",
    "bhath", "bhat", "roti", "tarkari", "masu", "dal", "khaja", "nashta", "bela",
    "khana khayo", "khana khayeu", "khana khannu", "bhojan",
  ],
  drink: ["pani", "chiya", "chai", "coffee", "dudh", "juice", "peeu", "peyo", "khayo pani"],
  health: ["tabiyat", "birami", "bimar", "dukhne", "dard", "thik", "sanchai", "hospital", "dawai", "aushadhi"],
  identity: ["ko", "k ho", "ko ho", "naam", "name", "timi", "tapai", "hajur", "k ho yo"],
  thanks: ["dhanyabad", "shukriya", "thanks", "thank", "dhanyabaad", "meharbani"],
  bye: ["bye", "alvida", "paxi", "feri", "goodbye", "bida", "jaane"],
  help: ["help", "madat", "sahayata", "kasari", "sikau", "siknus", "udaharan", "example", "ke garne", "k garne"],
  balance: ["balance", "kati", "kitna", "udhaar", "baki", "total", "hisab", "hisaab"],
  emotion: ["dukha", "khushi", "risha", "thakit", "thak", "busy", "stress", "tension", "dar", "nervous", "ramro lagyo"],
  time: ["baje", "samay", "time", "aile", "ahile", "kati baje", "bela", "din", "hijo", "aja", "parsi"],
  weather: ["pani", "barsha", "gham", "hawa", "jado", "garmi", "mausam", "weather", "cloud", "badal"],
  business: ["pasal", "dukan", "shop", "byapar", "bechnu", "kinne", "customer", "grahak", "supplier", "profit", "loss"],
  affirmation: ["ho", "huncha", "thik", "ramro", "hajur", "ji", "bilkul", "exactly", "yes", "ok", "huncha"],
  negation: ["hoina", "chaina", "nadine", "no", "nai", "bhayena", "vayena"],
  general: [],
};

const QUESTION_WORDS: Record<QuestionKind, string[]> = {
  yes_no: ["ho", "huncha", "cha", "chha", "hunxa", "garnu", "khayo", "khayeu", "gayeu", "aayo"],
  what: ["ke", "k", "ki", "k ho", "ke ho", "kya", "what"],
  who: ["ko", "kasle", "kole", "who"],
  how: ["kasto", "kasari", "kina garne", "how"],
  when: ["kaila", "kahile", "when", "kati baje"],
  why: ["kina", "kyun", "why"],
  where: ["kaha", "kaha", "where", "kata"],
  how_much: ["kati", "kitna", "how much"],
  none: [],
};

const YOU_WORDS = new Set(["tapai", "timi", "tapaile", "timile", "hajur", "dai", "didi", "bhai", "hajur"]);
const ME_WORDS = new Set(["ma", "malaai", "malai", "mero", "hami", "hajur lai"]);

function hashPick(seed: string, variants: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}

function scoreTopics(tokens: string[], full: string): NepaliTopic[] {
  const scores = new Map<NepaliTopic, number>();

  for (const [topic, words] of Object.entries(LEXICON) as [NepaliTopic, string[]][]) {
    if (topic === "general") continue;
    for (const word of words) {
      if (word.includes(" ")) {
        if (full.includes(word)) scores.set(topic, (scores.get(topic) ?? 0) + 3);
      } else if (tokens.includes(word)) {
        scores.set(topic, (scores.get(topic) ?? 0) + 1);
      }
    }
  }

  // Short status queries: "k xa", "ke cha"
  if (/^(?:k|ke|ki)\s*(?:xa|x|chha|cha|ho|huncha)/.test(full.trim())) {
    scores.set("status", (scores.get("status") ?? 0) + 5);
    scores.set("greeting", (scores.get("greeting") ?? 0) + 2);
  }

  const ranked = [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  return ranked.length ? ranked : ["general"];
}

function detectQuestionKind(tokens: string[], full: string, isQuestion: boolean): QuestionKind {
  if (!isQuestion) return "none";

  for (const [kind, words] of Object.entries(QUESTION_WORDS) as [QuestionKind, string[]][]) {
    if (kind === "none") continue;
    if (words.some((w) => tokens.includes(w) || full.includes(w))) return kind;
  }

  if (/\?$/.test(full) || /\b(ho|huncha|cha|chha)\s*\??$/.test(full)) return "yes_no";
  return "what";
}

function detectSentiment(tokens: string[]): "positive" | "negative" | "neutral" {
  const pos = ["ramro", "thik", "khushi", "dhanyabad", "sanchai", "masto", "badhi"];
  const neg = ["naramro", "dukh", "birami", "thak", "stress", "problem", "garo", "dikkat"];
  if (tokens.some((t) => pos.includes(t))) return "positive";
  if (tokens.some((t) => neg.includes(t))) return "negative";
  return "neutral";
}

export function analyzeNepaliMessage(raw: string): NepaliAnalysis {
  const normalized = normalizeNepaliText(raw);
  const tokens = tokenizeNepali(raw);
  const trimmed = normalized.trim();
  const rawTrimmed = raw.trim();

  const isQuestion =
    /\?/.test(rawTrimmed) ||
    /\?$/.test(trimmed) ||
    /\b(ke|ki|k|kati|kasle|kaha|kina|kasto|kasari|kaila|kahile|k ho|ke ho|kya)\b/.test(trimmed) ||
    /\b(ho|huncha|cha|chha|hunxa)\s*\??$/.test(trimmed) ||
    /\b(khayeu|khayo|khannu|gayo|gayeu|aayo|aayeu|garnu|bhayo|vayo)\s*\??$/.test(trimmed);

  const topics = scoreTopics(tokens, trimmed);
  const primaryTopic = topics[0] ?? "general";

  return {
    normalized: trimmed,
    tokens,
    topics,
    primaryTopic,
    isQuestion,
    questionKind: detectQuestionKind(tokens, trimmed, isQuestion),
    mentionsYou:
      tokens.some((t) => YOU_WORDS.has(t)) ||
      /\b(khayeu|khayo|gayo|gayeu|garnu bhayo|sanchai cha)\b/.test(trimmed),
    mentionsMe: tokens.some((t) => ME_WORDS.has(t)),
    sentiment: detectSentiment(tokens),
  };
}

function replyGreeting(analysis: NepaliAnalysis): string {
  if (analysis.primaryTopic === "status" || analysis.questionKind === "yes_no") {
    return hashPick(analysis.normalized, [
      "Thik cha hajur! Tapai kasto hunuhuncha? Khata entry garna cha bhane sidhai lekhna milcha.",
      "Sab ramro cha! Ma e-Khata — khata ra kura dono garna tayar chu. Ke chaincha?",
      "Ramro cha! Aaja ke transaction cha? Lekhnus jastai `Ram lai 500 udhaar diye`.",
    ]);
  }
  return hashPick(analysis.normalized, [
    "Namaste hajur! Ma tapai ko khata sakhi. Nepali ma kura garna ra entry lekhna milcha.",
    "Namaskar! Khata, udhaar, bikri — sabai yahi lekhna milcha. Kura pani garna milcha.",
  ]);
}

function replyFood(analysis: NepaliAnalysis): string {
  if (analysis.isQuestion && analysis.mentionsYou) {
    return hashPick(analysis.normalized, [
      "Hajur, khana khaye! Tapai le khannu bhayo? Khana pachhi khata entry chaincha bhane bhannus.",
      "Khaye hai, dhanyabad sodhnu bhayo. Timi le ni khayo? Khata kura ta ma sanga cha hai.",
      "Ho hajur, khana sakiye. Tapai ko bela ni bhayo ki? Khata entry garna milcha yaha.",
    ]);
  }
  if (analysis.tokens.some((t) => ["bhok", "bhoko"].includes(t))) {
    return "Bhok lagyo hola — pahile khana khaaunus! Khata entry chaiyo bhane pachhi lekhna milcha.";
  }
  return hashPick(analysis.normalized, [
    "Khana kura ramro! Khana khayepachhi khata entry garne ho ki aru kehi sodhne?",
    "Khana ta jaruri ho. Khata transaction cha bhane bhannus — ma bujhchu.",
  ]);
}

function replyIdentity(): string {
  return (
    "Ma **e-Khata** — Sutra ERP bhitra ko tapai ko khata sahayogi.\n\n" +
    "Nepali, Roman Nepali, Devanagari, Hindi-mixed — sabai bujhchu. " +
    "Khata entry, udhaar, bikri, tiryo — ra sadharan kura pani garna milcha. API key chaina, sabai yahi app bhitra cha."
  );
}

function replyHealth(analysis: NepaliAnalysis): string {
  if (analysis.sentiment === "negative" || analysis.tokens.some((t) => ["birami", "bimar", "dukhne"].includes(t))) {
    return "Tabiyat naramro cha hola — aaram garnus. Khata entry chaiyo bhane bistaro lekhna milcha, ma bujhchu.";
  }
  return "Sanchai cha bhane ramro! Khata kura chaincha bhane sodhnus.";
}

function replyEmotion(analysis: NepaliAnalysis): string {
  if (analysis.sentiment === "negative") {
    return hashPick(analysis.normalized, [
      "Garo lagiracha hola. Khata safa rakhda man pani halka huncha — kehi entry cha bhane lekhna milcha.",
      "Thakit hunu bhayo hola. Aram garnus. Khata kura cha bhane ma sanga kura garnus.",
    ]);
  }
  return "Ramro sunera khushi lagyo! Aru kehi chaincha?";
}

function replyTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `Aile ${h12}:${mins.toString().padStart(2, "0")} ${period} bajeko cha. Khata entry garna tayar chu.`;
}

function replyWeather(analysis: NepaliAnalysis): string {
  if (analysis.tokens.some((t) => ["pani", "barsha"].includes(t))) {
    return "Pani parna sakcha — saman sambhalera rakhnu hola. Khata entry chaiyo bhane bhannus.";
  }
  if (analysis.tokens.some((t) => ["gham", "garmi"].includes(t))) {
    return "Garmi cha hola — pani piyera aaram garnus. Khata kura cha bhane sodhnus.";
  }
  return "Mausam kura ta bahira hernu parcha, tara khata bhitra ma sabai thik cha. Entry garna milcha.";
}

function replyBusiness(): string {
  return hashPick("business", [
    "Byapar ramro chaliracha hola. Aaja ko bikri, udhaar, tiryo — ke entry garne? Sidhai lekhna milcha.",
    "Dukan ko hisab yahi rakhna milcha. `aaja 200 ko nagad bikri vayo` jastai lekhnus.",
  ]);
}

function replyGeneralQuestion(analysis: NepaliAnalysis): string {
  const kind = analysis.questionKind;
  if (kind === "who") {
    return "Ma e-Khata ho — tapai ko khata sahayogi. Ko barema sodhnu bhayo? Khata party ko naam entry ma lekhna milcha.";
  }
  if (kind === "how" || kind === "what") {
    return replyHelp();
  }
  if (kind === "how_much") {
    return "Rakam kati ho bhane number sahit lekhnu hola — jastai 500, paanch saya, 1 hajar. Ma parse garera confirm card dekhauchu.";
  }
  if (kind === "why") {
    return "Kina bhane tapai lai ramro hisab rakhna — udhaar birsinu hudaina! Entry lekhda ma madat garchu.";
  }
  if (kind === "where") {
    return "Ma yahi Sutra ERP ko e-Khata panel bhitra chu. Khata entry yahi save huncha.";
  }
  if (kind === "when") {
    return "Aaja, hijo, parsi — jasto miti lekhnu bhayo tei linchu. `aaja` bhannus athaba date lekhna milcha.";
  }
  return hashPick(analysis.normalized, [
    "Bujhe! Khata entry ho ki aru kura? Dono garna milcha — Nepali ma lekhna saknu huncha.",
    "Hajur, sodhnus. Ma khata ra sadharan Nepali kura dono bujhchu. Transaction bhaye rakam sahit lekhnu hola.",
    "Thik cha. Khata kura chaincha bhane udaharan: `Ram lai 500 udhaar diye`. Aru kura bhaye sodhte rahanus.",
  ]);
}

function replyAffirmation(): string {
  return hashPick("affirmation", [
    "Ramro! Aru entry athaba kura chaincha?",
    "Thik cha hajur. Ke garna milcha bhane bhannus.",
  ]);
}

function replyNegation(): string {
  return "Thik cha, chaina bhane kehi gardaina. Aru kehi chaincha bhane sodhnus.";
}

function replyDrink(analysis: NepaliAnalysis): string {
  if (analysis.isQuestion) {
    return hashPick(analysis.normalized, [
      "Chiya pani khaye! Tapai le? Khata entry chaincha bhane bhannus.",
      "Pani/chiya — thik cha. Khata kura cha bhane sodhnus.",
    ]);
  }
  return "Ramro! Khata entry garna cha bhane lekhna milcha.";
}

export function generateNepaliReply(raw: string, balance?: LedgerBalanceSnapshot): string {
  const analysis = analyzeNepaliMessage(raw);

  if (analysis.topics.includes("thanks")) {
    return "Swagat cha hajur! Aru entry athaba kura chaincha bhane sodhnus.";
  }
  if (analysis.topics.includes("bye")) {
    return "Ram ram! Khata entry chaiyo bhane feri sodhnus hai.";
  }
  if (analysis.topics.includes("help")) {
    return replyHelp();
  }
  if (analysis.topics.includes("balance")) {
    return replyBalance(balance);
  }
  if (analysis.topics.includes("identity") || (analysis.questionKind === "what" && analysis.tokens.includes("ho"))) {
    return replyIdentity();
  }

  switch (analysis.primaryTopic) {
    case "greeting":
    case "status":
      return replyGreeting(analysis);
    case "food":
      return replyFood(analysis);
    case "drink":
      return replyDrink(analysis);
    case "health":
      return replyHealth(analysis);
    case "emotion":
      return replyEmotion(analysis);
    case "time":
      return replyTime();
    case "weather":
      return replyWeather(analysis);
    case "business":
      return replyBusiness();
    case "affirmation":
      return replyAffirmation();
    case "negation":
      return replyNegation();
    default:
      if (analysis.isQuestion) return replyGeneralQuestion(analysis);
      return replyGeneralQuestion(analysis);
  }
}

export function isConversationalMessage(raw: string): boolean {
  const analysis = analyzeNepaliMessage(raw);
  if (analysis.primaryTopic !== "general") return true;
  if (analysis.isQuestion) return true;
  if (analysis.tokens.length <= 6 && !/\d/.test(analysis.normalized)) return true;
  return false;
}
