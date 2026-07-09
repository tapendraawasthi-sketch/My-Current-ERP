/** SUTRA AI — stock quantity queries via ERP RAG */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { ledgerQueryHandler } from "./LedgerQueryHandler";

const STOCK_PATTERNS = [
  /\bstock\s+kati\b/i,
  /\b(kati\s+)?baki\s+cha\b/i,
  /\bkati\s+(baki|stock|saman|piece|unit)\b/i,
  /\bhow\s+much\s+.+\s+(left|in\s+stock|remaining)\b/i,
  /\bremaining\s+stock\b/i,
  /स्टक|बाँकी\s*कति|कति\s*बाँकी|कति\s*छ/,
];

export interface StockQueryResult {
  itemName: string;
  stockQty: number;
  unit: string;
  reorderLevel?: number;
  lowStock: boolean;
  nepali: string;
  english: string;
  roman: string;
}

export class StockQueryHandler {
  isStockQuery(
    text: string,
    entities: ExtractedEntities,
    intent?: IntentClassification,
  ): boolean {
    if (ledgerQueryHandler.isBalanceQuery(text, intent)) return false;
    if (STOCK_PATTERNS.some((re) => re.test(text))) return true;
    if (
      entities.product &&
      /\b(baki|stock|kati|saman|piece|unit|cha|cha\?)\b/i.test(text)
    ) {
      return true;
    }
    if (intent?.intent === "QUERY" && entities.product && /\b(kati|how\s+much)\b/i.test(text)) {
      return true;
    }
    return false;
  }

  resolve(
    text: string,
    entities: ExtractedEntities,
    ctx?: ErpRagContext,
  ): StockQueryResult | null {
    if (!ctx?.items?.length) return null;

    let itemQuery = entities.product;
    if (!itemQuery) {
      const m = text.match(
        /\b([a-z\u0900-\u097F]{2,24})\s+(ko\s+)?(kati|baki|stock)\b/i,
      );
      if (m) itemQuery = m[1];
    }
    if (!itemQuery) return null;

    const hits = erpRagRetriever.findItems(itemQuery, ctx.items, 1);
    const item = hits[0]?.ref;
    if (!item || hits[0].score < 0.6) return null;

    const stockQty = item.stockQty ?? 0;
    const unit = item.unit || "units";
    const reorderLevel = item.reorderLevel;
    const lowStock = reorderLevel != null && stockQty <= reorderLevel;

    const qtyLabel = `${stockQty.toLocaleString("en-NP")} ${unit}`;
    const nepali = lowStock
      ? `${item.name} को स्टक: ${qtyLabel} — कम स्टक चेतावनी!`
      : `${item.name} को स्टक: ${qtyLabel} बाँकी छ।`;

    const english = lowStock
      ? `${item.name} stock: ${qtyLabel} remaining — low stock alert!`
      : `${item.name} has ${qtyLabel} in stock.`;

    const roman = lowStock
      ? `${item.name} ko stock: ${qtyLabel} — kam stock chetawani!`
      : `${item.name} ko stock: ${qtyLabel} baki cha.`;

    return {
      itemName: item.name,
      stockQty,
      unit,
      reorderLevel,
      lowStock,
      nepali,
      english,
      roman,
    };
  }

  toAIResponse(
    result: StockQueryResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
    return {
      understood_input: understoodInput,
      confidence: 0.92,
      needs_clarification: false,
      suggestions: [],
      response: {
        english: result.english,
        nepali: result.nepali,
        roman: result.roman,
      },
      sourceLanguage: "roman",
      followUp: undefined,
      actions: [
        {
          id: `stk-${Date.now().toString(36)}`,
          type: "navigate",
          page: "items",
          label: "View Stock",
          labelNepali: "स्टक हेर्नुहोस्",
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
    if (!this.isStockQuery(text, entities, intent)) return null;
    const result = this.resolve(text, entities, ctx);
    if (!result) return null;
    return this.toAIResponse(result, outputLanguage, understoodInput);
  }
}

export const stockQueryHandler = new StockQueryHandler();
