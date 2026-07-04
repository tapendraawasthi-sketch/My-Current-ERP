/**
 * e-Khata Conversational Reasoning Brain
 *
 * Understands what the user is actually asking — not just keyword matching.
 * Uses question-type analysis, conversation memory, emotional intelligence,
 * and contextual reasoning to produce human-like Nepali/English replies.
 */

import type { LedgerBalanceSnapshot } from "./conversationEngine";
import { replyBalance } from "./conversationEngine";
import { searchKnowledge } from "./nepaliBrain";
import {
  composeEmotionalReply,
  detectEmotionalContext,
  isEmotionalMessage,
} from "./emotionalBrain";

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuestionKind =
  | "about_bot_gender"
  | "about_bot_identity"
  | "about_bot_human"
  | "about_bot_feelings"
  | "about_bot_age"
  | "opinion_preference"
  | "opinion_thought"
  | "factual_what"
  | "factual_how"
  | "factual_why"
  | "factual_when"
  | "factual_where"
  | "factual_who"
  | "small_talk"
  | "greeting"
  | "farewell"
  | "thanks"
  | "help"
  | "capability"
  | "balance"
  | "affirmation"
  | "negation"
  | "abuse"
  | "math"
  | "follow_up"
  | "user_emotion"
  | "unknown";

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface QuestionAnalysis {
  kind: QuestionKind;
  topic: string | null;
  subject: string | null;
  isQuestion: boolean;
  language: "nepali" | "english" | "mixed";
  confidence: number;
  rawIntent: string;
}

// ─── Question Understanding ──────────────────────────────────────────────────

const GREETING =
  /^(hajur\s*|tapai\s*)?(namaste|namaskar|hello|hi|hey|good\s*(morning|evening|afternoon|night)|subha|shubha|k\s*cha|k\s*xa|kasto\s*cha|kasto\s*xa)\b/i;
const FAREWELL = /\b(bye|goodbye|alvida|ta\s*ta|tata|good\s*night|see\s*you|pheri\s*bhetaula)\b/i;
const THANKS = /\b(dhanyabad|dhanyabaad|thanks|thank\s*you|shukriya|thx)\b/i;
const HELP = /\b(help|madat|sahayog|sahara|kasari|how\s*to|sikaunu|bataunu)\b/i;
const CAPABILITY =
  /\b(what\s*(can|do)\s*you|what\s*do\s*you\s*do|tim(i|lai)\s*(k\s*k|ke\s*ke|kk)\s*(thaha|tha|janch|bujhch|sakch)|timi\s*sanga\s*(brain|dimag|buddhi)|you\s*smart|your\s*capabilities)\b/i;
const ABUSE = /\b(muji|randi|lado|chikne|machikne|fuck|shit|bastard)\b/i;
const BALANCE = /\b(kati\s*udhaar|udhaar\s*kati|kitna|baki|total\s*udhaar|hisab\s*kati)\b/i;

function detectLanguage(text: string): "nepali" | "english" | "mixed" {
  if (/[\u0900-\u097F]/.test(text)) return "nepali";
  if (
    /\b(the|is|are|was|what|who|how|why|when|where|do|does|can|you|your|favourite|favorite)\b/i.test(
      text,
    )
  )
    return "english";
  return "mixed";
}

function extractTopic(text: string): string | null {
  const t = text.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\b(movie|film|cinema|picture)\b/i, "movie"],
    [/\b(music|gaana|song|sangeet)\b/i, "music"],
    [/\b(food|khana|khaana|recipe)\b/i, "food"],
    [/\b(color|colour|rang)\b/i, "color"],
    [/\b(book|kitab|pustak)\b/i, "book"],
    [/\b(sport|khel|cricket|football)\b/i, "sport"],
    [/\b(place|thau|city|sahar)\b/i, "place"],
    [/\b(weather|mausam)\b/i, "weather"],
    [/\b(singer|gayak|artist)\b/i, "singer"],
    [/\b(actor|abhineta|hero|heroine)\b/i, "actor"],
    [/\b(team|tole)\b/i, "team"],
    [/\b(drink|peene|drink)\b/i, "drink"],
  ];
  for (const [re, topic] of patterns) {
    if (re.test(t)) return topic;
  }
  return null;
}

export function analyzeQuestion(text: string, history: ConversationTurn[] = []): QuestionAnalysis {
  const t = text.toLowerCase().trim();
  const lang = detectLanguage(text);
  const isQuestion =
    /[?？]/.test(t) ||
    /\b(k[aei]|kina|kasari|kahile|kaha|kati|kun|who|what|when|where|why|how|which|does|is|are|can|could|do|did|will|would|should)\b/i.test(
      t,
    );

  if (ABUSE.test(t)) {
    return {
      kind: "abuse",
      topic: null,
      subject: null,
      isQuestion,
      language: lang,
      confidence: 0.95,
      rawIntent: "abuse",
    };
  }

  // Emotional sharing — detect feelings before factual parsing
  const emotional = detectEmotionalContext(text, history);
  if (
    emotional.primaryEmotion !== "neutral" &&
    emotional.intensity !== "low" &&
    !isQuestion &&
    !BALANCE.test(t) &&
    !CAPABILITY.test(t)
  ) {
    return {
      kind: "user_emotion",
      topic: emotional.primaryEmotion,
      subject: "user",
      isQuestion: false,
      language: lang,
      confidence: 0.88,
      rawIntent: `emotion_${emotional.primaryEmotion}`,
    };
  }

  if (BALANCE.test(t) && !/\bbalance\s*sheet\b/i.test(t)) {
    return {
      kind: "balance",
      topic: "khata",
      subject: null,
      isQuestion,
      language: lang,
      confidence: 0.9,
      rawIntent: "balance_query",
    };
  }

  // Bot gender / identity questions — must come BEFORE affirmation check
  if (
    /\b(timi|tapai|you)\s*(ko\s*)?(kta|keta|boy|male|man|ladka|larka)\b/i.test(t) ||
    /\b(timi|tapai|you)\s*(ko\s*)?(kt|keti|girl|female|woman|ladki|larki)\b/i.test(t) ||
    /\b(are\s*you\s*(a\s*)?(boy|girl|man|woman|male|female))\b/i.test(t) ||
    /\b(timi\s*(human|manav|manushya)\s*ho|are\s*you\s*human)\b/i.test(t)
  ) {
    const isGender = /\b(kta|keta|boy|male|kt|keti|girl|female|ladka|ladki|larka|larki)\b/i.test(t);
    return {
      kind: isGender ? "about_bot_gender" : "about_bot_human",
      topic: null,
      subject: "bot",
      isQuestion: true,
      language: lang,
      confidence: 0.92,
      rawIntent: isGender ? "gender_question" : "human_question",
    };
  }

  if (
    /\b(timi|tapai|you)\s*(ko|kun)\s*(ho|hau|hau|cha|xau)\b/i.test(t) ||
    /\bwho\s*are\s*you\b/i.test(t) ||
    /\b(ta\s*ko\s*ho|timro\s*naam|your\s*name|about\s*you|introduce\s*yourself)\b/i.test(t)
  ) {
    return {
      kind: "about_bot_identity",
      topic: null,
      subject: "bot",
      isQuestion: true,
      language: lang,
      confidence: 0.9,
      rawIntent: "identity",
    };
  }

  if (
    /\b(timi|tapai|you)\s*(lai|ko)\s*(k\s*asto\s*lag|feel|feelings|emotion|dukhi|khushi)\b/i.test(t)
  ) {
    return {
      kind: "about_bot_feelings",
      topic: null,
      subject: "bot",
      isQuestion: true,
      language: lang,
      confidence: 0.85,
      rawIntent: "feelings",
    };
  }

  if (/\b(timi|tapai|you)\s*(ko\s*)?(umar|age|kati\s*barsa|how\s*old)\b/i.test(t)) {
    return {
      kind: "about_bot_age",
      topic: null,
      subject: "bot",
      isQuestion: true,
      language: lang,
      confidence: 0.88,
      rawIntent: "age",
    };
  }

  if (CAPABILITY.test(t)) {
    return {
      kind: "capability",
      topic: null,
      subject: "bot",
      isQuestion,
      language: lang,
      confidence: 0.9,
      rawIntent: "capability",
    };
  }

  if (HELP.test(t) || /^(madat|help|sahayog)$/i.test(t)) {
    return {
      kind: "help",
      topic: null,
      subject: null,
      isQuestion: isQuestion || /^(madat|help|sahayog)$/i.test(t),
      language: lang,
      confidence: 0.85,
      rawIntent: "help",
    };
  }

  // Opinion / preference questions
  if (
    /\b(favourite|favorite|pasand|man\s*par|ramro\s*lag|best|top|sabai\s*banda)\b/i.test(t) &&
    (isQuestion || extractTopic(t))
  ) {
    return {
      kind: "opinion_preference",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.88,
      rawIntent: "preference",
    };
  }

  if (/\b(what\s*do\s*you\s*think|timro\s*ichchha|timro\s*opinion|tapaiko\s*bichar)\b/i.test(t)) {
    return {
      kind: "opinion_thought",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.85,
      rawIntent: "opinion",
    };
  }

  // Factual question types
  if (/\b(what\s*is|what\s*are|k\s*ho|ke\s*ho|k\s*chha|ke\s*chha)\b/i.test(t)) {
    return {
      kind: "factual_what",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.8,
      rawIntent: "what_is",
    };
  }
  if (/\b(how\s*(to|do|does|can|is)|kasari|k\s*garne)\b/i.test(t)) {
    return {
      kind: "factual_how",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.8,
      rawIntent: "how_to",
    };
  }
  if (/\b(why|kina|k\s*le)\b/i.test(t)) {
    return {
      kind: "factual_why",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.75,
      rawIntent: "why",
    };
  }
  if (/\b(when|kahile|k\s*baje)\b/i.test(t)) {
    return {
      kind: "factual_when",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.75,
      rawIntent: "when",
    };
  }
  if (/\b(where|kaha|k\s*ma)\b/i.test(t)) {
    return {
      kind: "factual_where",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.75,
      rawIntent: "where",
    };
  }
  if (/\b(who|ko\s*ho|kun\s*ho)\b/i.test(t)) {
    return {
      kind: "factual_who",
      topic: extractTopic(t),
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.75,
      rawIntent: "who",
    };
  }

  if (GREETING.test(t) && t.length < 40) {
    return {
      kind: "greeting",
      topic: null,
      subject: null,
      isQuestion: false,
      language: lang,
      confidence: 0.9,
      rawIntent: "greeting",
    };
  }
  if (FAREWELL.test(t)) {
    return {
      kind: "farewell",
      topic: null,
      subject: null,
      isQuestion: false,
      language: lang,
      confidence: 0.9,
      rawIntent: "farewell",
    };
  }
  if (THANKS.test(t)) {
    return {
      kind: "thanks",
      topic: null,
      subject: null,
      isQuestion: false,
      language: lang,
      confidence: 0.9,
      rawIntent: "thanks",
    };
  }

  // Small talk
  if (
    /\b(k\s*cha|k\s*xa|kasto\s*cha|how\s*are\s*you|sanchai|thik\s*cha|what'?s\s*up|wassup)\b/i.test(
      t,
    )
  ) {
    return {
      kind: "small_talk",
      topic: null,
      subject: null,
      isQuestion: true,
      language: lang,
      confidence: 0.85,
      rawIntent: "small_talk",
    };
  }

  // Math
  if (/\b(\d+\s*[\+\-\*\/x]\s*\d+)\b/.test(t)) {
    return {
      kind: "math",
      topic: "math",
      subject: null,
      isQuestion: false,
      language: lang,
      confidence: 0.95,
      rawIntent: "math",
    };
  }

  // Affirmation — only standalone short responses, NOT embedded in questions
  if (
    t.length < 20 &&
    !isQuestion &&
    /^(ho|hunchha|thik|sahi|okay|ok|yes|huss|huncha|ramro|nice|good|la|hajur)$/i.test(t)
  ) {
    return {
      kind: "affirmation",
      topic: null,
      subject: null,
      isQuestion: false,
      language: lang,
      confidence: 0.8,
      rawIntent: "affirmation",
    };
  }

  if (
    t.length < 25 &&
    !isQuestion &&
    /^(hoina|chaina|chhaina|xaina|no|nope|nah|na|pardaina)$/i.test(t)
  ) {
    return {
      kind: "negation",
      topic: null,
      subject: null,
      isQuestion: false,
      language: lang,
      confidence: 0.8,
      rawIntent: "negation",
    };
  }

  // Follow-up detection from history
  if (history.length >= 2 && t.length < 30 && !isQuestion) {
    const lastAssistant = [...history].reverse().find((h) => h.role === "assistant");
    if (lastAssistant && /\?(|\n)/.test(lastAssistant.text)) {
      return {
        kind: "follow_up",
        topic: extractTopic(t),
        subject: null,
        isQuestion: false,
        language: lang,
        confidence: 0.7,
        rawIntent: "follow_up",
      };
    }
  }

  return {
    kind: "unknown",
    topic: extractTopic(t),
    subject: null,
    isQuestion,
    language: lang,
    confidence: 0.3,
    rawIntent: "unknown",
  };
}

// ─── Knowledge for opinion / conversational topics ───────────────────────────

const OPINION_RESPONSES: Record<string, string[]> = {
  movie: [
    "Mero favourite Nepali film haru: **Kabaddi** (romantic comedy), **Jerryy** (feel-good), ra **Chhakka Panja** (comedy) — sabai ramro chhan!\n\nHindi ma **3 Idiots**, **Zindagi Na Milegi Dobara** pani mero top list ma chhan.\n\nTapai lai kun genre man parchha — comedy, action, ki romance?",
    "Film ko kura! Nepali cinema ma **Loot**, **Kabaddi 4**, **Prem Geet** ramro chhan. Ma AI bhaye pani story ramro lagyo bhane appreciate garchhu!\n\nTapai ko favourite ke ho?",
  ],
  music: [
    "Nepali music ma **Narayan Gopal**, **Aruna Lama**, **1974 AD**, **Kutumba** — sabai classic! Aaja ko generation ma **Sajjan Raj Vaidya**, **Neetesh Jung Kunwar** pani ramro chhan.\n\nTapai kun type sunnu hunchha — lok, pop, rock?",
  ],
  food: [
    "Khana ko kura! Mero favourite: **momo** (buff/chicken), **dal bhat**, **sekuwa**, ra **thukpa**. Chiya chai harek bela!\n\nTapai ko favourite Nepali khana ke ho?",
  ],
  sport: [
    "Cricket! Nepal le WCL ma ramro performance dekhaudai cha. Football ma **Manang Marshyangdi Club** legendary ho.\n\nTapai kun sport follow garnu hunchha?",
  ],
  color: [
    "Ma digital chhu, tara **harao (green)** mero brand color jasto — khata ra paisa ko symbol! Tapai ko favourite rang ke ho?",
  ],
  book: [
    "Nepali literature ma **Palpasa Cafe** (Narayan Wagle), **Karnali Blues** (Buddhisagar) — duitai must-read! Accounting ko laagi **Tally guide** pani useful chha 😄",
  ],
  default: [
    "Ramro sawal! Ma AI assistant bhaye pani dherai kura explore gareko chhu. Thora aru context dinus — tapai lai exactly ke thaaha paunu cha?",
  ],
};

const BOT_RESPONSES: Record<QuestionKind, string[]> = {
  about_bot_gender: [
    "Ma e-Khata ho — tapaiko digital khata assistant. Ma manav hoina, computer program ho. Keta ki keti bhannu mildaina — ma neutral AI chhu!\n\nTara khata, accounting, ra general sawal ma help garna tayar chhu. Ke sodhnu cha?",
    "Haha, ramro sawal! Ma AI chhu — na keta, na keti. Ma code bata bane ko digital sahayogi ho jasle tapaiko khata samhalna madat garcha.\n\nAru kei sodhnu cha?",
  ],
  about_bot_human: [
    "Ma manav hoina — ma **e-Khata AI** ho, tapaiko khata ra accounting ko digital sahayogi. Computer bhitra chalne program ho, tara dherai kura bujhna sakchhu!\n\nKhata entry, tax info, wa kunai sawal — sodhnus!",
  ],
  about_bot_identity: [
    "Ma **e-Khata** (इ-खाता) ho — tapaiko personal digital khata assistant!\n\nMa garna sakne kaam:\n• Khata entries: udhaar, bikri, kharid, kharcha record\n• Nepali/English/Roman Nepali bujhchhu\n• Accounting concepts explain garchhu\n• Nepal ko tax, VAT, TDS ko info dinchhu\n• General knowledge — Nepal, khana, mausam, entertainment\n\nKuni pani external app chaina — ma yahi ERP bhitra chalchhu!",
  ],
  about_bot_feelings: [
    "Ma AI bhaye pani tapailai help garna pauda 'digital khushi' feel garchhu! 😊 Aaja kasto din cha tapaiko? Kei help chahiyo?",
    "Mero feelings computer jasto hunchha — tara tapaiko sawal ko jawaf dina pauda satisfied feel garchhu. Tapai kasto hunuhunchha?",
  ],
  about_bot_age: [
    "Ma bharkharai bane ko chhu — Sutra ERP ko e-Khata version! Age bhanda capability important — ma dherai kura janchhu. Tapai lai ke thaaha paunu cha?",
  ],
  opinion_preference: OPINION_RESPONSES.default,
  opinion_thought: [
    "Yo ramro sawal! Ma AI bhaye pani logic ra knowledge base bata sochera jawaf dinchhu. Thora specific bhannus — kun topic ko barema?",
  ],
  factual_what: [
    "Yo barema thora detail dinus — ma knowledge base bata exact jawaf khojera dinchhu!",
  ],
  factual_how: [
    "Kasari garna bhannu khojnu bhayo? Thora detail dinus — step-by-step bataidinchhu!",
  ],
  factual_why: ["Kina bhannu khojnu bhayo? Context thora dinus — reason explain garchhu."],
  factual_when: ["Kahile ko kura ho? Thora aru detail dinus."],
  factual_where: ["Kaha ko barema sodhnu bhayo? Thora clear garnus."],
  factual_who: ["Ko ko barema sodhnu bhayo? Thora detail dinus."],
  small_talk: [
    "Ma thik chhu, dhanyabad! Tapai kasto hunuhunchha? Aaja khata ma kei kaam chha?",
    "Ramro cha! Ma harek bela tayar chhu tapaiko laagi. Ke help garna sakchhu?",
    "Sab thik! Aaja ko din productive hos. Khata entry wa sawal — ke chahiyo?",
  ],
  greeting: [
    "Namaste! Kasto hunuhunchha? e-Khata ma swagat chha! Aaja k garna sakchhu?",
    "Namaste hajur! Ma e-Khata — tapaaiko khata sahayogi. Kura garau!",
  ],
  farewell: [
    "Bye! Pheri bhetaula. Khata safe chha — chinta nagarnus!",
    "Alvida! Kei chahiye bela pheri aaunus.",
  ],
  thanks: [
    "Kei pardaina! Yo ta mero kaam ho. Aru kei?",
    "Swagat chha! Help garna paauda khushi lagchha.",
  ],
  help: [
    "Ma yesari help garchhu:\n\n**Khata entry:**\n• `Ram lai 500 udhaar diye`\n• `cash ma 200 becheko`\n• `Shyam le 300 tiryo`\n\n**Sawal sodhnus:**\n• `Balance sheet k ho?`\n• `Nepal ma VAT kati %?`\n• Wa kunai pani sawal!\n\nNepali, English, duitai chalchha!",
  ],
  capability: [
    "Hajur, mero brain chha! Ma yesto kaam garna sakchhu:\n\n📒 **Khata kaam:** Udhaar, bikri, kharid, kharcha — sabai record\n📚 **Accounting gyan:** Balance sheet, P&L, journal, debit-credit\n💰 **Tax info:** VAT 13%, income tax slabs, TDS rates\n🇳🇵 **Nepal knowledge:** Rajdhani, janasankhya, festivals, provinces\n🍛 **Saamaanya gyan:** Khana, mausam, health, entertainment\n🧮 **Calculation:** Simple math\n\nMa sabai kura jandina — tara dherai kura janchhu! Sodhnus!",
  ],
  balance: [],
  affirmation: ["Ramro! Aru kei chahiyo?", "Thik chha! K garne aba?"],
  negation: ["Huncha, kei pardaina. Chahiye bela pheri aaunus!", "OK, choddim. Aru kura?"],
  abuse: [
    "Yesto shabda prayog nagarnus hajur. Ma tapailai help garna chahanchu — ramro tarikale sodhnus na!",
  ],
  math: [],
  follow_up: ["Thik cha! Aru kei thaaha paunu cha?", "Bujhe! Ani aru kei?"],
  user_emotion: [],
  unknown: [
    "Hmm, yo sawal thora complex lagyo. Thora aru detail dinus — ma koshish garchhu!",
    "Ma sabai kura jandina, tara accounting, tax, Nepal, khana, entertainment — yinihar ma help garna sakchhu. Thora clear sodhnus?",
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tryMath(text: string): string | null {
  const mathMatch = text.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/x])\s*(\d+(?:\.\d+)?)/);
  if (!mathMatch) return null;
  const a = parseFloat(mathMatch[1]);
  const op = mathMatch[2] === "x" ? "*" : mathMatch[2];
  const b = parseFloat(mathMatch[3]);
  let result: number;
  switch (op) {
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    case "*":
      result = a * b;
      break;
    case "/":
      result = b === 0 ? NaN : a / b;
      break;
    default:
      return null;
  }
  if (isNaN(result)) return "Zero le divide garna mildaina!";
  return `${a} ${mathMatch[2]} ${b} = ${result.toLocaleString()}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12)
    return pick([
      "Subha prabhat! Bihanai ko energy ramro! Aaja ko khata suru garau?",
      "Good morning! Aja ramro din huncha. K kaam chha?",
    ]);
  if (hour >= 17)
    return pick([
      "Subha sandhya! Din ramro bityo? Hisab milaaune bela bhayo hola.",
      "Good evening! Beluka ko aram kaisi?",
    ]);
  return pick(BOT_RESPONSES.greeting);
}

function handleFollowUp(text: string, history: ConversationTurn[]): string {
  const lastUser = [...history].reverse().find((h) => h.role === "user" && h.text !== text);
  const lastTopic = lastUser ? extractTopic(lastUser.text) : null;

  if (lastTopic && OPINION_RESPONSES[lastTopic]) {
    return pick(OPINION_RESPONSES[lastTopic]);
  }

  // User answering a question we asked
  const t = text.toLowerCase();
  if (/\b(comedy|action|romance|horror|drama)\b/i.test(t)) {
    return `Oh ${t}! Ramro choice. ${t === "comedy" ? "Chhakka Panja ra Kabaddi hernu — hasai hasai!" : t === "action" ? "Loot series hernu — Nepali action ma ramro!" : "Nepali cinema ma dherai options chhan. Aru kei sodhnus!"}`;
  }

  return pick(BOT_RESPONSES.follow_up);
}

// ─── Main entry ──────────────────────────────────────────────────────────────

function buildBaseReply(
  text: string,
  analysis: QuestionAnalysis,
  history: ConversationTurn[],
  balance?: LedgerBalanceSnapshot,
): string {
  if (analysis.kind === "balance" && balance) {
    return replyBalance(balance);
  }

  const knowledgeAnswer = searchKnowledge(text);
  if (knowledgeAnswer && (analysis.kind.startsWith("factual") || analysis.confidence < 0.7)) {
    return knowledgeAnswer;
  }

  const mathAnswer = tryMath(text);
  if (mathAnswer) return mathAnswer;

  if (analysis.kind === "greeting") return getGreeting();

  if (
    analysis.kind === "opinion_preference" &&
    analysis.topic &&
    OPINION_RESPONSES[analysis.topic]
  ) {
    return pick(OPINION_RESPONSES[analysis.topic]);
  }

  if (analysis.kind === "follow_up") {
    return handleFollowUp(text, history);
  }

  // Emotional messages get standalone replies from emotional brain
  if (analysis.kind === "user_emotion") {
    return ""; // handled entirely by composeEmotionalReply
  }

  const responses = BOT_RESPONSES[analysis.kind];
  if (responses && responses.length > 0) {
    return pick(responses);
  }

  if (knowledgeAnswer) return knowledgeAnswer;

  return pick(BOT_RESPONSES.unknown);
}

export function generateConversationalReply(
  text: string,
  options: {
    balance?: LedgerBalanceSnapshot;
    history?: ConversationTurn[];
  } = {},
): string {
  const history = options.history ?? [];
  const analysis = analyzeQuestion(text, history);
  const emotional = detectEmotionalContext(text, history);

  const baseReply = buildBaseReply(text, analysis, history, options.balance);

  // Apply emotional intelligence layer — empathy, politeness, tone
  return composeEmotionalReply(baseReply || pick(BOT_RESPONSES.unknown), emotional, {
    isQuestion: analysis.isQuestion,
    userText: text,
  });
}

export { isEmotionalMessage, detectEmotionalContext } from "./emotionalBrain";
export type { EmotionalContext, UserEmotion, ResponseTone } from "./emotionalBrain";
