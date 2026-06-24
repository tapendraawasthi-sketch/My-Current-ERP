// src/lib/taxUtils.ts

export interface LineForVAT {
  qty: number;
  rate: number;
  discount?: number; // percent
  vatExempt?: boolean;
  isTaxable?: boolean;
  vatRate?: number;
  itemName?: string;
}

export interface VATComputation {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  grandTotal: number;
  // Aliases used by OrderForm
  subTotal: number;
  taxableTotal: number;
  exemptTotal: number;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function computeInvoiceVAT(lines: LineForVAT[], vatRate = 13): VATComputation {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  let exemptAmount = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const gross = round2((line.qty || 0) * (line.rate || 0));
    const discAmt = round2(gross * ((line.discount || 0) / 100));
    const net = round2(gross - discAmt);
    subtotal += gross;
    totalDiscount += discAmt;
    const isExempt = line.vatExempt === true || line.isTaxable === false;
    if (isExempt) {
      exemptAmount += net;
    } else {
      taxableAmount += net;
      const lineVatRate = line.vatRate !== undefined ? line.vatRate : vatRate;
      vatAmount += round2(net * (lineVatRate / 100));
    }
  }

  const grandTotal = round2(taxableAmount + exemptAmount + vatAmount);

  return {
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    taxableAmount: round2(taxableAmount),
    exemptAmount: round2(exemptAmount),
    vatAmount: round2(vatAmount),
    grandTotal,
    // Aliases
    subTotal: round2(subtotal),
    taxableTotal: round2(taxableAmount),
    exemptTotal: round2(exemptAmount),
  };
}

// Used by OrderForm
export function computeVAT(lines: Array<{
  qty: number;
  rate: number;
  discount?: number;
  isTaxable?: boolean;
  vatRate?: number;
  itemName?: string;
}>): VATComputation {
  return computeInvoiceVAT(
    lines.map((l) => ({
      qty: l.qty,
      rate: l.rate,
      discount: l.discount || 0,
      vatExempt: l.isTaxable === false,
      vatRate: l.vatRate,
    }))
  );
}

export function validatePAN(pan: string): boolean {
  return /^\d{9}$/.test(pan.trim());
}

export function validateVAT(vat: string): boolean {
  return /^\d{9}$/.test(vat.trim());
}

export function computeTDS(amount: number, rate: number): number {
  return round2(amount * (rate / 100));
}

export const computeVatAnnexA = () => [];
export const computeVatAnnexB = () => [];
export const computeVatAnnexC = () => [];
export const computeVAT3Return = () => ({});

export const computeWithholdingTDS = () => ({});
