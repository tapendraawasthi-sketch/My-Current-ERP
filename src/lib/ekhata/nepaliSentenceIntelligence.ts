/**
 * Nepali Sentence Intelligence — meaning, context, and corrupted-text repair.
 *
 * Handles:
 * - OCR / encoding corruption in Devanagari (replacement chars, missing matras)
 * - Clause-level structure (agent/recipient/source via postpositions)
 * - Sentence meaning synthesis from context — not literal token match
 *
 * Self-contained: no API, no downloads.
 */

/** Characters that indicate OCR/encoding corruption */
const CORRUPTION_RE =
  /[\uFFFD\uFFFE\uFFFF\u25A1\u25A0\u25AB\u25AA\u25FB\u25FC\u2610\u2611\u2612□▯▢■◻◼⬜⬛\uE000-\uF8FF]/gu;

const DEVANAGARI_RE = /[\u0900-\u097F]/;

/** Strip matras, halant, nukta — keep consonant skeleton for fuzzy match */
function consonantSkeleton(word: string): string {
  return word
    .replace(/[\u093E-\u094F\u0962\u0963]/g, "")
    .replace(/[\u094D\u0903\u0902]/g, "")
    .replace(/[^\u0900-\u097F]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Domain lexicon — legal, accounting, khata vocabulary */
const DOMAIN_LEXICON: string[] = [
  // Legal / regulatory
  "नियमवाली",
  "ऐन",
  "दफा",
  "नियम",
  "संशोधन",
  "प्रारम्भ",
  "संक्षिप्त",
  "नाम",
  "राजपत्र",
  "मिति",
  "प्रकाशित",
  "सरकारी",
  "गजेट",
  "अधिकार",
  "प्रावधान",
  "परिभाषा",
  "दण्ड",
  "जरिवाना",
  // Tax / accounting
  "आयकर",
  "कर",
  "भ्याट",
  "मूल्य",
  "अभिवृद्धि",
  "कर",
  "उद्योग",
  "पेट्रोलियम",
  "आय",
  "खर्च",
  "लाभ",
  "हानि",
  "खाता",
  "जम्मा",
  "बाँकी",
  "उधार",
  "तिर्नु",
  "बिक्री",
  "खरिद",
  "भुक्तानी",
  "प्राप्त",
  "देय",
  "सम्पत्ति",
  "दायित्व",
  "पुँजी",
  "नाफा",
  "नोक्सान",
  "तलब",
  "भाडा",
  "ब्याज",
  "ऋण",
  "नगद",
  "बैंक",
  // Common khata chat
  "राम",
  "श्याम",
  "ग्राहक",
  "आपूर्तिकर्ता",
  "बिल",
  "चलान",
  "इनभ्वाइस",
  "पान",
  "दर्ता",
  "आर्थिक",
  "वर्ष",
  "महिना",
];

/** Context templates: [regex with capture groups, replacement fn] */
const CONTEXT_REPAIRS: Array<{
  pattern: RegExp;
  repair: (match: RegExpMatchArray) => string;
}> = [
  {
    // पेट्रोलियम उद्योग (आयकर) [corrupt] , २०४१ → नियमवाली
    pattern:
      /(पेट्रोलियम\s+उद्योग\s*\(\s*आयकर\s*\))\s*[^\u0900-\u097F\u0964।,]{0,12}[\u0900-\u097F]{0,12}\s*[,，]\s*(२०\d{2})/u,
    repair: (m) => `${m[1]} नियमवाली, ${m[2]}`,
  },
  {
    // नेपाल [corrupt]पत्रमा प्रकाशित → नेपाल राजपत्रमा प्रकाशित
    pattern: /(नेपाल)\s+(?:[^\u0900-\u097F\u0964।]*[\u0900-\u097F]{0,4})?पत्र(मा\s+प्रकाशित)/u,
    repair: (m) => `${m[1]} राजपत्र${m[2]}`,
  },
  {
    // प्रकाशित [corrupt]ति : → प्रकाशित मिति :
    pattern: /(प्रकाशित)\s+(?:[^\u0900-\u097F\u0964।]*[\u0900-\u097F]{0,4})?ति\s*[:：]/u,
    repair: (m) => `${m[1]} मिति :`,
  },
  {
    // संक्षिप्त [corrupt] र प्रारम्भ → संक्षिप्त नाम र प्रारम्भ
    pattern: /(संक्षिप्त)\s+[^\u0900-\u097F\u0964।]{0,6}[\u0900-\u097F]{0,8}\s+(र\s+प्रारम्भ)/u,
    repair: (m) => `${m[1]} नाम ${m[2]}`,
  },
  {
    // आयकर ऐन, २०३१ को दफा [num] → preserve
    pattern: /(आयकर\s+ऐन[^।]*दफा\s+\d+)/u,
    repair: (m) => m[1],
  },
  {
    // [corrupt] सरकारी → सरकारी (leading corruption before सरकारी)
    pattern: /[^\u0900-\u097F\u0964।]{1,6}(सरकारी)/u,
    repair: (m) => m[1],
  },
];

export type PostpositionRole = "agent" | "recipient" | "source" | "location" | "possessive" | "purpose";

export interface ClauseAnalysis {
  text: string;
  agent: string | null;
  recipient: string | null;
  source: string | null;
  verb: string | null;
  object: string | null;
  postpositionRoles: Array<{ phrase: string; role: PostpositionRole }>;
  isQuestion: boolean;
  isNegated: boolean;
  domainHint: "legal" | "accounting" | "transaction" | "general";
}

export interface SentenceMeaning {
  originalText: string;
  repairedText: string;
  corruptionScore: number;
  clauses: ClauseAnalysis[];
  primaryIntent: string | null;
  summaryNepali: string;
  summaryEnglish: string;
}

function corruptionScore(text: string): number {
  const matches = text.match(CORRUPTION_RE);
  if (!matches) return 0;
  return Math.min(1, matches.length / Math.max(text.length / 20, 1));
}

function fuzzyLexiconRepair(token: string): string {
  const clean = token.replace(CORRUPTION_RE, "").trim();
  if (!clean || !DEVANAGARI_RE.test(clean)) return token;

  const skel = consonantSkeleton(clean);
  if (!skel || skel.length < 2) return token;

  let best = clean;
  let bestDist = Infinity;

  for (const lex of DOMAIN_LEXICON) {
    const lexSkel = consonantSkeleton(lex);
    if (!lexSkel) continue;
    const dist = levenshtein(skel, lexSkel);
    const threshold = Math.max(2, Math.floor(lexSkel.length * 0.45));
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = lex;
    }
  }

  return bestDist < Infinity ? best : token;
}

/** Repair corrupted Devanagari using context templates + lexicon fuzzy match */
export function repairCorruptedDevanagari(text: string): string {
  if (!text?.trim()) return "";

  let out = text.normalize("NFKC");

  // Remove corruption placeholder chars
  out = out.replace(CORRUPTION_RE, "");

  // Apply context-aware template repairs (legal/regulatory patterns)
  for (const { pattern, repair } of CONTEXT_REPAIRS) {
    out = out.replace(pattern, (...args) => repair(args as unknown as RegExpMatchArray));
  }

  // Word-level fuzzy repair for remaining Devanagari tokens
  const parts = out.split(/(\s+|[।.،,;:!?]+)/);
  out = parts
    .map((part) => {
      if (!DEVANAGARI_RE.test(part) || part.trim().length < 3) return part;
      // Skip dates like २०४१।१२।९
      if (/^[२०-९।.\-/]+$/u.test(part.trim())) return part;
      return fuzzyLexiconRepair(part);
    })
    .join("");

  return out.replace(/\s+/g, " ").trim();
}

const QUESTION_RE =
  /\b(k\s*ho|ke\s*ho|kasari|kina|kati|kaha|kun|what|how|why|when|where|who|\?|के\s*हो|कति|कसरी|किन|कहाँ)\b/i;
const NEGATION_RE =
  /\b(xaina|chaina|chhaina|bhayena|vayena|hudaina|hoina|gardina|not|never|no)\b/i;

const LEGAL_MARKERS =
  /\b(नियमवाली|ऐन|दफा|राजपत्र|संशोधन|प्रावधान|गजेट|law|act|section|regulation|rule)\b/i;
const ACCOUNTING_MARKERS =
  /\b(आयकर|भ्याट|कर|खाता|जम्मा|उधार|बिक्री|खरिद|तलब|भाडा|ब्याज|ऋण|debit|credit|vat|tds|salary|expense|sale|purchase|payment)\b/i;
const TRANSACTION_MARKERS =
  /\b(\d+|saya|hajar|lakh|tiryo|kinyo|becheko|diye|aayo|kharcha|udhaar|nagad|cash|sold|bought|paid|received)\b/i;

function detectDomain(clause: string): ClauseAnalysis["domainHint"] {
  if (LEGAL_MARKERS.test(clause)) return "legal";
  if (TRANSACTION_MARKERS.test(clause)) return "transaction";
  if (ACCOUNTING_MARKERS.test(clause)) return "accounting";
  return "general";
}

function extractPostpositionRoles(clause: string): ClauseAnalysis["postpositionRoles"] {
  const roles: ClauseAnalysis["postpositionRoles"] = [];
  const soft = clause.replace(/[^\w\s\u0900-\u097F.]/g, " ").replace(/\s+/g, " ").trim();

  const patterns: Array<[RegExp, PostpositionRole]> = [
    [/([^\s]+(?:\s+[^\s]+)?)\s+(?:le|ले)\b/gi, "agent"],
    [/([^\s]+(?:\s+[^\s]+)?)\s+(?:lai|लाई)\b/gi, "recipient"],
    [/([^\s]+(?:\s+[^\s]+)?)\s+(?:bata|बाट)\b/gi, "source"],
    [/([^\s]+(?:\s+[^\s]+)?)\s+(?:ma|मा)\b/gi, "location"],
    [/([^\s]+(?:\s+[^\s]+)?)\s+(?:ko|को)\b/gi, "possessive"],
    [/([^\s]+(?:\s+[^\s]+)?)\s+(?:ko\s+lagi|को\s+लागि)\b/gi, "purpose"],
  ];

  for (const [re, role] of patterns) {
    for (const m of soft.matchAll(re)) {
      const phrase = (m[1] ?? "").trim();
      if (phrase && phrase.length >= 2) roles.push({ phrase, role });
    }
  }

  return roles;
}

function extractVerb(clause: string): string | null {
  const verbs =
    /\b(tiryo|tireko|kinyo|kinye|kineko|becheko|beche|bikyo|diye|diyo|aayo|aayeko|kharcha|gareko|garyo|प्रकाशित|संशोधन|प्रारम्भ|sold|bought|paid|received|expense)\b/i;
  const m = clause.match(verbs);
  return m ? m[1].toLowerCase() : null;
}

/** Split text into clauses on Nepali/English discourse boundaries */
export function segmentClauses(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const raw = normalized.split(/(?<=[।.;])\s+|(?:\s+)(?:ra|र|tara|तर|bhane|भने|ki|कि|so|therefore|ani|अनि)\s+/i);
  return raw.map((c) => c.trim()).filter((c) => c.length >= 3);
}

/** Analyze one clause for grammatical roles and domain */
export function analyzeClause(clause: string): ClauseAnalysis {
  const postpositionRoles = extractPostpositionRoles(clause);
  let agent: string | null = null;
  let recipient: string | null = null;
  let source: string | null = null;

  for (const { phrase, role } of postpositionRoles) {
    if (role === "agent" && !agent) agent = phrase;
    if (role === "recipient" && !recipient) recipient = phrase;
    if (role === "source" && !source) source = phrase;
  }

  // maile/timile/hamile
  if (/\bmaile\b/i.test(clause)) agent = "Self";
  if (/\btimile\b/i.test(clause)) agent = "Timi";
  if (/\bhamile\b/i.test(clause)) agent = "Hami";

  const verb = extractVerb(clause);

  // Object: noun before verb or after "ko"
  let object: string | null = null;
  const objMatch = clause.match(
    /\b([a-zA-Z\u0900-\u097F]{2,25})\s+(?:kinyo|kinye|kineko|becheko|beche|bikyo|tiryo|diye)\b/i,
  );
  if (objMatch) object = objMatch[1];

  return {
    text: clause,
    agent,
    recipient,
    source,
    verb,
    object,
    postpositionRoles,
    isQuestion: QUESTION_RE.test(clause),
    isNegated: NEGATION_RE.test(clause),
    domainHint: detectDomain(clause),
  };
}

function buildSummary(clauses: ClauseAnalysis[], repaired: string): { ne: string; en: string } {
  if (!clauses.length) {
    return { ne: repaired.slice(0, 120), en: repaired.slice(0, 120) };
  }

  const main = clauses[0];
  const parts: string[] = [];
  const enParts: string[] = [];

  if (main.domainHint === "legal") {
    parts.push("कानूनी/नियामक पाठ");
    enParts.push("Legal/regulatory text");
  } else if (main.domainHint === "transaction") {
    parts.push("लेनदेन सम्बन्धी वाक्य");
    enParts.push("Transaction-related sentence");
  } else if (main.domainHint === "accounting") {
    parts.push("लेखा/कर सम्बन्धी वाक्य");
    enParts.push("Accounting/tax-related sentence");
  }

  if (main.agent) {
    parts.push(`कर्ता: ${main.agent}`);
    enParts.push(`Agent: ${main.agent}`);
  }
  if (main.recipient) {
    parts.push(`प्राप्तकर्ता: ${main.recipient}`);
    enParts.push(`Recipient: ${main.recipient}`);
  }
  if (main.source) {
    parts.push(`स्रोत: ${main.source}`);
    enParts.push(`Source: ${main.source}`);
  }
  if (main.verb) {
    parts.push(`क्रिया: ${main.verb}`);
    enParts.push(`Verb: ${main.verb}`);
  }
  if (main.isQuestion) {
    parts.push("प्रश्न");
    enParts.push("Question");
  }
  if (main.isNegated) {
    parts.push("नकारात्मक");
    enParts.push("Negated");
  }

  return {
    ne: parts.join(" · ") || repaired.slice(0, 100),
    en: enParts.join(" · ") || repaired.slice(0, 100),
  };
}

function inferPrimaryIntent(clauses: ClauseAnalysis[]): string | null {
  for (const c of clauses) {
    if (c.isQuestion) return "question";
    if (c.domainHint === "legal") return "legal_reference";
    if (c.isNegated) return "negation";
    if (c.recipient && /\b(diye|diyo|becheko|udhaar)\b/i.test(c.text)) return "credit_sale";
    if (c.agent && /\b(tiryo|tireko|aayo)\b/i.test(c.text)) return "payment_received";
    if (c.recipient && /\b(tiryo|tireko)\b/i.test(c.text)) return "payment_made";
    if (c.source && /\b(kineko|kharid|kin)\b/i.test(c.text)) return "purchase";
    if (/\b(becheko|bikri|sold)\b/i.test(c.text)) return "sale";
    if (/\b(kharcha|expense)\b/i.test(c.text)) return "expense";
  }
  return null;
}

/** Full sentence meaning analysis with optional corruption repair */
export function analyzeSentenceMeaning(rawText: string): SentenceMeaning {
  const originalText = (rawText || "").trim();
  const hasDevanagari = DEVANAGARI_RE.test(originalText);
  const hasCorruption = CORRUPTION_RE.test(originalText);

  const repairedText =
    hasDevanagari && (hasCorruption || corruptionScore(originalText) > 0)
      ? repairCorruptedDevanagari(originalText)
      : originalText;

  const workText = repairedText || originalText;
  const clauses = segmentClauses(workText).map(analyzeClause);
  const { ne, en } = buildSummary(clauses, workText);

  return {
    originalText,
    repairedText: workText,
    corruptionScore: corruptionScore(originalText),
    clauses,
    primaryIntent: inferPrimaryIntent(clauses),
    summaryNepali: ne,
    summaryEnglish: en,
  };
}

/** Compact context block for LLM / grammar brain — sentence-level meaning */
export function synthesizeSentenceContext(message: string, maxChars = 900): string {
  const analysis = analyzeSentenceMeaning(message);
  if (!analysis.clauses.length && analysis.corruptionScore === 0) return "";

  const lines = [
    "[NEPALI SENTENCE CONTEXT]",
    "Interpret meaning from clause structure and postpositions — not corrupted glyphs.",
  ];

  if (analysis.corruptionScore > 0) {
    lines.push(`OCR repair applied (corruption score: ${analysis.corruptionScore.toFixed(2)})`);
    if (analysis.repairedText !== analysis.originalText) {
      lines.push(`Repaired: ${analysis.repairedText.slice(0, 200)}`);
    }
  }

  if (analysis.primaryIntent) {
    lines.push(`Primary intent signal: ${analysis.primaryIntent}`);
  }

  for (const clause of analysis.clauses.slice(0, 3)) {
    const hints: string[] = [];
    if (clause.agent) hints.push(`agent(le)=${clause.agent}`);
    if (clause.recipient) hints.push(`recipient(lai)=${clause.recipient}`);
    if (clause.source) hints.push(`source(bata)=${clause.source}`);
    if (clause.verb) hints.push(`verb=${clause.verb}`);
    if (clause.domainHint !== "general") hints.push(`domain=${clause.domainHint}`);
    if (hints.length) {
      lines.push(`Clause: ${clause.text.slice(0, 80)} → ${hints.join(", ")}`);
    }
  }

  lines.push(`Meaning: ${analysis.summaryEnglish}`);

  const out = lines.join("\n").trim();
  return out.length > maxChars ? `${out.slice(0, maxChars - 3)}...` : out;
}
