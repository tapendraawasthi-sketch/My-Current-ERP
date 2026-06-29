// @ts-nocheck
/**
 * Nepal IRD progressive income‑tax slabs (FY 2081/82 – 2082/83)
 * Single individual exemption: NPR 4,00,000
 * Married individual exemption: NPR 5,00,000
 * Slabs apply to income ABOVE the exemption threshold.
 */

export interface TaxSlab {
  upTo: number;       // income limit (Infinity for last slab)
  rate: number;       // tax rate as fraction (0.01 = 1%)
}

export const NEPAL_TAX_SLABS: TaxSlab[] = [
  { upTo: 100000,   rate: 0.01  },   // 1%  on first   1,00,000
  { upTo: 200000,   rate: 0.10  },   // 10% on next    2,00,000
  { upTo: 400000,   rate: 0.20  },   // 20% on next    4,00,000
  { upTo: 1100000,  rate: 0.30  },   // 30% on next   11,00,000
  { upTo: Infinity, rate: 0.36  },   // 36% on balance
];

/**
 * Compute annual tax on taxable income (after exemption & EPF/CIT deductions).
 * @param taxableIncome – amount AFTER personal exemption
 */
export function computeNepalTDS(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let remaining = taxableIncome;
  let tax = 0;
  let prev = 0;

  for (const slab of NEPAL_TAX_SLABS) {
    const slabWidth = slab.upTo === Infinity ? remaining : slab.upTo - prev;
    const taxable = Math.min(remaining, slabWidth);
    tax += taxable * slab.rate;
    remaining -= taxable;
    prev = slab.upTo === Infinity ? prev : slab.upTo;
    if (remaining <= 0) break;
  }
  return Math.round(tax);
}

/** EPF contribution rates */
export const EPF_EMPLOYEE_RATE = 0.10;   // 10% of basic
export const EPF_EMPLOYER_RATE = 0.10;   // 10% of basic

/** SSF contribution rates */
export const SSF_EMPLOYEE_RATE = 0.01;   // 1% of gross
export const SSF_EMPLOYER_RATE = 0.0333; // 3.33% of gross

/** CIT optional deduction rate */
export const CIT_RATE = 0.10;            // 10% of basic

/** Personal exemptions (annual) */
export const EXEMPTION_SINGLE  = 400000;
export const EXEMPTION_MARRIED = 500000;

/** Format Nepali rupees */
export function fmtNPR(n: number): string {
  return "NPR " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
