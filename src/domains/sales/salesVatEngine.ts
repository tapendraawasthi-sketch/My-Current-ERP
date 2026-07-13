/**
 * Deterministic Sales VAT engine — configuration + money utils, not LLM opinion.
 * Wraps taxUtils with paisa-safe totals and rule versioning.
 */

import {
  computeVatForLine,
  type VatClassificationRef,
  type VatTaxability,
} from "@/lib/taxUtils";
import { parseMoneyToPaisa, paisaToString, paisaToNumber } from "@/domains/purchase/money";

export type PriceMode = "exclusive" | "inclusive";

export interface SalesVatLineInput {
  itemId: string;
  quantity: string;
  rate: string;
  lineDiscount?: string;
  discountPercent?: number;
  isTaxable?: boolean;
  vatRate?: number;
  vatClassificationId?: string;
}

export interface SalesVatLineResult {
  item_id: string;
  gross: string;
  discount: string;
  taxable_amount: string;
  tax_rate: string;
  vat_amount: string;
  total: string;
  tax_treatment: VatTaxability | "out_of_scope";
  exempt_amount: string;
}

export interface SalesVatResult {
  rule_version: string;
  price_mode: PriceMode;
  subtotal: string;
  discount: string;
  taxable_amount: string;
  vat_amount: string;
  exempt_amount: string;
  zero_rated_amount: string;
  rounding_adjustment: string;
  grand_total: string;
  lines: SalesVatLineResult[];
}

/** Default rule when company has no dated tax config — uses configured rates only. */
export const DEFAULT_TAX_RULE_VERSION = "configured-rates-v1";

export function computeSalesVat(input: {
  transactionDate: string;
  priceMode?: PriceMode;
  invoiceDiscount?: string;
  items: SalesVatLineInput[];
  classifications?: VatClassificationRef[];
  /** When false / company not VAT-registered, all VAT forced to 0 */
  vatRegistered?: boolean;
  ruleVersion?: string;
}): SalesVatResult {
  const priceMode = input.priceMode || "exclusive";
  const vatRegistered = input.vatRegistered !== false;
  const ruleVersion = input.ruleVersion || DEFAULT_TAX_RULE_VERSION;
  const classifications = input.classifications || [];

  const lines: SalesVatLineResult[] = [];
  let subtotalP = 0;
  let discountP = 0;
  let taxableP = 0;
  let vatP = 0;
  let exemptP = 0;
  let zeroP = 0;

  for (const item of input.items) {
    const qty = Number(String(item.quantity).replace(/,/g, ""));
    const rate = paisaToNumber(parseMoneyToPaisa(item.rate));
    let discountPercent = item.discountPercent || 0;
    if (item.lineDiscount) {
      const grossP = Math.round(qty * parseMoneyToPaisa(item.rate));
      const discP = parseMoneyToPaisa(item.lineDiscount);
      discountPercent = grossP > 0 ? (discP / grossP) * 100 : 0;
    }

    let line = computeVatForLine(
      {
        qty,
        rate,
        discountPercent,
        isTaxable: vatRegistered ? item.isTaxable : false,
        vatRate: item.vatRate,
        vatClassificationId: item.vatClassificationId,
      },
      classifications,
    );

    if (priceMode === "inclusive" && line.isTaxable && line.vatRate > 0) {
      // Derive taxable + VAT from inclusive net
      const netP = parseMoneyToPaisa(String(line.netAmount.toFixed(2)));
      const rateFrac = line.vatRate / 100;
      const taxableFromIncl = Math.round(netP / (1 + rateFrac));
      const vatFromIncl = netP - taxableFromIncl;
      line = {
        ...line,
        taxableAmount: paisaToNumber(taxableFromIncl),
        vatAmount: paisaToNumber(vatFromIncl),
        totalAmount: paisaToNumber(netP),
        exemptAmount: 0,
      };
    }

    if (!vatRegistered) {
      line = {
        ...line,
        vatAmount: 0,
        taxableAmount: line.netAmount,
        isTaxable: false,
        taxability: "non_vat",
        vatRate: 0,
      };
    }

    const treatment: SalesVatLineResult["tax_treatment"] =
      line.taxability === "non_vat" ? "out_of_scope" : line.taxability;

    const grossStr = paisaToString(parseMoneyToPaisa(String(line.grossAmount.toFixed(2))));
    const discStr = paisaToString(parseMoneyToPaisa(String(line.discountAmount.toFixed(2))));
    const taxStr = paisaToString(parseMoneyToPaisa(String(line.taxableAmount.toFixed(2))));
    const vatStr = paisaToString(parseMoneyToPaisa(String(line.vatAmount.toFixed(2))));
    const totStr = paisaToString(parseMoneyToPaisa(String(line.totalAmount.toFixed(2))));
    const exStr = paisaToString(parseMoneyToPaisa(String(line.exemptAmount.toFixed(2))));

    subtotalP += parseMoneyToPaisa(grossStr);
    discountP += parseMoneyToPaisa(discStr);
    taxableP += parseMoneyToPaisa(taxStr);
    vatP += parseMoneyToPaisa(vatStr);
    if (treatment === "exempt") exemptP += parseMoneyToPaisa(exStr) || parseMoneyToPaisa(taxStr);
    if (treatment === "zero_rated") zeroP += parseMoneyToPaisa(taxStr);

    lines.push({
      item_id: item.itemId,
      gross: grossStr,
      discount: discStr,
      taxable_amount: taxStr,
      tax_rate: String(line.vatRate),
      vat_amount: vatStr,
      total: totStr,
      tax_treatment: treatment,
      exempt_amount: exStr,
    });
  }

  // Invoice-level discount: allocate proportionally to taxable bases (before VAT for exclusive)
  let invoiceDiscP = parseMoneyToPaisa(input.invoiceDiscount || "0");
  if (invoiceDiscP > 0 && taxableP + exemptP + zeroP > 0) {
    const base = taxableP + exemptP + zeroP;
    // Reduce taxable proportionally; recompute VAT on reduced taxable for exclusive
    const taxableShare = taxableP / base;
    const taxableDisc = Math.round(invoiceDiscP * taxableShare);
    const otherDisc = invoiceDiscP - taxableDisc;
    taxableP = Math.max(0, taxableP - taxableDisc);
    exemptP = Math.max(0, exemptP - Math.round(otherDisc * (exemptP / Math.max(1, exemptP + zeroP))));
    if (priceMode === "exclusive" && vatP > 0 && taxableP + taxableDisc > 0) {
      // Scale VAT by taxable reduction
      const factor = taxableDisc > 0 ? taxableP / (taxableP + taxableDisc) : 1;
      vatP = Math.round(vatP * factor);
    }
    discountP += invoiceDiscP;
  }

  const grandP = taxableP + exemptP + zeroP + vatP;
  return {
    rule_version: ruleVersion,
    price_mode: priceMode,
    subtotal: paisaToString(subtotalP),
    discount: paisaToString(discountP),
    taxable_amount: paisaToString(taxableP),
    vat_amount: paisaToString(vatP),
    exempt_amount: paisaToString(exemptP),
    zero_rated_amount: paisaToString(zeroP),
    rounding_adjustment: "0.00",
    grand_total: paisaToString(grandP),
    lines,
  };
}
