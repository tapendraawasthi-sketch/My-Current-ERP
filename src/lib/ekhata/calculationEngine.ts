/**
 * Nepal statutory calculation engine — VAT, SSF, TDS, discounts, totals.
 * Sits between entity extraction and journal generation.
 */

import { NEPAL_RATES } from "./types";

export interface VatBreakdown {
  gross: number;
  net: number;
  vat: number;
  inclusive: boolean;
}

export interface SsfBreakdown {
  basicSalary: number;
  employeeContribution: number;
  employerContribution: number;
  totalSsf: number;
  netPayable: number;
}

export interface TdsBreakdown {
  base: number;
  rate: number;
  tdsAmount: number;
  netPayable: number;
  category: "services" | "rent" | "goods" | "contract";
}

export interface DiscountBreakdown {
  gross: number;
  discount: number;
  net: number;
}

export function parseCommaAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₨Rs.\s]/gi, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function computeVat(amount: number, inclusive = false): VatBreakdown {
  if (inclusive) {
    const net = Math.round((amount / (1 + NEPAL_RATES.VAT)) * 100) / 100;
    const vat = Math.round((amount - net) * 100) / 100;
    return { gross: amount, net, vat, inclusive: true };
  }
  const vat = Math.round(amount * NEPAL_RATES.VAT * 100) / 100;
  const gross = Math.round((amount + vat) * 100) / 100;
  return { gross, net: amount, vat, inclusive: false };
}

export function computeSsf(basicSalary: number, ceiling?: number): SsfBreakdown {
  const base = ceiling ? Math.min(basicSalary, ceiling) : basicSalary;
  const employeeContribution = Math.round(base * NEPAL_RATES.SSF_EMPLOYEE * 100) / 100;
  const employerContribution = Math.round(base * NEPAL_RATES.SSF_EMPLOYER * 100) / 100;
  return {
    basicSalary: base,
    employeeContribution,
    employerContribution,
    totalSsf: Math.round((employeeContribution + employerContribution) * 100) / 100,
    netPayable: Math.round((base - employeeContribution) * 100) / 100,
  };
}

export function computeTds(base: number, category: TdsBreakdown["category"] = "services"): TdsBreakdown {
  const rateMap = {
    services: NEPAL_RATES.TDS_SERVICES,
    rent: NEPAL_RATES.TDS_RENT,
    goods: NEPAL_RATES.TDS_CONTRACT,
    contract: NEPAL_RATES.TDS_CONTRACT,
  };
  const rate = rateMap[category];
  const tdsAmount = Math.round(base * rate * 100) / 100;
  return {
    base,
    rate,
    tdsAmount,
    netPayable: Math.round((base - tdsAmount) * 100) / 100,
    category,
  };
}

export function computeDiscount(gross: number, discount: number): DiscountBreakdown {
  const net = Math.round((gross - discount) * 100) / 100;
  return { gross, discount, net: Math.max(0, net) };
}

export function sumAmounts(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** Detect VAT-inclusive phrasing in user text */
export function isVatInclusiveText(text: string): boolean {
  return /\b(vat\s*sanga|vat\s*included|gross|sabai\s*ma\s*vat|113\s*percent|13\s*%\s*included|vat\s*samet)\b/i.test(
    text,
  );
}

/** Infer TDS category from narration */
export function inferTdsCategory(text: string): TdsBreakdown["category"] {
  if (/\b(rent|bhada|bhaada|lease)\b/i.test(text)) return "rent";
  if (/\b(goods|saman|supply|material)\b/i.test(text)) return "goods";
  if (/\b(contract|construction|transport)\b/i.test(text)) return "contract";
  return "services";
}
