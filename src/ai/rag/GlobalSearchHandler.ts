/** SUTRA AI — cross-ERP keyword search (parties, items, invoices) */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { parseSearchPartyFilter, filterPartiesByKind } from "../context/PartyTypeFilter";

const SEARCH_PATTERNS = [
  /^\/search\s+(.+)/i,
  /\b(search|khoj|find|lookup|dhoondh)\b/i,
  /खोज|फेला\s*पार/,
];

function extractQuery(text: string): string | null {
  const slash = text.match(/^\/search\s+(.+)/i);
  if (slash) return slash[1].trim();

  const m = text.match(/\b(?:search|khoj|find|lookup)\s+(.+)/i);
  if (m) return m[1].trim();

  if (/^khoj\s+/i.test(text)) return text.replace(/^khoj\s+/i, "").trim();
  return null;
}

export class GlobalSearchHandler {
  isSearchQuery(text: string, intent?: IntentClassification): boolean {
    if (SEARCH_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "QUERY" && /\b(search|khoj|find)\b/i.test(text)) return true;
    return false;
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isSearchQuery(text, intent)) return null;

    const query = extractQuery(text);
    if (!query || query.length < 2) return null;

    const { query: searchQ, filter } = parseSearchPartyFilter(text);
    const partyQuery = searchQ.length >= 2 ? searchQ : query;

    const lines: string[] = [];
    const filterLabel =
      filter === "supplier" ? " (supplier)" : filter === "customer" ? " (customer)" : "";

    if (ctx?.parties?.length) {
      const pool = filterPartiesByKind(ctx.parties, filter);
      const parties = erpRagRetriever.findParties(partyQuery, pool, 3);
      for (const p of parties) {
        if (p.score < 0.55) continue;
        const bal = p.ref.balance != null ? ` · bal ${p.ref.balance.toLocaleString("en-NP")}` : "";
        lines.push(`Party: ${p.ref.name}${bal}`);
      }
    }

    if (ctx?.items?.length) {
      const items = erpRagRetriever.findItems(query, ctx.items, 3);
      for (const i of items) {
        if (i.score < 0.55) continue;
        const rate = i.ref.saleRate ? ` @${i.ref.saleRate}` : "";
        lines.push(`Item: ${i.ref.name}${rate} · stock ${i.ref.stockQty ?? "?"}`);
      }
    }

    if (ctx?.recentInvoices?.length) {
      const q = partyQuery.toLowerCase();
      const invs = ctx.recentInvoices
        .filter(
          (inv) =>
            inv.partyName?.toLowerCase().includes(q) ||
            inv.invoiceNo?.toLowerCase().includes(q),
        )
        .slice(0, 3);
      for (const inv of invs) {
        lines.push(`Invoice: ${inv.invoiceNo} · ${inv.partyName} · ${inv.grandTotal}`);
      }
    }

    if (!lines.length) {
      return {
        understood_input: understoodInput,
        confidence: 0.7,
        needs_clarification: false,
        suggestions: [],
        response: {
          nepali: `"${partyQuery}" को लागि केही फेला परेन${filterLabel}।`,
          english: `No results for "${partyQuery}"${filterLabel}.`,
          roman: `"${partyQuery}" ko lagi kehi fela parena${filterLabel}.`,
        },
        sourceLanguage: "roman",
        quickReplies: [
          { id: "sr-ex", label: "/examples", value: "/examples", kind: "query" },
        ],
      };
    }

    const body = lines.join("\n");
    return {
      understood_input: understoodInput,
      confidence: 0.88,
      needs_clarification: false,
      suggestions: [],
      response: {
        nepali: `खोज परिणाम "${partyQuery}"${filterLabel}:\n${body}`,
        english: `Search results for "${partyQuery}"${filterLabel}:\n${body}`,
        roman: `Search "${partyQuery}"${filterLabel}:\n${body}`,
      },
      sourceLanguage: "roman",
    };
  }
}

export const globalSearchHandler = new GlobalSearchHandler();
