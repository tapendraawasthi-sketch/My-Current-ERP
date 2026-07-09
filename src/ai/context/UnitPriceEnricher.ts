/** SUTRA AI — derive amount from qty × rate (or vice versa) */

import type { ExtractedEntities } from "../types";

export class UnitPriceEnricher {
  enrich(entities: ExtractedEntities): ExtractedEntities {
    const enriched = { ...entities };
    const qty = enriched.quantity;
    const rate = enriched.itemRate;
    const amount = enriched.amount;

    if (qty != null && qty > 0 && rate != null && rate > 0) {
      if (!amount || amount <= 0) {
        enriched.amount = Math.round(qty * rate * 100) / 100;
      } else if (!enriched.itemRate || enriched.itemRate <= 0) {
        enriched.itemRate = Math.round((amount / qty) * 100) / 100;
      }
    }

    if (enriched.lines?.length) {
      enriched.lines = enriched.lines.map((line) => {
        const l = { ...line };
        if (l.quantity && l.itemRate && (!l.amount || l.amount <= 0)) {
          l.amount = Math.round(l.quantity * l.itemRate * 100) / 100;
        }
        return l;
      });
      const total = enriched.lines.reduce((s, l) => s + (l.amount ?? 0), 0);
      if (total > 0) enriched.amount = total;
    }

    return enriched;
  }
}

export const unitPriceEnricher = new UnitPriceEnricher();
