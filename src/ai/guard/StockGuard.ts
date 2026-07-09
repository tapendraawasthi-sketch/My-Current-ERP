/** SUTRA AI — warn when sale qty exceeds available stock */

import type { ErpRagContext, ExtractedEntities, IntentClassification } from "../types";

export interface StockWarning {
  nepali: string;
  english: string;
  roman: string;
}

export class StockGuard {
  check(
    entities: ExtractedEntities,
    intent: IntentClassification | undefined,
    ctx?: ErpRagContext,
  ): StockWarning | null {
    const isSale =
      intent?.intent === "SALES_ENTRY" ||
      entities.transactionType === "sales";
    if (!isSale || !ctx?.items?.length) return null;

    const item =
      (entities.itemId && ctx.items.find((i) => i.id === entities.itemId)) ||
      ctx.items.find((i) =>
        entities.product &&
        i.name.toLowerCase().includes(entities.product.toLowerCase()),
      );
    if (!item) return null;

    const stock = item.stockQty ?? 0;
    const needed = entities.quantity ?? 1;
    if (needed <= stock) return null;

    const unit = entities.unit ?? item.unit ?? "units";
    return {
      nepali: `⚠️ ${item.name} को स्टक ${stock} ${unit} मात्र छ — ${needed} ${unit} बेच्न मिल्दैन।`,
      english: `⚠️ Only ${stock} ${unit} of ${item.name} in stock — cannot sell ${needed} ${unit}.`,
      roman: `⚠️ ${item.name} stock ${stock} ${unit} matra cha — ${needed} bechna mildaina.`,
    };
  }
}

export const stockGuard = new StockGuard();
