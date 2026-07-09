/** SUTRA AI — batch queries: low stock list, multi-party balances */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { ledgerQueryHandler } from "./LedgerQueryHandler";

const LOW_STOCK_PATTERNS = [
  /\b(low\s+stock|kam\s+stock|stock\s+kam)\b/i,
  /\bke\s+ke\s+(saman|item).*\b(baki|stock)\b/i,
  /\bwhich\s+items?\s+(low|out)\b/i,
  /कम\s*स्टक|स्टक\s*कम/,
];

const MULTI_BALANCE_PATTERNS = [
  /\b(ra|and|,)\s+\w+.*\b(balance|baki|udhaar)\b/i,
  /\b(sabai|all)\s+(party|parties).*\b(balance|baki)\b/i,
  /\b\d+\s+party.*\b(balance|baki)\b/i,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

function extractPartyNames(text: string): string[] {
  const names: string[] = [];
  const koMatches = text.matchAll(/\b([a-z\u0900-\u097F]{2,20})\s+ko\b/gi);
  for (const m of koMatches) {
    const name = m[1].toLowerCase();
    if (!["ma", "timi", "tapai", "aaja", "hijo", "yo", "sabai"].includes(name)) {
      names.push(m[1]);
    }
  }
  if (names.length >= 2) return names;

  const raSplit = text.split(/\s+(?:ra|and)\s+/i);
  if (raSplit.length >= 2) {
    return raSplit
      .map((s) => s.replace(/\b(ko|ko\s+balance|balance|baki|kati).*$/i, "").trim())
      .filter((s) => s.length >= 2);
  }

  return names;
}

export interface BatchQueryResult {
  kind: "low_stock" | "multi_balance";
  nepali: string;
  english: string;
  roman: string;
}

export class BatchQueryHandler {
  isLowStockQuery(text: string): boolean {
    return LOW_STOCK_PATTERNS.some((re) => re.test(text));
  }

  isMultiBalanceQuery(text: string, intent?: IntentClassification): boolean {
    if (MULTI_BALANCE_PATTERNS.some((re) => re.test(text))) return true;
    if (ledgerQueryHandler.isBalanceQuery(text, intent) && extractPartyNames(text).length >= 2) {
      return true;
    }
    return false;
  }

  resolveLowStock(ctx?: ErpRagContext): BatchQueryResult | null {
    const items = (ctx?.items ?? []).filter(
      (i) => i.reorderLevel != null && (i.stockQty ?? 0) <= (i.reorderLevel ?? 0),
    );
    if (!items.length) {
      return {
        kind: "low_stock",
        nepali: "कुनै पनि वस्तु कम स्टक स्तरमा छैन।",
        english: "No items are currently at or below reorder level.",
        roman: "Kunai pani vastu kam stock ma chaina.",
      };
    }

    const lines = items.slice(0, 8).map(
      (i) => `${i.name}: ${i.stockQty ?? 0} ${i.unit ?? "units"} (reorder ${i.reorderLevel})`,
    );

    return {
      kind: "low_stock",
      nepali: `कम स्टक (${items.length} वस्तु):\n${lines.join("\n")}`,
      english: `Low stock (${items.length} items):\n${lines.join("\n")}`,
      roman: `Kam stock (${items.length} items):\n${lines.join("\n")}`,
    };
  }

  resolveMultiBalance(text: string, ctx?: ErpRagContext): BatchQueryResult | null {
    if (!ctx?.parties?.length) return null;

    const queries = extractPartyNames(text);
    if (queries.length < 2) return null;

    const lines: string[] = [];
    for (const q of queries.slice(0, 5)) {
      const hits = erpRagRetriever.findParties(q, ctx.parties, 1);
      const party = hits[0]?.ref;
      if (!party || hits[0].score < 0.6) {
        lines.push(`${q}: फेला परेन`);
        continue;
      }
      const bal = party.balance ?? 0;
      lines.push(
        bal >= 0
          ? `${party.name}: ${formatAmount(bal)} (लिन बाँकी)`
          : `${party.name}: ${formatAmount(Math.abs(bal))} (दिन बाँकी)`,
      );
    }

    if (!lines.length) return null;

    return {
      kind: "multi_balance",
      nepali: `पार्टी ब्यालेन्स:\n${lines.join("\n")}`,
      english: `Party balances:\n${lines.join("\n")}`,
      roman: `Party balances:\n${lines.join("\n")}`,
    };
  }

  resolve(
    text: string,
    intent?: IntentClassification,
    ctx?: ErpRagContext,
  ): BatchQueryResult | null {
    if (this.isLowStockQuery(text)) return this.resolveLowStock(ctx);
    if (this.isMultiBalanceQuery(text, intent)) return this.resolveMultiBalance(text, ctx);
    return null;
  }

  toAIResponse(
    result: BatchQueryResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
    const page = result.kind === "low_stock" ? "items" : "ledger";
    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: {
        english: result.english,
        nepali: result.nepali,
        roman: result.roman,
      },
      sourceLanguage: "roman",
      actions: [
        {
          id: `bat-${Date.now().toString(36)}`,
          type: "navigate",
          page,
          label: result.kind === "low_stock" ? "View Stock" : "View Ledger",
          labelNepali: result.kind === "low_stock" ? "स्टक हेर्नुहोस्" : "खाता हेर्नुहोस्",
        },
      ],
    };
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    const result = this.resolve(text, intent, ctx);
    if (!result) return null;
    if (!this.isLowStockQuery(text) && !this.isMultiBalanceQuery(text, intent)) return null;
    return this.toAIResponse(result, outputLanguage, understoodInput);
  }
}

export const batchQueryHandler = new BatchQueryHandler();
