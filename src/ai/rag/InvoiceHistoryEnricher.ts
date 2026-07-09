/** SUTRA AI — enrich entities from recent invoice history */

import type { ErpRagContext, ExtractedEntities } from "../types";

export class InvoiceHistoryEnricher {
  enrich(entities: ExtractedEntities, ctx?: ErpRagContext): ExtractedEntities {
    if (!ctx?.recentInvoices?.length) return entities;

    const enriched = { ...entities };
    const party = enriched.partyResolvedName ?? enriched.party;
    const product = enriched.product?.toLowerCase();

    for (const inv of ctx.recentInvoices) {
      if (party && inv.partyName && !inv.partyName.toLowerCase().includes(party.toLowerCase())) {
        continue;
      }

      if (product && inv.lines?.length) {
        const line = inv.lines.find((l) =>
          l.itemName?.toLowerCase().includes(product),
        );
        if (line) {
          if (!enriched.itemRate && line.rate) enriched.itemRate = line.rate;
          if (!enriched.quantity && line.qty) enriched.quantity = line.qty;
          if (!enriched.amount && line.rate && line.qty) {
            enriched.amount = line.rate * line.qty;
          }
          break;
        }
      }

      if (!product && party && inv.partyName?.toLowerCase().includes(party.toLowerCase())) {
        if (!enriched.amount && inv.grandTotal) enriched.amount = inv.grandTotal;
        break;
      }
    }

    return enriched;
  }
}

export const invoiceHistoryEnricher = new InvoiceHistoryEnricher();
