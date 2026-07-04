/**
 * Conceptual Framework Brain — CA-level semantic understanding of IFRS/NAS
 * Conceptual Framework for Financial Reporting (2018).
 *
 * Not text matching: uses bilingual concept graph, query intent classification,
 * token expansion (Nepali local words → IFRS concepts), and weighted paragraph
 * retrieval to understand what the user MEANS, even in Roman Nepali or mixed input.
 */

import corpus from "../../../data/ekhata/conceptual-framework-knowledge.json";
import { detectUserLanguage, type UserLanguage } from "./accountingLanguageBrain";
import { normalizeNepaliText } from "./normalizeNepali";

export type FrameworkQuestionIntent =
  | "definition"
  | "recognition"
  | "measurement"
  | "qualitative"
  | "comparison"
  | "chapter_overview"
  | "paragraph_lookup"
  | "scenario"
  | "general";

export interface FrameworkBrainResult {
  kind: "answer" | "none";
  reply: string;
  confidence: number;
  language: UserLanguage;
  intent: FrameworkQuestionIntent;
  concepts: string[];
  paragraphs: string[];
}

interface ConceptEntry {
  id: string;
  en: string[];
  ne: string[];
  chapter: number;
  paragraphs: string[];
}

interface ParagraphEntry {
  id: string;
  chapter: number;
  section: string;
  text: string;
  summary?: string;
  topics: string[];
}

interface CorpusShape {
  concepts: ConceptEntry[];
  paragraphs: ParagraphEntry[];
  metadata: {
    chapters: Array<{ number: number; title: string }>;
  };
}

const KB = corpus as CorpusShape;

const CHAPTER_TITLES = Object.fromEntries(
  KB.metadata.chapters.map((c) => [c.number, c.title]),
);

const PARA_BY_ID = new Map(KB.paragraphs.map((p) => [p.id, p]));

/** Expanded Nepali/local → IFRS concept bridge (beyond corpus aliases) */
const NEPALI_CONCEPT_BRIDGE: Record<string, string[]> = {
  sampatti: ["asset", "economic resource", "right"],
  dayitwo: ["liability", "obligation", "present obligation"],
  rin: ["liability", "obligation"],
  puni: ["equity", "residual interest"],
  aamdani: ["income", "revenue"],
  kharcha: ["expense", "expenses"],
  manyata: ["recognition", "recognise"],
  swikar: ["recognition", "recognise"],
  mulyankan: ["measurement", "measure"],
  nyaya: ["fair value", "fair"],
  biswasilo: ["faithful representation", "faithful"],
  sambandhit: ["relevance", "relevant"],
  tulan: ["comparability", "comparable"],
  mahatwo: ["materiality", "material"],
  chalirakhne: ["going concern"],
  adhikar: ["right", "contractual right"],
  niyantran: ["control", "controlled"],
  faida: ["economic benefits", "benefits"],
  ghatna: ["past events", "past event"],
  transfer: ["transfer", "derecognition"],
  prapti: ["accrual", "accrual accounting"],
  nagad: ["cash flows", "cash basis"],
  hisab: ["financial reporting", "financial statements"],
  lekha: ["financial statements", "financial reporting"],
  patra: ["financial statements", "presentation"],
  paribhasha: ["definition", "define"],
  farak: ["comparison", "difference"],
  antar: ["comparison", "difference"],
  udeshya: ["objective", "purpose"],
  lakshya: ["objective", "purpose"],
  tatwo: ["substance", "substance over form"],
  andaaja: ["estimates", "judgements", "measurement uncertainty"],
  executory: ["executory contract"],
  consolidated: ["consolidated", "reporting entity"],
  sanghik: ["consolidated"],
};

const INTENT_PATTERNS: Array<{ intent: FrameworkQuestionIntent; patterns: RegExp[]; weight: number }> = [
  {
    intent: "definition",
    patterns: [
      /\b(what\s+is|what\s+are|define|definition|meaning|explain|k\s+ho|k\s+hunchha|ko\s+paribhasha|ko\s+matlab|ko\s+arth|bujha|bujhnus|paribhasha)\b/i,
      /\b(asset|liability|equity|income|expense|recognition|measurement|relevance|faithful)\s+(k\s+ho|ko\s+matlab|ko\s+paribhasha)\b/i,
    ],
    weight: 10,
  },
  {
    intent: "recognition",
    patterns: [
      /\b(recogni[sz]e|recognition|derecogni[sz]|derecognition|manyata|swikar|manyata\s+radda|when\s+to\s+recogni[sz]|kab\s+manyata)\b/i,
    ],
    weight: 9,
  },
  {
    intent: "measurement",
    patterns: [
      /\b(measure|measurement|mulyankan|fair\s+value|historical\s+cost|current\s+value|nyaya\s+mulya|purano\s+mulya|k\s+ma\s+measure)\b/i,
    ],
    weight: 9,
  },
  {
    intent: "qualitative",
    patterns: [
      /\b(qualitative|relevance|faithful|comparability|materiality|timeliness|verifiability|understandability|sambandhit|biswasilo|tulaniyogya|mahatwo)\b/i,
    ],
    weight: 8,
  },
  {
    intent: "comparison",
    patterns: [
      /\b(difference\s+between|vs\.?|versus|compare|farak|antar|bich\s+ko|distinguish)\b/i,
    ],
    weight: 9,
  },
  {
    intent: "chapter_overview",
    patterns: [
      /\b(chapter\s+\d|chapter\s+[a-z]+|summari[sz]e\s+chapter|overview|chapter\s+ko\s+bare|adhyaay)\b/i,
    ],
    weight: 8,
  },
  {
    intent: "paragraph_lookup",
    patterns: [
      /\b(paragraph|para\.?\s*\d+\.\d+|\d+\.\d+\s+(ma|ko|le|bhan|k\s+cha))\b/i,
    ],
    weight: 10,
  },
  {
    intent: "scenario",
    patterns: [
      /\b(when\s+should|in\s+which\s+case|if\s+.+\s+then|scenario|example|udaharan|k\s+bela|kun\s+awastha|yadi)\b/i,
    ],
    weight: 7,
  },
];

const FRAMEWORK_SIGNALS =
  /\b(ifrs|nas|conceptual\s+framework|financial\s+reporting|qualitative|recognition|derecognition|measurement|faithful|relevance|comparability|materiality|going\s+concern|reporting\s+entity|economic\s+resource|present\s+obligation|unit\s+of\s+account|executory|substance|fair\s+value|historical\s+cost|capital\s+maintenance|accrual\s+accounting|general\s+purpose|primary\s+users|stewardship|paragraph\s+\d|chapter\s+\d|sampatti|dayitwo|puni|aamdani|manyata|mulyankan|biswasilo|sambandhit|nyaya\s+mulya|paribhasha|conceptual|framework|arthik|lekha\s+ko|hisab\s+ko\s+sidhanta)\b/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const bridge = NEPALI_CONCEPT_BRIDGE[token];
    if (bridge) bridge.forEach((b) => expanded.add(b.toLowerCase()));
  }
  return expanded;
}

function classifyIntent(text: string): FrameworkQuestionIntent {
  const matched: Array<{ intent: FrameworkQuestionIntent; weight: number }> = [];
  for (const entry of INTENT_PATTERNS) {
    for (const p of entry.patterns) {
      if (p.test(text)) {
        matched.push({ intent: entry.intent, weight: entry.weight });
        break;
      }
    }
  }
  if (matched.length === 0) return "general";

  // Priority: comparison and recognition beat generic definition when both match
  const priority: FrameworkQuestionIntent[] = ["comparison", "paragraph_lookup", "recognition", "measurement", "chapter_overview", "qualitative", "definition", "scenario"];
  for (const p of priority) {
    const hit = matched.find((m) => m.intent === p);
    if (hit) return hit.intent;
  }
  return matched.sort((a, b) => b.weight - a.weight)[0].intent;
}

function scoreConcepts(text: string, tokens: Set<string>): Array<{ id: string; score: number; concept: ConceptEntry }> {
  const lower = text.toLowerCase();
  const results: Array<{ id: string; score: number; concept: ConceptEntry }> = [];

  for (const concept of KB.concepts) {
    let score = 0;

    for (const phrase of [...concept.en, ...concept.ne]) {
      const pl = phrase.toLowerCase();
      if (lower.includes(pl)) {
        score += pl.length * 2;
      } else {
        const phraseTokens = tokenize(pl);
        const overlap = phraseTokens.filter((t) => tokens.has(t)).length;
        if (overlap >= Math.ceil(phraseTokens.length * 0.6)) {
          score += overlap * 4;
        }
      }
    }

    for (const token of tokens) {
      if (concept.id.includes(token.replace(/\s+/g, "_"))) score += 3;
      for (const en of concept.en) {
        if (en.toLowerCase().includes(token) && token.length >= 4) score += 2;
      }
    }

    if (score > 0) results.push({ id: concept.id, score, concept });
  }

  return results.sort((a, b) => b.score - a.score);
}

function retrieveParagraphs(
  concepts: Array<{ id: string; score: number; concept: ConceptEntry }>,
  intent: FrameworkQuestionIntent,
  text: string,
  limit = 4,
): ParagraphEntry[] {
  const paraScores = new Map<string, number>();

  const paraRef = text.match(/\b(\d+\.\d+)\b/);
  if (paraRef) {
    const p = PARA_BY_ID.get(paraRef[1]);
    if (p) return [p];
  }

  for (const { concept, score } of concepts.slice(0, 5)) {
    for (const pid of concept.paragraphs) {
      const existing = paraScores.get(pid) ?? 0;
      paraScores.set(pid, existing + score);
    }
  }

  const tokens = expandTokens(tokenize(normalizeNepaliText(text)));
  for (const para of KB.paragraphs) {
    const paraLower = para.text.toLowerCase();
    let tokenHit = 0;
    for (const t of tokens) {
      if (t.length >= 4 && paraLower.includes(t)) tokenHit += 1;
    }
    if (tokenHit > 0) {
      paraScores.set(para.id, (paraScores.get(para.id) ?? 0) + tokenHit * 2);
    }
    if (para.section && text.toLowerCase().includes(para.section.toLowerCase().slice(0, 12))) {
      paraScores.set(para.id, (paraScores.get(para.id) ?? 0) + 15);
    }
  }

  const intentChapterBoost: Partial<Record<FrameworkQuestionIntent, number[]>> = {
    qualitative: [2],
    recognition: [5],
    measurement: [6],
    definition: [4],
  };
  const boostChapters = intentChapterBoost[intent];
  if (boostChapters) {
    for (const [pid, sc] of paraScores) {
      const p = PARA_BY_ID.get(pid);
      if (p && boostChapters.includes(p.chapter)) {
        paraScores.set(pid, sc + 5);
      }
    }
  }

  return [...paraScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => PARA_BY_ID.get(id)!)
    .filter(Boolean);
}

function isFrameworkQuery(text: string): boolean {
  if (FRAMEWORK_SIGNALS.test(text)) return true;
  const normalized = normalizeNepaliText(text);
  const tokens = expandTokens(tokenize(normalized));
  const concepts = scoreConcepts(text, tokens);
  if (concepts.length >= 1 && concepts[0].score >= 6) return true;
  const intent = classifyIntent(text);
  if (intent !== "general" && concepts.length >= 1) return true;
  return false;
}

function formatParagraphRef(id: string): string {
  return `**Para ${id}** (Ch ${id.split(".")[0]})`;
}

function synthesizeDefinitionAnswer(
  concepts: Array<{ id: string; score: number; concept: ConceptEntry }>,
  paragraphs: ParagraphEntry[],
  lang: UserLanguage,
): string {
  const top = concepts[0]?.concept;
  const paras = paragraphs.slice(0, 3);

  if (lang === "english") {
    let reply = top
      ? `**${top.en[0].replace(/^definition of /i, "").replace(/^the /i, "").replace(/\b\w/g, (c) => c.toUpperCase())}** (IFRS Conceptual Framework)\n\n`
      : "**IFRS Conceptual Framework**\n\n";
    for (const p of paras) {
      reply += `${formatParagraphRef(p.id)}`;
      if (p.section) reply += ` — ${p.section}`;
      reply += `\n> ${p.text}\n\n`;
    }
    if (top) {
      reply += `_Source: IFRS Conceptual Framework 2018, Chapter ${top.chapter} — ${CHAPTER_TITLES[top.chapter]}_`;
    }
    return reply.trim();
  }

  const neLabel = top?.ne[0] ?? top?.en[0] ?? "Conceptual Framework";
  let reply = `**${neLabel}** (IFRS Conceptual Framework / NAS)\n\n`;
  for (const p of paras) {
    reply += `${formatParagraphRef(p.id)}`;
    if (p.section) reply += ` — ${p.section}`;
    reply += `\n> ${p.text}\n\n`;
  }
  reply += `_Srot: IFRS Conceptual Framework 2018, Chapter ${paras[0]?.chapter ?? top?.chapter} — ${CHAPTER_TITLES[paras[0]?.chapter ?? top?.chapter ?? 1]}_`;
  return reply.trim();
}

function synthesizeComparisonAnswer(text: string, lang: UserLanguage): string | null {
  const lower = text.toLowerCase();

  const comparisons: Array<{ match: RegExp; en: string; ne: string }> = [
    {
      match: /\b(asset|sampatti).*(liability|dayitwo|rin)|(liability|dayitwo|rin).*(asset|sampatti)|\b(asset|sampatti)\s+(ra|ani|and)\s+(dayitwo|rin|liability)\b/i,
      en: "**Asset vs Liability (IFRS Ch.4):**\n• **Asset** — present economic resource controlled by entity from past events (Para 4.3)\n• **Liability** — present obligation to transfer economic resource from past events (Para 4.26)\n\nKey difference: Asset = right you control; Liability = obligation you must settle.",
      ne: "**Sampatti vs Dayitwo (IFRS Chapter 4):**\n• **Sampatti (Asset)** — entity le niyantran ma liyeko bartaman arthik sampatti, biyetka ghatna bata (Para 4.3)\n• **Dayitwo (Liability)** — arthik sampatti transfer garnu parchha bhanne bartaman dayitwo (Para 4.26)\n\nFarak: Sampatti = tapai ko adhikar; Dayitwo = tapai ko rin/obligation.",
    },
    {
      match: /\b(income|aamdani).*(expense|kharcha)|(expense|kharcha).*(income|aamdani)\b/i,
      en: "**Income vs Expense (IFRS Ch.4):**\n• **Income** — increases in assets or decreases in liabilities that increase equity (excluding capital contributions) — Para 4.68\n• **Expense** — decreases in assets or increases in liabilities that decrease equity (excluding distributions) — Para 4.73",
      ne: "**Aamdani vs Kharcha (IFRS Chapter 4):**\n• **Aamdani (Income)** — sampatti badhne wa dayitwo ghataune, equity badhne (capital contribution bina) — Para 4.68\n• **Kharcha (Expense)** — sampatti ghataune wa dayitwo badhne, equity ghataune — Para 4.73",
    },
    {
      match: /\b(relevance|sambandhit).*(faithful|biswasilo)|(faithful|biswasilo).*(relevance|sambandhit)\b/i,
      en: "**Relevance vs Faithful Representation (IFRS Ch.2):**\n• **Relevance** — information capable of making a difference in decisions (predictive/confirmatory value) — Para 2.6\n• **Faithful Representation** — complete, neutral, free from error — Para 2.12\n\nBoth are **fundamental** qualitative characteristics — information must have BOTH to be useful.",
      ne: "**Sambandhitata vs Biswasilo Pratinidhitwo (IFRS Chapter 2):**\n• **Sambandhitata (Relevance)** — nirnaya ma farak parn sakne jankari — Para 2.6\n• **Biswasilo Pratinidhitwo** — purna, netral, truti rahit — Para 2.12\n\nDuvai **fundamental** gunastan hain — upayogi jankari lai dono chahincha.",
    },
    {
      match: /\b(fair\s+value|nyaya\s+mulya).*(historical|purano|aitihasik)|(historical|purano|aitihasik).*(fair\s+value|nyaya\s+mulya)\b/i,
      en: "**Fair Value vs Historical Cost (IFRS Ch.6):**\n• **Historical Cost** — amount paid/received at acquisition — Para 6.4\n• **Fair Value** — price in orderly transaction between market participants — Para 6.10\n\nChoice depends on relevance, faithful representation, and cost constraint.",
      ne: "**Nyaya Mulya vs Purano Mulya (IFRS Chapter 6):**\n• **Purano Mulya (Historical Cost)** — kineko/bechda ko rakam — Para 6.4\n• **Nyaya Mulya (Fair Value)** — bajar ma nyaya mulya — Para 6.10\n\nChayan relevance, biswasilo pratinidhitwo ra lagat seema ma nirbhar garchha.",
    },
    {
      match: /\b(recognition|manyata).*(derecognition|manyata\s+radda)|(derecognition|manyata\s+radda).*(recognition|manyata)\b/i,
      en: "**Recognition vs Derecognition (IFRS Ch.5):**\n• **Recognition** — adding item to balance sheet when it meets definition AND recognition criteria (relevance + faithful representation) — Para 5.6\n• **Derecognition** — removing when no longer meets recognition criteria — Para 5.26",
      ne: "**Manyata vs Manyata Radda (IFRS Chapter 5):**\n• **Manyata (Recognition)** — paribhasha ra maapdanda pugda patra ma thapne — Para 5.6\n• **Manyata Radda (Derecognition)** — maapdanda na pugda hataune — Para 5.26",
    },
    {
      match: /\b(accrual|prapti).*(cash|nagad)|(cash|nagad).*(accrual|prapti)\b/i,
      en: "**Accrual vs Cash Basis (IFRS Ch.1):**\n• **Accrual accounting** — records effects when they occur, not when cash moves — Para 1.17\n• **Cash flows** — information about past cash receipts/payments — Para 1.20\n\nAccrual gives better performance assessment; Nepal IRD businesses typically use accrual for VAT.",
      ne: "**Prapti Aadhar vs Nagad Aadhar (IFRS Chapter 1):**\n• **Accrual (Prapti aadhar)** — prabhav aayeko bela record, paisa move huda matra hoina — Para 1.17\n• **Nagad aadhar** — paisa aune/jane bela matra — Para 1.20\n\nAccrual le ramro performance assessment dincha; Nepal ma VAT business le accrual use garchhan.",
    },
  ];

  for (const c of comparisons) {
    if (c.match.test(lower)) return lang === "english" ? c.en : c.ne;
  }
  return null;
}

function synthesizeChapterOverview(text: string, lang: UserLanguage): string | null {
  const chMatch = text.match(/chapter\s+(\d)/i) ?? text.match(/adhyaay\s+(\d)/i) ?? text.match(/\b([1-8])\s+(chapter|adhyaay)/i);
  if (!chMatch) return null;
  const chNum = parseInt(chMatch[1], 10);
  if (chNum < 1 || chNum > 8) return null;

  const title = CHAPTER_TITLES[chNum];
  const chapterParas = KB.paragraphs.filter((p) => p.chapter === chNum).slice(0, 5);
  const chapterConcepts = KB.concepts.filter((c) => c.chapter === chNum).map((c) => c.en[0]);

  if (lang === "english") {
    return (
      `**Chapter ${chNum}: ${title}**\n\n` +
      `Key topics: ${chapterConcepts.slice(0, 6).join(", ")}\n\n` +
      chapterParas.map((p) => `${formatParagraphRef(p.id)}: ${p.summary ?? p.text.slice(0, 200)}`).join("\n\n") +
      `\n\n_Ask me about any concept in this chapter — e.g. "what is asset?" or "sampatti ko paribhasha k ho?"_`
    );
  }

  return (
    `**Chapter ${chNum}: ${title}**\n\n` +
    `Mukhya bisay: ${chapterConcepts.slice(0, 6).join(", ")}\n\n` +
    chapterParas.map((p) => `${formatParagraphRef(p.id)}: ${p.summary ?? p.text.slice(0, 200)}`).join("\n\n") +
    `\n\n_Yo chapter ko kunai pani concept sodhnus — jastai "sampatti k ho?" wa "asset ko paribhasha"_`
  );
}

function synthesizeGeneralAnswer(
  concepts: Array<{ id: string; score: number; concept: ConceptEntry }>,
  paragraphs: ParagraphEntry[],
  lang: UserLanguage,
): string {
  if (paragraphs.length === 0) {
    return lang === "english"
      ? "I have the full IFRS Conceptual Framework (2018) in my knowledge. Ask about assets, liabilities, recognition, measurement, qualitative characteristics, or any chapter 1–8."
      : "Ma IFRS Conceptual Framework (2018) ko pura gyan rakheko chhu. Sampatti, dayitwo, manyata, mulyankan, qualitative characteristics, wa chapter 1–8 ko barema sodhnus.";
  }
  return synthesizeDefinitionAnswer(concepts, paragraphs, lang);
}

/** Main entry — semantic CA framework understanding */
export function understandConceptualFramework(text: string): FrameworkBrainResult {
  const lang = detectUserLanguage(text);
  const normalized = normalizeNepaliText(text);

  if (!isFrameworkQuery(text) && !isFrameworkQuery(normalized)) {
    return { kind: "none", reply: "", confidence: 0, language: lang, intent: "general", concepts: [], paragraphs: [] };
  }

  const intent = classifyIntent(text);
  const tokens = expandTokens(tokenize(normalized + " " + text));
  const concepts = scoreConcepts(text, tokens);

  // Comparison synthesis whenever compare signals present (even with "k ho" etc.)
  if (/\b(difference|vs\.?|versus|compare|farak|antar|bich\s+ko)\b/i.test(text)) {
    const cmp = synthesizeComparisonAnswer(text, lang);
    if (cmp) {
      return {
        kind: "answer",
        reply: cmp,
        confidence: 0.92,
        language: lang,
        intent: "comparison",
        concepts: concepts.slice(0, 2).map((c) => c.id),
        paragraphs: [],
      };
    }
  }

  if (intent === "comparison") {
    const cmp = synthesizeComparisonAnswer(text, lang);
    if (cmp) {
      return {
        kind: "answer",
        reply: cmp,
        confidence: 0.92,
        language: lang,
        intent,
        concepts: concepts.slice(0, 2).map((c) => c.id),
        paragraphs: [],
      };
    }
  }

  if (intent === "chapter_overview") {
    const overview = synthesizeChapterOverview(text, lang);
    if (overview) {
      return {
        kind: "answer",
        reply: overview,
        confidence: 0.9,
        language: lang,
        intent,
        concepts: concepts.slice(0, 3).map((c) => c.id),
        paragraphs: [],
      };
    }
  }

  const paragraphs = retrieveParagraphs(concepts, intent, text);
  const conceptIds = concepts.slice(0, 3).map((c) => c.id);
  const paraIds = paragraphs.map((p) => p.id);

  if (paragraphs.length === 0 && concepts.length === 0) {
    return { kind: "none", reply: "", confidence: 0, language: lang, intent, concepts: [], paragraphs: [] };
  }

  const confidence = Math.min(0.95, 0.55 + (concepts[0]?.score ?? 0) * 0.02 + paragraphs.length * 0.05);
  const reply = synthesizeGeneralAnswer(concepts, paragraphs, lang);

  return {
    kind: "answer",
    reply,
    confidence,
    language: lang,
    intent,
    concepts: conceptIds,
    paragraphs: paraIds,
  };
}

/** Build context block for Ollama LLM injection */
export function buildFrameworkContextBlock(text: string): string {
  const result = understandConceptualFramework(text);
  if (result.kind !== "answer" || result.paragraphs.length === 0) return "";

  const paras = result.paragraphs
    .map((id) => PARA_BY_ID.get(id))
    .filter(Boolean) as ParagraphEntry[];

  const lines = paras.map((p) => `[Para ${p.id}] ${p.text}`);
  return (
    `[IFRS CONCEPTUAL FRAMEWORK KNOWLEDGE — retrieved for this question]\n` +
    `Concepts: ${result.concepts.join(", ")}\n` +
    `Intent: ${result.intent}\n\n` +
    lines.join("\n\n")
  );
}

export { isFrameworkQuery, classifyIntent as classifyFrameworkIntent };
