/**
 * Nepali Grammar Knowledge Brain — self-contained BM25 retrieval over bundled index.
 * Understands Nepali morphology, case markers (le/lai/bata), and accounting NLU rules.
 * No API keys, no downloads — uses data/ekhata/nepali-grammar-search-index.json.
 */

import grammarIndex from "../../../data/ekhata/nepali-grammar-search-index.json";
import grammarMeta from "../../../data/ekhata/nepali-grammar-index.json";
import { parseSemanticFrame, type SemanticFrame } from "./semanticNepaliBrain";

interface GrammarChunk {
  chunk_id: string;
  section_id: number;
  title_en: string;
  title_ne: string;
  source: string;
  text: string;
  norm: number;
  vector: Record<string, number>;
}

interface SearchIndex {
  version: number;
  n_docs: number;
  avg_dl: number;
  df: Record<string, number>;
  chunks: GrammarChunk[];
}

const INDEX = grammarIndex as SearchIndex;

const FINANCIAL_SECTIONS = new Set([
  18, 21, 24, 26, 27, 31, 70, 71, 72, 75, 78, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 97, 98, 99, 101, 102, 103, 104,
]);

const TOKEN_RE =
  /[\u0900-\u097F]+|[a-zA-Z]{2,}|\d+(?:\.\d+)?(?:k|hajar|saya|lakh)?/gi;

const SKIP_LINE =
  /^(━+|SECTION\s+\d+|खण्ड\s+\d+|OVERVIEW:|EXAMPLES:|Part\s+\d+|Document\s+Completion)/i;

const INTENT_SECTION_MAP: Record<string, number[]> =
  (grammarMeta as { intentSectionMap?: Record<string, number[]> }).intentSectionMap ?? {};

function tokenize(text: string): string[] {
  return (text.match(TOKEN_RE) ?? []).map((t) => t.toLowerCase());
}

function bm25Vector(
  tokens: string[],
  df: Record<string, number>,
  nDocs: number,
  avgDl: number,
): { vec: Record<string, number>; norm: number } {
  const k1 = 1.5;
  const b = 0.75;
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  const dl = tokens.length || 1;
  const vec: Record<string, number> = {};
  let normSq = 0;

  for (const [term, freq] of tf) {
    const docFreq = df[term] ?? 0;
    const idf = Math.log((nDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const tfNorm = (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (dl / avgDl)));
    const weight = idf * tfNorm;
    if (weight > 0) {
      vec[term] = weight;
      normSq += weight * weight;
    }
  }

  return { vec, norm: Math.sqrt(normSq) || 1 };
}

function cosineSparse(
  a: Record<string, number>,
  aNorm: number,
  b: Record<string, number>,
  bNorm: number,
): number {
  if (!Object.keys(a).length || !Object.keys(b).length) return 0;
  const [shorter, longer] =
    Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of Object.entries(shorter)) {
    dot += v * (longer[k] ?? 0);
  }
  return dot / (aNorm * bNorm);
}

function keywordScore(query: string, chunk: GrammarChunk): number {
  const tokens = new Set(tokenize(query));
  if (!tokens.size) return 0;

  const text = chunk.text.toLowerCase();
  const title = `${chunk.title_en} ${chunk.title_ne}`.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (text.includes(token)) score += 1;
    if (title.includes(token)) score += 3;
  }

  if (FINANCIAL_SECTIONS.has(chunk.section_id)) {
    if (/\b(\d+|saya|hajar|lakh|paisa|udhaar|tiryo|kinyo|beche|diyo|liyo)\b/i.test(query)) {
      score += 2.5;
    }
  }

  if (chunk.source.includes("verbatim") && /\b(xa|xaina|chha|halkhabar)\b/i.test(query)) {
    score += 1.5;
  }

  return score;
}

export interface GrammarHit {
  section_id: number;
  title_en: string;
  title_ne: string;
  text: string;
  score: number;
  chunk_id: string;
}

/** BM25 + keyword hybrid search — same algorithm as Python erp_bot store. */
export function searchNepaliGrammar(query: string, k = 4): GrammarHit[] {
  const chunks = INDEX.chunks ?? [];
  if (!chunks.length || !query.trim()) return [];

  const qTokens = tokenize(query);
  const { vec: qVec, norm: qNorm } = bm25Vector(
    qTokens,
    INDEX.df ?? {},
    INDEX.n_docs ?? chunks.length,
    INDEX.avg_dl ?? 1,
  );

  const scored: GrammarHit[] = [];

  for (const chunk of chunks) {
    const bm25 = cosineSparse(qVec, qNorm, chunk.vector ?? {}, chunk.norm ?? 1);
    const kw = keywordScore(query, chunk);
    const total = bm25 * 4 + kw * 0.35;
    if (total > 0.05) {
      scored.push({
        section_id: chunk.section_id,
        title_en: chunk.title_en,
        title_ne: chunk.title_ne,
        text: chunk.text,
        score: total,
        chunk_id: chunk.chunk_id,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function scoreLine(line: string, frame: SemanticFrame, queryTokens: Set<string>): number {
  const stripped = line.trim();
  if (!stripped || stripped.length < 8 || SKIP_LINE.test(stripped)) return 0;

  const lower = stripped.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (token.length >= 2 && lower.includes(token)) score += 2;
  }

  if (frame.verbLemma && lower.includes(frame.verbLemma)) score += 3.5;
  if (frame.agent && lower.includes(frame.agent.toLowerCase())) score += 4;
  if (frame.recipient && lower.includes(frame.recipient.toLowerCase())) score += 4;

  if (stripped.startsWith("AI RULE")) score += 10;
  else if (stripped.startsWith("RULE GROUP")) score += 8;
  else if (/^RULE\s+\d+\.\d+:/.test(stripped)) score += 7;
  else if (stripped.startsWith("→")) score += 5;

  if (stripped.length > 220) score *= 0.35;
  return score;
}

function pickRelevantLines(body: string, frame: SemanticFrame, query: string, limit = 6): string[] {
  const tokens = new Set(tokenize(query));
  const scored: Array<[number, string]> = [];

  for (const line of body.split("\n")) {
    const s = scoreLine(line, frame, tokens);
    if (s >= 3) scored.push([s, line.trim()]);
  }

  scored.sort((a, b) => b[0] - a[0]);
  const picked: string[] = [];
  const seen = new Set<string>();

  for (const [, line] of scored) {
    const norm = line.toLowerCase().slice(0, 80);
    if (seen.has(norm)) continue;
    seen.add(norm);
    picked.push(line.length > 200 ? `${line.slice(0, 197)}...` : line);
    if (picked.length >= limit) break;
  }

  return picked;
}

function interpretationHints(frame: SemanticFrame): string[] {
  const hints: string[] = [];

  if (frame.agent) hints.push(`Agent (le): ${frame.agent} — subject who acted`);
  if (frame.recipient) hints.push(`Recipient (lai): ${frame.recipient} — who received credit/goods`);
  if (frame.source) hints.push(`Source (bata): ${frame.source} — payment came from`);
  if (frame.paymentMode === "credit") hints.push("Payment mode: udhaar/credit — receivable or payable");
  if (frame.paymentMode === "cash") hints.push("Payment mode: cash/nagad — no outstanding");

  if (frame.verbLemma === "diye" || frame.verbLemma === "diyo") {
    hints.push("diye/diyo: X lai ... = credit sale; X le ... = payment received");
  }

  return hints.slice(0, 5);
}

/** Synthesize compact grammar context for a message — meaning, not keyword dump. */
export function synthesizeGrammarContext(message: string, maxChars = 1800): string {
  const frame = parseSemanticFrame(message);
  const expanded = [
    message,
    frame.verbLemma ?? "",
    frame.agent ?? "",
    frame.recipient ?? "",
    frame.action !== "UNKNOWN" ? frame.action.toLowerCase() : "",
  ]
    .filter(Boolean)
    .join(" ");

  let hits = searchNepaliGrammar(expanded, 5);

  // Boost intent-mapped sections
  const boostIds: number[] = [];
  if (frame.action === "PURCHASE" || frame.action === "CREDIT_PURCHASE") {
    boostIds.push(...(INTENT_SECTION_MAP.khata_purchase ?? []));
  }
  if (frame.action === "SALE" || frame.action === "CREDIT_SALE") {
    boostIds.push(...(INTENT_SECTION_MAP.khata_credit_sale ?? []));
  }
  if (frame.action === "PAY_IN") boostIds.push(...(INTENT_SECTION_MAP.khata_payment_in ?? []));
  if (frame.isQuestion) boostIds.push(...(INTENT_SECTION_MAP.accounting_ledger ?? []));

  if (boostIds.length) {
    const boostSet = new Set(boostIds);
    const extra = INDEX.chunks
      .filter((c) => boostSet.has(c.section_id))
      .map((c) => ({
        section_id: c.section_id,
        title_en: c.title_en,
        title_ne: c.title_ne,
        text: c.text,
        score: 999,
        chunk_id: c.chunk_id,
      }));
    const seen = new Set(hits.map((h) => h.chunk_id));
    for (const e of extra) {
      if (!seen.has(e.chunk_id)) hits.push(e);
    }
    hits = hits.slice(0, 6);
  }

  if (!hits.length) return "";

  const lines = [
    "[NEPALI MEANING INTELLIGENCE]",
    "Interpret user intent using grammar rules below — not literal word match.",
    "",
    "▸ Understanding",
    ...interpretationHints(frame).map((h) => `  • ${h}`),
  ];

  let used = lines.join("\n").length;

  for (const hit of hits) {
    const picked = pickRelevantLines(hit.text, frame, message);
    if (!picked.length) continue;

    const block = [
      `▸ Sec ${hit.section_id}: ${hit.title_en}`,
      ...picked.map((ln) => (ln.startsWith("→") ? `  ${ln}` : `  • ${ln}`)),
    ].join("\n");

    if (used + block.length + 2 > maxChars) break;
    lines.push("", block);
    used += block.length + 2;
  }

  return lines.join("\n").trim();
}

/** Answer accounting language questions using grammar + lexicon synthesis. */
export function answerFromGrammarKnowledge(
  question: string,
  lang: "nepali" | "english" | "mixed",
): { reply: string; confidence: number } | null {
  const hits = searchNepaliGrammar(question, 3);
  if (!hits.length) return null;

  const frame = parseSemanticFrame(question);
  const rules: string[] = [];

  for (const hit of hits) {
    const picked = pickRelevantLines(hit.text, frame, question, 4);
    for (const line of picked) {
      if (/^(AI RULE|RULE|→|INTENT:|MAP:)/.test(line)) rules.push(line);
    }
  }

  if (!rules.length) return null;

  const unique = [...new Set(rules)].slice(0, 5);
  const header =
    lang === "english"
      ? "Based on Nepali accounting language rules:"
      : "Nepali hisab bhasa ko niyam anusar:";

  return {
    reply: `${header}\n\n${unique.map((r) => `• ${r.replace(/^→\s*/, "")}`).join("\n")}`,
    confidence: 0.62,
  };
}
