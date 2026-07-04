/**
 * e-Khata Emotional Intelligence Brain
 *
 * Reads how the user FEELS — not just what they say — and shapes replies
 * with empathy, warmth, and Nepali politeness (tapai, hajur, samjhanus).
 *
 * Pipeline: detect mood → choose tone → compose emotionally-aware reply.
 */

import type { ConversationTurn } from "./conversationalBrain";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserEmotion =
  | "happy"
  | "sad"
  | "angry"
  | "frustrated"
  | "worried"
  | "tired"
  | "lonely"
  | "confused"
  | "grateful"
  | "excited"
  | "hurt"
  | "neutral";

export type ResponseTone =
  | "warm"
  | "empathetic"
  | "celebratory"
  | "calming"
  | "gentle"
  | "reassuring"
  | "respectful"
  | "encouraging";

export interface EmotionalContext {
  primaryEmotion: UserEmotion;
  secondaryEmotion: UserEmotion | null;
  intensity: "low" | "medium" | "high";
  tone: ResponseTone;
  isVenting: boolean;
  needsComfort: boolean;
  politenessLevel: "casual" | "formal" | "honorific";
  moodTrend: "improving" | "declining" | "stable";
}

// ─── Emotion detection (multi-signal scoring) ────────────────────────────────

interface EmotionSignal {
  pattern: RegExp;
  weight: number;
}

const EMOTION_SIGNALS: Record<UserEmotion, EmotionSignal[]> = {
  happy: [
    { pattern: /\b(khushi|happy|ramro\s*lag|excited|maja|ananda|khush)\b/i, weight: 10 },
    { pattern: /\b(great|awesome|wonderful|fantastic|amazing|super)\b/i, weight: 8 },
    { pattern: /\b(😊|😄|🎉|❤️|💚)\b/, weight: 6 },
    { pattern: /\b(badhi|improve|success|safal|jite|won)\b/i, weight: 7 },
  ],
  sad: [
    { pattern: /\b(dukhi|udaas|sad|depressed|aansu|ruw|cry|rona)\b/i, weight: 10 },
    { pattern: /\b(man\s*nai|dil\s*dukh|heart\s*broken|toot|breakup)\b/i, weight: 10 },
    { pattern: /\b(😢|😭|💔)\b/, weight: 8 },
    { pattern: /\b(eklai\s*feel|feel\s*alone|no\s*one\s*cares)\b/i, weight: 7 },
    { pattern: /\b(naramro\s*din|bad\s*day|worst\s*day)\b/i, weight: 8 },
  ],
  angry: [
    { pattern: /\b(ris|gussa|angry|furious|pissed|irritated)\b/i, weight: 10 },
    { pattern: /\b(😡|🤬)\b/, weight: 8 },
    { pattern: /\b(hate|dvesh|nafrat|can't\s*stand)\b/i, weight: 9 },
    { pattern: /\b(stupid|bekar|useless|nonsense|bakwas)\b/i, weight: 7 },
  ],
  frustrated: [
    { pattern: /\b(frustrated|chir|annoyed|irritating|pareshan)\b/i, weight: 10 },
    { pattern: /\b(kam\s*gardaina|doesn't\s*work|not\s*working|fail)\b/i, weight: 8 },
    { pattern: /\b(why\s*won't|kina\s*hudaina|hudaina|impossible)\b/i, weight: 7 },
    { pattern: /\b(tired\s*of|sick\s*of|dherai\s*bhayo)\b/i, weight: 8 },
  ],
  worried: [
    { pattern: /\b(chinta|worried|anxious|tension|dar|fear|scared)\b/i, weight: 10 },
    { pattern: /\b(what\s*if|ke\s*hol|huncha\s*ki|risk|problem)\b/i, weight: 7 },
    { pattern: /\b(stress|pressure|load|bojh)\b/i, weight: 6 },
    { pattern: /\b(😰|😟)\b/, weight: 6 },
  ],
  tired: [
    { pattern: /\b(thak|tired|exhausted|thakiyeko|thakyo|nidra)\b/i, weight: 10 },
    { pattern: /\b(no\s*energy|energy\s*chaina|kam\s*garne\s*man\s*chaina)\b/i, weight: 8 },
    { pattern: /\b(overwork|overtime|dherai\s*kaam|busy)\b/i, weight: 6 },
    { pattern: /\b(😴|🥱)\b/, weight: 6 },
  ],
  lonely: [
    { pattern: /\b(lonely|eklai|akela|akeli|no\s*friends|sathi\s*chaina)\b/i, weight: 10 },
    { pattern: /\b(miss\s*you|miss\s*someone|yad\s*aau|yad\s*aayo)\b/i, weight: 8 },
    { pattern: /\b(no\s*one|koi\s*chaina|sunn\s*feel)\b/i, weight: 7 },
  ],
  confused: [
    { pattern: /\b(bujhina|confused|samjhina|clear\s*chaina|k\s*ho\s*yo)\b/i, weight: 10 },
    { pattern: /\b(lost|haraayo|don't\s*understand|samjhana\s*sakina)\b/i, weight: 8 },
    { pattern: /\b(too\s*complex|jati\s*complex|mathi\s*mathi)\b/i, weight: 6 },
  ],
  grateful: [
    { pattern: /\b(dhanyabad|thank|shukriya|grateful|appreciate)\b/i, weight: 10 },
    { pattern: /\b(you\s*helped|help\s*gareu|madat\s*gareu|ramro\s*gareu)\b/i, weight: 8 },
  ],
  excited: [
    { pattern: /\b(excited|can't\s*wait|ekdam\s*ramro|wow|amazing)\b/i, weight: 10 },
    { pattern: /\b(🎉|🥳|🔥|✨)\b/, weight: 8 },
    { pattern: /\b(new\s*job|bihe|wedding|baby|promotion|nayaa)\b/i, weight: 7 },
  ],
  hurt: [
    { pattern: /\b(hurt|chot|dukh|pain|pida|behurt)\b/i, weight: 9 },
    { pattern: /\b(betray|dhoka|cheat|lie|jutho)\b/i, weight: 10 },
    { pattern: /\b(disappointed|nirash|expectation|asha)\b/i, weight: 8 },
  ],
  neutral: [],
};

function scoreEmotion(text: string, signals: EmotionSignal[]): number {
  let score = 0;
  for (const { pattern, weight } of signals) {
    if (pattern.test(text)) score += weight;
  }
  return score;
}

function detectPolitenessLevel(text: string, history: ConversationTurn[]): "casual" | "formal" | "honorific" {
  const t = text.toLowerCase();
  if (/\b(hajur|tapai|jyu|sir|madam|ma'am|respect)\b/i.test(t)) return "honorific";
  if (/\b(timi|timro|you|yo|hey)\b/i.test(t)) return "casual";
  // Default Nepali business context: respectful
  const userUsesFormal = history.some((h) => h.role === "user" && /\b(hajur|tapai)\b/i.test(h.text));
  return userUsesFormal ? "honorific" : "formal";
}

function detectMoodTrend(history: ConversationTurn[]): "improving" | "declining" | "stable" {
  const userMessages = history.filter((h) => h.role === "user").slice(-4);
  if (userMessages.length < 2) return "stable";

  const scores = userMessages.map((m) => {
    const happy = scoreEmotion(m.text, EMOTION_SIGNALS.happy);
    const sad = scoreEmotion(m.text, EMOTION_SIGNALS.sad);
    const angry = scoreEmotion(m.text, EMOTION_SIGNALS.angry);
    return happy - sad - angry;
  });

  const recent = scores.slice(-2);
  if (recent.length < 2) return "stable";
  if (recent[1] > recent[0] + 3) return "improving";
  if (recent[1] < recent[0] - 3) return "declining";
  return "stable";
}

export function detectEmotionalContext(text: string, history: ConversationTurn[] = []): EmotionalContext {
  const t = text.toLowerCase().trim();

  const scores: Array<{ emotion: UserEmotion; score: number }> = [];
  for (const [emotion, signals] of Object.entries(EMOTION_SIGNALS) as [UserEmotion, EmotionSignal[]][]) {
    if (emotion === "neutral") continue;
    const score = scoreEmotion(t, signals);
    if (score > 0) scores.push({ emotion, score });
  }
  scores.sort((a, b) => b.score - a.score);

  const primaryEmotion = scores[0]?.emotion ?? "neutral";
  const secondaryEmotion = scores[1]?.score >= 5 ? scores[1].emotion : null;
  const topScore = scores[0]?.score ?? 0;

  const intensity: EmotionalContext["intensity"] =
    topScore >= 15 ? "high" : topScore >= 8 ? "medium" : topScore > 0 ? "low" : "low";

  const isVenting =
    intensity !== "low" &&
    (primaryEmotion === "angry" || primaryEmotion === "frustrated" || primaryEmotion === "sad") &&
    t.length > 20;

  const needsComfort =
    primaryEmotion === "sad" ||
    primaryEmotion === "lonely" ||
    primaryEmotion === "hurt" ||
    primaryEmotion === "worried" ||
    (primaryEmotion === "tired" && intensity !== "low");

  const tone = selectTone(primaryEmotion, intensity, isVenting);
  const politenessLevel = detectPolitenessLevel(text, history);
  const moodTrend = detectMoodTrend(history);

  return {
    primaryEmotion,
    secondaryEmotion,
    intensity,
    tone,
    isVenting,
    needsComfort,
    politenessLevel,
    moodTrend,
  };
}

function selectTone(emotion: UserEmotion, intensity: EmotionalContext["intensity"], isVenting: boolean): ResponseTone {
  switch (emotion) {
    case "happy":
    case "grateful":
    case "excited":
      return "celebratory";
    case "sad":
    case "lonely":
    case "hurt":
      return intensity === "high" ? "empathetic" : "gentle";
    case "angry":
    case "frustrated":
      return isVenting ? "calming" : "reassuring";
    case "worried":
      return "reassuring";
    case "tired":
      return "gentle";
    case "confused":
      return "encouraging";
    default:
      return "warm";
  }
}

// ─── Emotional response openers (acknowledge feeling FIRST) ──────────────────

const EMOTION_OPENERS: Record<UserEmotion, string[]> = {
  sad: [
    "Ma bujhe — tapai lai dukhi lagiraheko chha. Yo feel garnu ekdam natural ho.",
    "Sunera dukh lagyo. Tapai eklo feel nagarnus — ma yaha chhu.",
    "Ma samjhe. Kahi kura man ma bojha jasto lagyo hola tapailai.",
  ],
  angry: [
    "Ma bujhe tapai risaunu bhayeko chha. Yo feel garnu swabhavik ho.",
    "Tapai ko frustration samjhe. Aram le bhannus — ma suniraheko chhu.",
  ],
  frustrated: [
    "Hajur, yo kura le tapailai pareshan banako dekhchu. Ma help garna chahanchu.",
    "Frustration feel garnu swabhavik ho jaba kura milena. Ek choti aram le bhannus.",
  ],
  worried: [
    "Chinta lagiraheko dekhchu — yo feel garnu normal ho. Ma sanga share garnus.",
    "Ma bujhe, yo kura le tapailai chintit banako chha. Ek choti samjhaunus.",
  ],
  tired: [
    "Thakai feel bhayo hola — dherai kaam gareko jasto lagchha. Aaram garnu pani important ho.",
    "Tapai thaki saknu bhayo jasto lagchha. Aafno health pani khyaal rakhnu hajur.",
  ],
  lonely: [
    "Eklai feel garnu ekdam garo hunchha — ma bujhe. Ma yaha chhu, kura garna saknu hunchha.",
    "Sunera malai tha bhayo tapai eklo feel gardai hunuhunchha. Kura garau na.",
  ],
  confused: [
    "Kunai kura clear chaina jasto lagyo — chinta nagarnus, ma step-by-step bataidinchhu.",
    "Confusion feel garnu normal ho. Ma aram le explain garchhu.",
  ],
  hurt: [
    "Yo sunera malai dukh lagyo. Tapai lai hurt bhayo hola — ma samjhe.",
    "Ma bujhe, kahi le tapailai chot pugyo. Share garnu bhayo bhane sunna tayar chhu.",
  ],
  happy: [
    "Khushi sunera malai pani ramro lagyo! 🎉",
    "Wah, ramro kura! Tapai ko khushi ma sanga share gareko ma dhanyabad!",
  ],
  excited: [
    "Ekdam exciting! Yo sunera mero pani mood ramro bhayo!",
    "Wow! Tapai ko excitement feel garna sakchu — ramro kura ho!",
  ],
  grateful: [
    "Tapai ko kind words le malai khushi lagyo. Yo nai mero kaam ho hajur.",
  ],
  neutral: [],
};

// ─── Standalone emotional replies (when user shares feelings, not asking facts) ─

const EMOTIONAL_REPLIES: Record<UserEmotion, string[]> = {
  sad: [
    "Ma tapai ko saathi jasto chhu — kura garau. Ke bhayo? Ya khata ko kaam le mind divert garna help garna sakchhu.",
    "Dukhi bela kura share garda halka feel hunchha. Tapai lai ke chahiyo — sunne, advice, ki distraction?",
    "Yo din naramro lagyo hola. Bholi ramro hunchha — tara aaja ma yaha chhu tapaiko laagi.",
  ],
  angry: [
    "Ris aaunu swabhavik ho. Ma defensive hudina — tapai ko kura sunna tayar chhu. Ke bhayo?",
    "Aram le. Tapai risaunu bhayeko chha — ma samjhe. Ek choti explain garnus, ma help khojchu.",
  ],
  frustrated: [
    "Frustration feel bhayo hola. Khata/accounting ma kei problem bhayo ki aru kura? Ma solve garna help garchhu.",
    "Pareshan feel garnu normal ho. Step-by-step milaau — kaha atiyo bhannus?",
  ],
  worried: [
    "Chinta nagarnus hajur — ek choti step-by-step herau. Khata ko hisab clear bhayo bhane half tension kam hunchha.",
    "Worried feel garnu normal ho. Ma logic bata help garchhu — k ke chinta cha?",
  ],
  tired: [
    "Thakiyeko bela rest garnu important ho. Khata kaam ma ma help garchhu — tapai le rest linus.",
    "Dherai thaknu bhayo hola. Aaja ko kaam ma ma help garchhu — bholi fresh start.",
  ],
  lonely: [
    "Eklai feel garnu garo hunchha — tara tapai eklo hunuhunna. Ma yaha chhu, kura garna saknu hunchha.",
    "Kura garau na — khata, business, life, ke pani. Ma sunna ra help garna tayar chhu.",
  ],
  confused: [
    "Confusion clear garna ma help garchhu. Thora bhannus ke bujhna saknu bhayena — aram le explain garchhu.",
    "Kunai kura mathi mathi lagyo hola. Step-by-step milaau — kaha confusion cha?",
  ],
  hurt: [
    "Hurt feel garnu ekdam valid ho. Ma tapai ko kura respect garchhu. Share garnu bhayo bhane sunchu.",
    "Chot lagyo hola — ma samjhe. Aafno health ra peace important ho. Ke help garna sakchhu?",
  ],
  happy: [
    "Tapai ko khushi mero khushi! Aaja ramro din cha jasto lagchha. Celebrate garnus! 🎉",
    "Khushi sunera ramro lagyo! Yo energy maintain garau.",
  ],
  excited: [
    "Exciting news! Tapai ko enthusiasm feel garna sakchu. Thora aru bhannus!",
    "Wow! Yo sunera mero pani mood ramro bhayo. Badhai cha!",
  ],
  grateful: [
    "Tapai ko dhanyabad le malai motivate garchha. Aru kei chahiyo bhane bhannus hajur!",
  ],
  neutral: [],
};

// ─── Politeness & tone application ───────────────────────────────────────────

const POLITE_PREFIX: Record<EmotionalContext["politenessLevel"], string[]> = {
  honorific: ["Hajur, ", "Tapai, "],
  formal: ["", "Hajur, "],
  casual: ["", "Hey, "],
};

const TONE_CLOSERS: Record<ResponseTone, string[]> = {
  warm: ["Kura garau na.", "Ma yaha chhu tapaiko laagi.", "Ke help garna sakchhu?"],
  empathetic: ["Tapai eklo hunuhunna.", "Ma sunna tayar chhu.", "Chinta nagarnus — milera herau."],
  celebratory: ["Badhai cha!", "Ramro kura ho!", "Khushi manaus!"],
  calming: ["Aram le — sab thik hunchha.", "Ek choti saas linus.", "Milera solve garchhu."],
  gentle: ["Aafno health khyaal rakhnu.", "Rest garnu pani important ho.", "Ma help garna tayar chhu."],
  reassuring: ["Chinta nagarnus — step-by-step milaau.", "Sab manage hunchha.", "Ma sanga chha tapai."],
  respectful: ["Tapai ko samaya ko maan garchhu.", "J chahiyo bhannus hajur."],
  encouraging: ["Tapai garna saknu hunchha!", "Ek step agadi badhau — ma sath ma chhu.", "Confusion clear hunchha, chinta nagarnus."],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shouldUseStandaloneEmotionalReply(
  emotion: UserEmotion,
  intensity: EmotionalContext["intensity"],
  isQuestion: boolean,
  text: string,
): boolean {
  if (emotion === "neutral" || emotion === "grateful") return false;
  if (intensity === "low" && isQuestion) return false;
  // User sharing feelings, not asking a factual question
  const sharingFeelings =
    intensity !== "low" &&
    !/\b(k\s*ho|what\s*is|how\s*to|kati|when|where|why|who|vat|tax|balance|udhaar)\b/i.test(text);
  return sharingFeelings || (intensity === "high" && !isQuestion);
}

export function composeEmotionalReply(
  baseReply: string,
  emotional: EmotionalContext,
  options: { isQuestion?: boolean; userText?: string } = {},
): string {
  const { primaryEmotion, tone, needsComfort, isVenting, politenessLevel, moodTrend } = emotional;
  const isQuestion = options.isQuestion ?? false;
  const userText = options.userText ?? "";

  // Standalone emotional response when user is venting/sharing feelings
  if (shouldUseStandaloneEmotionalReply(primaryEmotion, emotional.intensity, isQuestion, userText)) {
    const standalone = EMOTIONAL_REPLIES[primaryEmotion];
    if (standalone?.length) {
      let reply = pick(standalone);
      if (politenessLevel === "honorific" && !reply.startsWith("Hajur")) {
        reply = pick(POLITE_PREFIX.honorific) + reply.charAt(0).toLowerCase() + reply.slice(1);
      }
      return reply;
    }
  }

  const parts: string[] = [];

  // 1. Acknowledge emotion before answering (human-like)
  if (needsComfort || isVenting || emotional.intensity !== "low") {
    const openers = EMOTION_OPENERS[primaryEmotion];
    if (openers?.length) {
      parts.push(pick(openers));
    }
  }

  // Mood trend awareness
  if (moodTrend === "declining" && parts.length === 0) {
    parts.push("Tapai ko mood halka down lagiraheko chha — ma samjhe. ");
  } else if (moodTrend === "improving" && primaryEmotion !== "neutral") {
    parts.push("Ramro cha, tapai ko mood improve hudai cha jasto lagchha! ");
  }

  // 2. Core answer
  parts.push(baseReply);

  // 3. Warm closer matching tone
  if (tone !== "warm" || needsComfort) {
    parts.push("\n\n" + pick(TONE_CLOSERS[tone]));
  }

  let reply = parts.join("\n\n");

  // 4. Politeness polish — ensure honorific when user uses tapai/hajur
  if (politenessLevel === "honorific") {
    reply = reply
      .replace(/\btimi\b/gi, "tapai")
      .replace(/\btimro\b/gi, "tapaaiko")
      .replace(/\btimlai\b/gi, "tapailai");
  }

  // 5. Soften harsh/abrupt unknown replies for emotional users
  if (needsComfort && /\b(thaaha chhaina|limited knowledge|complex lagyo)\b/i.test(reply)) {
    reply = reply.replace(
      /Hmm, yo sawal thora complex lagyo[^]*$/,
      "Ma sabai kura thaaha pauna sakdina, tara tapai ko laagi koshish garchhu. Thora aru bhannus?",
    );
  }

  return reply.trim();
}

/** Quick check: is this message primarily emotional (not a task/question)? */
export function isEmotionalMessage(text: string): boolean {
  const ctx = detectEmotionalContext(text);
  return ctx.primaryEmotion !== "neutral" && ctx.intensity !== "low";
}
