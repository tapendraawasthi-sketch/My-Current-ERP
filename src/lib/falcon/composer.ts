/**
 * composer.ts — Phase 6 of the Falcon reasoning pipeline.
 *
 * Provides functions that compose human-readable answers from the
 * ACCOUNTING_PRINCIPLES, ERP_WORKFLOW_RULES, COMPARISON_TABLE, and
 * FORMULA_LIBRARY defined in accountingRules.ts, plus a general
 * multi-entry synthesis function for KB entries.
 */

import type { KBEntry, FalconReasoningInput, FalconReasoningResult } from "./types";
import { sentenceSimilarity, tokenize } from "./textUtils";
import {
  ACCOUNTING_PRINCIPLES,
  ERP_WORKFLOW_RULES,
  COMPARISON_TABLE,
  FORMULA_LIBRARY,
} from "./accountingRules";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Score a KB entry against the reasoning input. Returns a numeric score. */
export function scoreEntry(entry: KBEntry, input: FalconReasoningInput): number {
  let score = 0;

  // (a) Question similarity × 3
  score += sentenceSimilarity(input.normalizedQuery, entry.q) * 3.0;

  // (b) Keyword matching
  for (const kw of entry.keywords) {
    const kwTokens = tokenize(kw);
    if (kwTokens.length === 0) continue;
    const hits = kwTokens.filter((t) => input.expandedTokens.has(t)).length;
    if (hits === kwTokens.length) {
      score += 3.0 * kwTokens.length;
    } else {
      score += hits * 1.0;
    }
  }

  // (c) Entity match: +2 per entity canonical found in entry question
  for (const entity of input.entities) {
    if (entry.q.toLowerCase().includes(entity.canonical.toLowerCase())) {
      score += 2.0;
    }
  }

  // (d) Route boost ×1.2
  const route = input.currentRoute ?? "";
  if (
    score > 0 &&
    ((route.includes("billing") ||
      route.includes("invoice") ||
      route.includes("voucher") ||
      route.includes("pos")) &&
      entry.category === "transactions")
  ) {
    score *= 1.2;
  } else if (
    score > 0 &&
    (route.includes("master") ||
      route.includes("party") ||
      route.includes("item") ||
      route.includes("account")) &&
    entry.category === "masters"
  ) {
    score *= 1.2;
  } else if (score > 0 && route.includes("report") && entry.category === "reports") {
    score *= 1.2;
  } else if (score > 0 && route.includes("settings") && entry.category === "general") {
    score *= 1.2;
  }

  return score;
}

/**
 * findTopKEntries — returns the top-k KB entries by score, sorted descending.
 * Entries with score === 0 are excluded.
 */
export function findTopKEntries(
  input: FalconReasoningInput,
  kb: KBEntry[],
  k: number
): KBEntry[] {
  return kb
    .map((entry) => ({ entry, score: scoreEntry(entry, input) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ entry }) => entry);
}

// ─── MULTI-ENTRY SYNTHESIS ────────────────────────────────────────────────────

/**
 * synthesizeAnswer — combines 2–4 KB entries into a single coherent response.
 */
export function synthesizeAnswer(
  entries: KBEntry[],
  input: FalconReasoningInput
): FalconReasoningResult {
  if (entries.length === 0) {
    return buildFallback(input);
  }

  if (entries.length === 1) {
    return {
      answer: entries[0].a,
      strategy: "multi_entry_synthesis",
      confidence: 65,
      matchedEntryIds: [entries[0].id],
      suggestions: [],
    };
  }

  // Build a synthesised answer by combining entries
  const intro = `Here's what I found across ${entries.length} related topics:\n\n`;
  const sections = entries
    .map((e, i) => `**${i + 1}. ${e.q}**\n${e.a}`)
    .join("\n\n---\n\n");

  return {
    answer: intro + sections,
    strategy: "multi_entry_synthesis",
    confidence: 60 + entries.length * 5,
    matchedEntryIds: entries.map((e) => e.id),
    suggestions: [],
  };
}

// ─── COMPARISON COMPOSER ──────────────────────────────────────────────────────

/**
 * composeComparisonAnswer — looks up the COMPARISON_TABLE for a match on termA/termB
 * and builds a formatted diff answer. Returns null if no match found.
 */
export function composeComparisonAnswer(
  termA: string,
  termB: string
): FalconReasoningResult | null {
  const normA = termA.toLowerCase().trim();
  const normB = termB.toLowerCase().trim();

  const match = COMPARISON_TABLE.find(
    (c) =>
      (c.termA.toLowerCase().includes(normA) || normA.includes(c.termA.toLowerCase())) &&
      (c.termB.toLowerCase().includes(normB) || normB.includes(c.termB.toLowerCase()))
  ) ?? COMPARISON_TABLE.find(
    (c) =>
      (c.termA.toLowerCase().includes(normB) || normB.includes(c.termA.toLowerCase())) &&
      (c.termB.toLowerCase().includes(normA) || normA.includes(c.termB.toLowerCase()))
  ) ?? COMPARISON_TABLE.find(
    (c) =>
      c.termA.toLowerCase().includes(normA) ||
      c.termB.toLowerCase().includes(normA) ||
      c.termA.toLowerCase().includes(normB) ||
      c.termB.toLowerCase().includes(normB)
  );

  if (!match) return null;

  const points = match.differencePoints
    .map((p, i) => `**${i + 1}.** ${p}`)
    .join("\n\n");

  return {
    answer: `**${match.termA} vs ${match.termB}**\n\n${points}`,
    strategy: "comparison",
    confidence: 75,
    matchedEntryIds: [],
    suggestions: [
      `How do I create a ${match.termA}?`,
      `How do I create a ${match.termB}?`,
      "What are all the voucher types in Sutra ERP?",
    ],
  };
}

// ─── FORMULA COMPOSER ────────────────────────────────────────────────────────

/**
 * composeFormulaAnswer — searches FORMULA_LIBRARY for a formula matching the query.
 * Returns null if nothing matches well enough.
 */
export function composeFormulaAnswer(normalizedQuery: string): FalconReasoningResult | null {
  const queryTokens = tokenize(normalizedQuery);

  let bestFormula = FORMULA_LIBRARY[0];
  let bestHits = 0;

  for (const formula of FORMULA_LIBRARY) {
    const hits = formula.keywords.filter((kw) =>
      queryTokens.some((t) => kw.toLowerCase().includes(t) || t.includes(kw.toLowerCase()))
    ).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestFormula = formula;
    }
  }

  if (bestHits === 0) return null;

  const answer =
    `**${bestFormula.name}**\n\n` +
    `**Formula:** \`${bestFormula.formula}\`\n\n` +
    `**Explanation:** ${bestFormula.explanation}\n\n` +
    `**Example:** ${bestFormula.example}`;

  return {
    answer,
    strategy: "formula",
    confidence: 85,
    matchedEntryIds: [],
    suggestions: [
      "How is VAT calculated?",
      "How is TDS calculated?",
      "How do I see the Profit & Loss report?",
    ],
  };
}

// ─── WORKFLOW COMPOSER ────────────────────────────────────────────────────────

/**
 * composeWorkflowAnswer — searches ERP_WORKFLOW_RULES for a scenario matching the query.
 * Returns null if nothing matches.
 */
export function composeWorkflowAnswer(
  normalizedQuery: string,
  tokens: string[]
): FalconReasoningResult | null {
  let bestRule = ERP_WORKFLOW_RULES[0];
  let bestHits = 0;

  for (const rule of ERP_WORKFLOW_RULES) {
    const hits = rule.keywords.filter((kw) =>
      tokens.some((t) => kw.toLowerCase().includes(t) || t.includes(kw.toLowerCase()))
    ).length;
    // Also check phrase match in scenario/condition
    const phraseHit =
      normalizedQuery.includes(rule.scenario.toLowerCase().slice(0, 20)) ? 2 : 0;
    const total = hits + phraseHit;
    if (total > bestHits) {
      bestHits = total;
      bestRule = rule;
    }
  }

  if (bestHits === 0) return null;

  const answer =
    `**Scenario:** ${bestRule.scenario}\n\n` +
    `**Condition:** ${bestRule.condition}\n\n` +
    `**What happens:** ${bestRule.consequence}\n\n` +
    `**What to do:** ${bestRule.action}`;

  return {
    answer,
    strategy: "workflow",
    confidence: 78,
    matchedEntryIds: [],
    suggestions: [
      "How do I post a payment voucher?",
      "How do I approve a voucher?",
      "How do I handle TDS on payments?",
    ],
  };
}

// ─── PRINCIPLE COMPOSER ──────────────────────────────────────────────────────

/**
 * composePrincipleAnswer — searches ACCOUNTING_PRINCIPLES for a topic matching the query.
 * Returns null if nothing matches.
 */
export function composePrincipleAnswer(
  normalizedQuery: string,
  tokens: string[]
): FalconReasoningResult | null {
  let bestPrinciple = ACCOUNTING_PRINCIPLES[0];
  let bestHits = 0;

  for (const principle of ACCOUNTING_PRINCIPLES) {
    const hits = principle.keywords.filter((kw) =>
      tokens.some((t) => kw.toLowerCase().includes(t) || t.includes(kw.toLowerCase()))
    ).length;
    const topicHit = normalizedQuery.includes(principle.topic.toLowerCase().slice(0, 15))
      ? 3
      : 0;
    const total = hits + topicHit;
    if (total > bestHits) {
      bestHits = total;
      bestPrinciple = principle;
    }
  }

  if (bestHits === 0) return null;

  return {
    answer: `**${bestPrinciple.topic}**\n\n${bestPrinciple.explanation}`,
    strategy: "principle",
    confidence: 70,
    matchedEntryIds: [],
    suggestions: [
      "What is VAT accounting?",
      "What is TDS?",
      "How does double-entry bookkeeping work?",
    ],
  };
}

// ─── FALLBACK BUILDER ────────────────────────────────────────────────────────

/** Builds a helpful fallback result referencing any entities found. */
export function buildFallback(input: FalconReasoningInput): FalconReasoningResult {
  const DEFAULT_SUGGESTIONS = [
    "How do I create a sales invoice?",
    "How do I see VAT reports?",
    "What are the keyboard shortcuts?",
  ];

  const entityNames = input.entities.map((e) => e.canonical).join(", ");
  const answer =
    entityNames.length > 0
      ? `I couldn't find a precise answer about **${entityNames}**, but I can help with related topics. Try rephrasing or ask me specifically about any of these.`
      : "I couldn't find a direct answer for that. Could you rephrase? You can ask me about: creating sales/purchase invoices, journal entries, VAT reports, party/item masters, inventory transactions, POS mode, or system settings.";

  return {
    answer,
    strategy: "fallback",
    confidence: 5,
    matchedEntryIds: [],
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
