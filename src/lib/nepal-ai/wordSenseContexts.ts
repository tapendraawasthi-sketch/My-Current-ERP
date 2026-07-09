/**
 * English word sense contexts — polysemy goldens with Nepali meanings and domain cues.
 */

import {
  WORD_SENSE_CONTEXT_ALIASES,
  WORD_SENSE_CONTEXTS,
  WORD_SENSE_CONTEXTS_BY_WORD,
  type WordSenseContext,
  type WordSenseContextItem,
} from "./generated/runtimeMaps";

const BY_ID = new Map(WORD_SENSE_CONTEXTS.map((e) => [e.id, e]));
const BY_WORD = new Map<string, WordSenseContext>();
for (const entry of WORD_SENSE_CONTEXTS) {
  BY_WORD.set(entry.word.toLowerCase(), entry);
  BY_WORD.set(entry.wordKey, entry);
}

const DOMAIN_CUE_PATTERNS: Record<string, RegExp[]> = {
  accounting: /\b(khata|ledger|journal|debit|credit\s+side|account|udhaar|baki)\b/i,
  finance: /\b(paisa|bank|loan|interest|credit\s+line|account)\b/i,
  tax: /\b(tax|vat|income|file|return\s+file|kar)\b/i,
  retail: /\b(return\s+policy|refund|exchange|firta|sales)\b/i,
  hardware_shop: /\b(weight|kg|taula|trazzu)\b/i,
  legal: /\b(court|judge|mudda|charge|arop)\b/i,
  medical: /\b(doctor|hospital|birami|patient|case\s+study)\b/i,
  mobile: /\b(phone|mobile|cover)\b/i,
  computer: /\b(save|data|computer|file\s+save|excel)\b/i,
  software: /\b(bug\s+fix|code|program|run\s+gar)\b/i,
  internet: /\b(wifi|net\s+chal|internet|online)\b/i,
  mesh: /\b(fish|jaal|mesh)\b/i,
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWordSenseContextById(id: string): WordSenseContext | null {
  return BY_ID.get(id) ?? null;
}

export function getWordSenseContextByWord(word: string): WordSenseContext | null {
  return BY_WORD.get(word.toLowerCase()) ?? BY_WORD.get(normalizeKey(word)) ?? null;
}

export function matchWordSenseByAlias(text: string): WordSenseContext | null {
  if (!text?.trim()) return null;
  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = WORD_SENSE_CONTEXT_ALIASES[cand];
    if (hit) return getWordSenseContextById(hit.id);
  }
  return null;
}

export interface WordSenseResolution {
  entry: WordSenseContext;
  context: WordSenseContextItem;
  confidence: number;
}

function scoreContext(ctx: WordSenseContextItem, text: string): number {
  let score = 0;
  const ex = normalizeKey(ctx.example);
  const t = normalizeKey(text);
  if (t === ex || t.includes(ex) || ex.includes(t)) score += 0.9;

  const cues = DOMAIN_CUE_PATTERNS[ctx.domain];
  if (cues?.some((re) => re.test(text))) score += 0.55;

  const strategy = ctx.domain.replace(/_/g, " ");
  if (new RegExp(`\\b${strategy}\\b`, "i").test(text)) score += 0.25;

  return score;
}

/** Score domains for an ambiguous English word in mixed text. */
export function resolveWordSense(text: string): WordSenseResolution | null {
  const aliasHit = matchWordSenseByAlias(text);
  if (aliasHit) {
    let bestCtx = aliasHit.contexts[0];
    let bestScore = 0;
    for (const ctx of aliasHit.contexts) {
      const s = scoreContext(ctx, text);
      if (s > bestScore) {
        bestScore = s;
        bestCtx = ctx;
      }
    }
    return { entry: aliasHit, context: bestCtx, confidence: Math.max(bestScore, 0.85) };
  }

  const lower = text.toLowerCase();
  for (const entry of WORD_SENSE_CONTEXTS) {
    const wordRe = new RegExp(`\\b${entry.word}\\b`, "i");
    if (!wordRe.test(lower)) continue;

    const scored = entry.contexts
      .map((ctx) => ({ ctx, score: scoreContext(ctx, text) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0].score < 0.35) continue;
    if (scored.length > 1 && scored[0].score - scored[1].score < 0.15) {
      return null;
    }
    return {
      entry,
      context: scored[0].ctx,
      confidence: scored[0].score,
    };
  }
  return null;
}

export function wordSenseNeedsClarification(text: string): WordSenseContext | null {
  if (resolveWordSense(text)) return null;

  const lower = text.toLowerCase();
  for (const entry of WORD_SENSE_CONTEXTS) {
    if (!new RegExp(`\\b${entry.word}\\b`, "i").test(lower)) continue;
    const scored = entry.contexts
      .map((ctx) => scoreContext(ctx, text))
      .sort((a, b) => b - a);
    if (scored.length >= 2 && scored[0] < 0.5 && scored[0] - scored[1] < 0.2) {
      return entry;
    }
  }
  return null;
}

export function formatWordSenseClarify(
  entry: WordSenseContext,
  lang: "nepali" | "english" | "mixed",
): string {
  const options = entry.contexts.map(
    (ctx, i) =>
      `${i + 1}. **${ctx.domain}** — ${lang === "english" ? ctx.meaningEn : ctx.meaningNe} (e.g. "${ctx.example}")`,
  );

  if (lang === "english") {
    return (
      `**"${entry.word}"** can mean different things:\n\n` +
      `${options.join("\n")}\n\n` +
      `**Tip:** ${entry.disambiguationStrategy}`
    );
  }

  return (
    `**"${entry.word}"** ko dherai arth huncha:\n\n` +
    `${options.join("\n")}\n\n` +
    `**Sallah:** ${entry.disambiguationStrategy}`
  );
}

export function formatWordSenseResolution(
  resolution: WordSenseResolution,
  lang: "nepali" | "english" | "mixed",
): string {
  const { entry, context } = resolution;
  if (lang === "english") {
    return (
      `**${entry.word}** → **${context.domain}**: ${context.meaningEn}\n` +
      `Example: "${context.example}"`
    );
  }
  return (
    `**${entry.word}** → **${context.domain}**: ${context.meaningNe}\n` +
    `Udaharan: "${context.example}"`
  );
}

export type { WordSenseContext, WordSenseContextItem };
