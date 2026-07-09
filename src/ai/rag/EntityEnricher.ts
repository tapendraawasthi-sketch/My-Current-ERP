/** SUTRA AI — enrich extracted entities with ERP RAG matches */

import type { ErpRagContext, ExtractedEntities } from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { invoiceHistoryEnricher } from "./InvoiceHistoryEnricher";
import { unitPriceEnricher } from "../context/UnitPriceEnricher";
import { vatEnricher } from "../context/VatEnricher";
import { paymentModeEnricher } from "../context/PaymentModeEnricher";

const PARTY_MARKERS = /\b([a-z\u0900-\u097F]{2,20})\s+(lai|le|ko|sanga|bata)\b/i;

export class EntityEnricher {
  enrich(
    entities: ExtractedEntities,
    input: string,
    ctx?: ErpRagContext,
  ): ExtractedEntities {
    if (!ctx) return entities;

    const enriched: ExtractedEntities = { ...entities };

    // Stock item RAG (prefer live inventory over static catalog)
    const productQuery = enriched.product ?? enriched.productEnglish;
    if (productQuery && ctx.items?.length) {
      const itemHits = erpRagRetriever.findItems(productQuery, ctx.items, 3);
      const top = itemHits[0];
      if (top && top.score >= 0.65) {
        const ambiguous =
          itemHits.length > 1 &&
          itemHits[1].score >= 0.65 &&
          top.score - itemHits[1].score < 0.08;

        if (!ambiguous) {
          enriched.itemId = top.ref.id;
          enriched.product = top.ref.name;
          enriched.productEnglish = top.ref.name;
          enriched.productNepali = top.ref.nameNepali ?? enriched.productNepali;
          enriched.itemRate = top.ref.saleRate;
          enriched.ragConfidence = top.score;
          if (!enriched.unit && top.ref.unit) enriched.unit = top.ref.unit;
        }
      }
    }

    // Party RAG
    let partyQuery = enriched.party;
    if (!partyQuery) {
      const m = input.match(PARTY_MARKERS);
      if (m && !["ma", "timi", "tapai", "maile"].includes(m[1].toLowerCase())) {
        partyQuery = m[1];
      }
    }

    if (partyQuery && ctx.parties?.length) {
      const partyHits = erpRagRetriever.findParties(partyQuery, ctx.parties, 4);
      const top = partyHits[0];

      if (top && top.score >= 0.62) {
        const closeSecond =
          partyHits.length > 1 &&
          partyHits[1].score >= 0.62 &&
          top.score - partyHits[1].score < 0.1;

        if (closeSecond) {
          enriched.partyAmbiguous = partyHits.slice(0, 3).map((h) => h.ref.name);
          enriched.party = partyQuery;
        } else {
          enriched.partyId = top.ref.id;
          enriched.party = top.ref.name;
          enriched.partyResolvedName = top.ref.name;
          enriched.ragConfidence = Math.max(enriched.ragConfidence ?? 0, top.score);
        }
      }
    }

    return paymentModeEnricher.enrich(
      vatEnricher.enrich(
        unitPriceEnricher.enrich(
          invoiceHistoryEnricher.enrich(enriched, ctx),
        ),
        input,
      ),
      input,
    );
  }

  enrichLines(
    entities: ExtractedEntities,
    input: string,
    ctx?: ErpRagContext,
  ): ExtractedEntities {
    if (!entities.lines?.length) return entities;

    const lines = entities.lines.map((line) => {
      const partial = this.enrich(
        {
          product: line.product,
          productEnglish: line.productEnglish,
          amount: line.amount,
          quantity: line.quantity,
          unit: line.unit,
        },
        input,
        ctx,
      );
      return {
        ...line,
        product: partial.product ?? line.product,
        productEnglish: partial.productEnglish ?? line.productEnglish,
        productNepali: partial.productNepali ?? line.productNepali,
        itemId: partial.itemId ?? line.itemId,
        itemRate: partial.itemRate ?? line.itemRate,
      };
    });

    const totalAmount = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);

    return paymentModeEnricher.enrich(
      vatEnricher.enrich(
        unitPriceEnricher.enrich({
          ...entities,
          lines,
          amount: totalAmount > 0 ? totalAmount : entities.amount,
        }),
        input,
      ),
      input,
    );
  }
}

export const entityEnricher = new EntityEnricher();
