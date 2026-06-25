// src/lib/taxEngine.ts
// Line-Level Tax Engine — PDF §"Tax Calculation Engine: Line-Level vs Document-Level"
// Each line's tax is rounded to exactly 2 decimals, THEN aggregated.

export interface TaxLineInput {
  qty: number;
  unitPrice: number;
  discountPercent?: number; // 0-100
  taxRate: number;          // e.g. 13 for 13% VAT
  isTaxable?: boolean;
}

export interface TaxLineResult {
  taxableValue: number;
  taxAmount: number;
  lineTotal: number;
}

export interface DocumentTaxResult {
  lines: TaxLineResult[];
  subTotal: number;     // sum of taxable values (pre-tax)
  totalTax: number;     // sum of per-line rounded taxes
  grandTotal: number;
}

/** Round to exactly 2 decimal places (HALF_UP) — matches Shopify/POS line-level math. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Compute tax for ONE line, rounding the line tax to 2dp (PDF requirement). */
export function computeLineLevelTax(line: TaxLineInput): TaxLineResult {
  const gross = round2(line.qty * line.unitPrice);
  const discount = round2(gross * ((line.discountPercent || 0) / 100));
  const taxableValue = round2(gross - discount);
  const taxAmount =
    line.isTaxable === false ? 0 : round2(taxableValue * (line.taxRate / 100));
  return {
    taxableValue,
    taxAmount,
    lineTotal: round2(taxableValue + taxAmount),
  };
}

/** Aggregate document tax = exact sum of already-rounded line taxes. */
export function computeDocumentTax(lines: TaxLineInput[]): DocumentTaxResult {
  const results = lines.map(computeLineLevelTax);
  const subTotal = round2(results.reduce((s, l) => s + l.taxableValue, 0));
  const totalTax = round2(results.reduce((s, l) => s + l.taxAmount, 0));
  return {
    lines: results,
    subTotal,
    totalTax,
    grandTotal: round2(subTotal + totalTax),
  };
}
