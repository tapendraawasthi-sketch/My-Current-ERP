/**
 * Nepal Accounting Knowledge Brain — structured KB for tax, NAS/NFRS, transactions.
 * Complements IFRS framework brain and accounting lexicon.
 */

import knowledge from "../../../data/ekhata/nepal-accounting-knowledge.json";
import { detectUserLanguage, type UserLanguage } from "./accountingLanguageBrain";

export interface NepalKnowledgeItem {
  id: string;
  type: string;
  topics: string[];
  term_en?: string;
  term_ne?: string;
  text_en?: string;
  text_ne?: string;
  examples_ne?: string[];
  journal?: string;
}

interface NepalKnowledgeShape {
  metadata: Record<string, unknown>;
  tax_rates: Record<string, unknown>;
  items: NepalKnowledgeItem[];
}

const KB = knowledge as NepalKnowledgeShape;

function scoreItem(query: string, item: NepalKnowledgeItem): number {
  const q = query.toLowerCase();
  let score = 0;

  const fields = [
    item.term_en,
    item.term_ne,
    item.text_en,
    item.text_ne,
    ...(item.topics ?? []),
    ...(item.examples_ne ?? []),
    item.journal,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  for (const token of tokens) {
    if (fields.includes(token)) score += 2;
    else if (fields.includes(token.replace(/[^\w]/g, ""))) score += 1;
    else if (fields.indexOf(token) >= 0) score += 3;
    else if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(fields)) {
      score += 2;
    }
  }

  for (const topic of item.topics ?? []) {
    if (q.includes(topic.toLowerCase())) score += 4;
  }

  if (item.term_ne && q.includes(item.term_ne.toLowerCase())) score += 8;
  if (item.term_en && q.includes(item.term_en.toLowerCase())) score += 8;

  // Type-specific boosts
  if (/\b(vat|tds|ssf|tax|ird|kar)\b/i.test(q) && item.type === "tax") score += 3;
  if (/\b(nas|nfrs|standard)\b/i.test(q) && item.type === "nas") score += 3;
  if (/\b(entry|journal|dr|cr|debit|credit)\b/i.test(q) && item.type === "transaction") score += 3;
  if (/\b(k\s*ho|what\s*is|define|matlab|arth)\b/i.test(q) && item.type === "glossary") score += 4;

  return score;
}

function formatAnswer(item: NepalKnowledgeItem, lang: UserLanguage): string {
  const title = lang === "english" ? item.term_en : item.term_ne || item.term_en;
  const body =
    lang === "english"
      ? item.text_en
      : item.text_ne || item.text_en;

  if (!body) return "";

  let reply = `**${title ?? item.id}**\n\n${body}`;

  if (item.journal) {
    reply += lang === "english"
      ? `\n\n**Journal:** ${item.journal}`
      : `\n\n**Journal:** ${item.journal}`;
  }

  if (item.examples_ne?.length && lang !== "english") {
    reply += `\n\n**Udaharan:** ${item.examples_ne.slice(0, 2).join("; ")}`;
  }

  return reply;
}

export function isNepalAccountingKnowledgeQuery(text: string): boolean {
  return /\b(vat|tds|ssf|ird|nas|nfrs|tax|kar|bhada|udhaar|provision|accrual|gratuity|bonus|pan|fiscal|shrawan|ashadh|company\s*act|labour\s*act|input\s*vat|output\s*vat|registration|threshold|exempt|zero\s*rated|cooperative|corporate\s*tax|slab|withhold|remittance)\b|[\u0900-\u097F]/i.test(
    text,
  );
}

export interface NepalKnowledgeResult {
  kind: "answer" | "none";
  reply: string;
  confidence: number;
  language: UserLanguage;
  itemId?: string;
}

export function understandNepalAccountingKnowledge(text: string): NepalKnowledgeResult {
  const lang = detectUserLanguage(text);
  const trimmed = text.trim();
  if (!trimmed) {
    return { kind: "none", reply: "", confidence: 0, language: lang };
  }

  const scored = KB.items
    .map((item) => ({ item, score: scoreItem(trimmed, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < 4) {
    // Tax rate quick answers from structured rates
    const taxReply = tryTaxRateAnswer(trimmed, lang);
    if (taxReply) {
      return { kind: "answer", reply: taxReply, confidence: 0.75, language: lang, itemId: "tax_rates" };
    }
    return { kind: "none", reply: "", confidence: 0, language: lang };
  }

  const reply = formatAnswer(top.item, lang);
  const confidence = Math.min(0.95, 0.5 + top.score * 0.04);

  return {
    kind: "answer",
    reply,
    confidence,
    language: lang,
    itemId: top.item.id,
  };
}

function tryTaxRateAnswer(text: string, lang: UserLanguage): string | null {
  const t = text.toLowerCase();
  const rates = KB.tax_rates as Record<string, Record<string, unknown>>;

  if (/\b(vat|mulya\s*thap|bhyaat)\b/i.test(t) && /\b(rate|dar|kati|percent|%|13)\b/i.test(t)) {
    const vat = rates.vat;
    const note = lang === "english" ? String(vat.note_en) : String(vat.note_ne);
    return `**Nepal VAT**\n\n${note}`;
  }

  if (/\b(ssf)\b/i.test(t) && /\b(rate|dar|10|11|percent)\b/i.test(t)) {
    const ssf = rates.ssf;
    const note = lang === "english" ? String(ssf.note_en) : String(ssf.note_ne);
    return `**Nepal SSF**\n\n${note}`;
  }

  if (/\b(tds|withhold|source)\b/i.test(t)) {
    const tds = rates.tds;
    const note = lang === "english" ? String(tds.note_en) : String(tds.note_ne);
    return `**Nepal TDS (common rates)**\n\n${note}`;
  }

  if (/\b(corporate|company)\b/i.test(t) && /\b(tax|rate)\b/i.test(t)) {
    const pct = (rates.income_tax?.corporate_general as number) * 100;
    return lang === "english"
      ? `**Corporate tax Nepal:** General rate is ${pct}% on taxable profit.`
      : `**Company tax Nepal:** Sadharan dar ${pct}% taxable profit ma.`;
  }

  return null;
}

export function searchNepalKnowledgeForRag(text: string, k = 4): NepalKnowledgeItem[] {
  return KB.items
    .map((item) => ({ item, score: scoreItem(text, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.item);
}
