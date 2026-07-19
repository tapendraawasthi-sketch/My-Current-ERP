/** SUTRA AI — enrich extracted entities with ERP RAG matches */

import type { ErpRagContext, ExtractedEntities } from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { invoiceHistoryEnricher } from "./InvoiceHistoryEnricher";
import { unitPriceEnricher } from "../context/UnitPriceEnricher";
import { vatEnricher } from "../context/VatEnricher";
import { paymentModeEnricher } from "../context/PaymentModeEnricher";

const PARTY_MARKERS = /\b([a-z\u0900-\u097F]{2,20})\s+(lai|le|ko|sanga|bata)\b/i;

/** MAI-08 slice 1 — hard abstention floors for high-risk master binds (ADR_0025). */
export const MAI08_PARTY_SCORE_FLOOR = 0.75;
export const MAI08_ITEM_SCORE_FLOOR = 0.78;
export const MAI08_MIN_SCORE_GAP = 0.12;

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
      if (top && top.score >= MAI08_ITEM_SCORE_FLOOR) {
        const closeSecond =
          itemHits.length > 1 &&
          itemHits[1].score >= MAI08_ITEM_SCORE_FLOOR &&
          top.score - itemHits[1].score < MAI08_MIN_SCORE_GAP;

        if (closeSecond) {
          enriched.itemAmbiguous = itemHits.slice(0, 3).map((h) => h.ref.name);
          // Keep surface query; do not silent-bind itemId
          delete enriched.itemId;
        } else {
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

      if (top && top.score >= MAI08_PARTY_SCORE_FLOOR) {
        const closeSecond =
          partyHits.length > 1 &&
          partyHits[1].score >= MAI08_PARTY_SCORE_FLOOR &&
          top.score - partyHits[1].score < MAI08_MIN_SCORE_GAP;

        if (closeSecond) {
          enriched.partyAmbiguous = partyHits.slice(0, 3).map((h) => h.ref.name);
          enriched.party = partyQuery;
          delete enriched.partyId;
          delete enriched.partyResolvedName;
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
