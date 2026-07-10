/**
 * Domain Guard — blocks Wikipedia/general web for accounting/tax/legal terms.
 */

import { isDomainTerm } from "../../representations/uilParser";

const FACTUAL_PATTERNS = [
  /\bwhat is\b/i,
  /\bwhat are\b/i,
  /\bdefine\b/i,
  /\bexplain\b/i,
  /\bk ho\b/i,
  /\bke ho\b/i,
  /\bभनेको के\b/,
];

export interface DomainGuardResult {
  allowWebSearch: boolean;
  routeTo: "accounting_lexicon" | "knowledge_graph" | "general" | "wikipedia_blocked";
  reason: string;
}

export function domainGuard(query: string): DomainGuardResult {
  const trimmed = query.trim();

  if (isDomainTerm(trimmed) || isDomainTerm(trimmed.replace(/[?।]/g, ""))) {
    return {
      allowWebSearch: false,
      routeTo: "accounting_lexicon",
      reason: "Accounting domain term — use lexicon/knowledge graph, not Wikipedia",
    };
  }

  const isFactual = FACTUAL_PATTERNS.some((p) => p.test(trimmed));
  const term = extractTermAfterFactual(trimmed);

  if (isFactual && term && isDomainTerm(term)) {
    return {
      allowWebSearch: false,
      routeTo: "knowledge_graph",
      reason: `Domain definition query for "${term}" — blocked from general web`,
    };
  }

  if (isFactual && /\b(vat|tds|tax|nfrs|ifrs|journal|ledger|कर)\b/i.test(trimmed)) {
    return {
      allowWebSearch: false,
      routeTo: "knowledge_graph",
      reason: "Tax/accounting factual query — use Nepal knowledge base",
    };
  }

  return {
    allowWebSearch: true,
    routeTo: "general",
    reason: "Non-domain query — web search allowed with allowlist",
  };
}

function extractTermAfterFactual(text: string): string | null {
  for (const pattern of FACTUAL_PATTERNS) {
    const match = text.match(new RegExp(pattern.source + "\\s+(.+?)(?:\\?|$)", "i"));
    if (match?.[1]) return match[1].trim().split(/\s+/)[0];
  }
  return null;
}
