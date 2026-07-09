/** SUTRA AI — item sale/purchase rate queries */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { stockQueryHandler } from "./StockQueryHandler";

const RATE_PATTERNS = [
  /\b(ko\s+)?(rate|price|dam|mul|mulya)\b/i,
  /\bhow\s+much\s+(is|does)\s+.+\s+cost\b/i,
  /\b(kati\s+ma|kati\s+ko)\s+(dam|rate)\b/i,
  /दाम|मूल्य|रेट|कति\s*को\s*दाम/,
];

function formatAmount(n: number): string {
  return `Rs. ${n.toLocaleString("en-NP")}`;
}

export class ProductRateQueryHandler {
  isRateQuery(text: string, entities: ExtractedEntities, intent?: IntentClassification): boolean {
    if (stockQueryHandler.isStockQuery(text, entities, intent) && !RATE_PATTERNS.some((re) => re.test(text))) {
      return false;
    }
    if (RATE_PATTERNS.some((re) => re.test(text))) return true;
    if (entities.product && /\b(rate|price|dam|mulya|cost)\b/i.test(text)) return true;
    return false;
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isRateQuery(text, entities, intent) || !ctx?.items?.length) return null;

    const query = entities.product ?? entities.productEnglish;
    if (!query) {
      const token = text.match(/\b([a-z\u0900-\u097F]{3,20})\s+ko\s+(rate|dam|price)/i);
      if (!token) return null;
    }

    const hits = erpRagRetriever.findItems(query ?? text, ctx.items, 1);
    const item = hits[0]?.ref;
    if (!item || hits[0].score < 0.6) return null;

    const sale = item.saleRate;
    const purchase = item.purchaseRate;
    const stock = item.stockQty;

    const nepali =
      `${item.name}:\n` +
      (sale ? `• बिक्री दर: ${formatAmount(sale)}` : "") +
      (purchase ? `\n• खरिद दर: ${formatAmount(purchase)}` : "") +
      (stock != null ? `\n• स्टक: ${stock} ${item.unit ?? "units"}` : "");

    const english =
      `${item.name}:\n` +
      (sale ? `• Sale rate: ${formatAmount(sale)}` : "") +
      (purchase ? `\n• Purchase rate: ${formatAmount(purchase)}` : "") +
      (stock != null ? `\n• Stock: ${stock} ${item.unit ?? "units"}` : "");

    const roman =
      `${item.name}: sale ${sale ? formatAmount(sale) : "—"}, stock ${stock ?? "—"}`;

    return {
      understood_input: understoodInput,
      confidence: 0.91,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      actions: [
        {
          id: `rate-${Date.now().toString(36)}`,
          type: "navigate",
          page: "items",
          label: "View Item",
          labelNepali: "वस्तु हेर्नुहोस्",
        },
      ],
    };
  }
}

export const productRateQueryHandler = new ProductRateQueryHandler();
