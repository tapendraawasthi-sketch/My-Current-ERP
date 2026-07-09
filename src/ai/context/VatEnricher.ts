/** SUTRA AI — Nepal VAT (13%) breakdown on amounts */

import type { ExtractedEntities, VatBreakdown } from "../types";

const VAT_RATE = 0.13;

export class VatEnricher {
  shouldApply(text: string): boolean {
    return /\b(vat|biyet|bhyat|tax|13\s*%|vat\s*sahit|vat\s*included)\b/i.test(text);
  }

  splitGross(gross: number): VatBreakdown {
    const net = Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
    return { gross, net, vat, rate: VAT_RATE, inclusive: true };
  }

  addVat(net: number): VatBreakdown {
    const vat = Math.round(net * VAT_RATE * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;
    return { gross, net, vat, rate: VAT_RATE, inclusive: false };
  }

  enrich(entities: ExtractedEntities, text: string): ExtractedEntities {
    if (!this.shouldApply(text)) return entities;
    const amount = entities.amount;
    if (!amount || amount <= 0) return entities;

    const inclusive = /\b(sahit|included|samma)\b/i.test(text);
    const breakdown = inclusive ? this.splitGross(amount) : this.addVat(amount);

    return {
      ...entities,
      vatBreakdown: breakdown,
      amount: breakdown.gross,
    };
  }
}

export const vatEnricher = new VatEnricher();
