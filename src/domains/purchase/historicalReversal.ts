/**
 * Historical VAT and inventory-cost reversal from original purchase facts (Phase 8).
 * Never uses current tax configuration or current item cost.
 */

import type { LineRemainingBalance } from "./remainingBalance";
import { proportionMoney } from "./remainingBalance";

export type StockCondition =
  | "resalable"
  | "damaged"
  | "quarantine"
  | "scrap"
  | "repair"
  | "inspection_pending";

export interface HistoricalLineReversal {
  original_purchase_line_id: string;
  item_id: string;
  return_quantity: number;
  purchase_reversal: number;
  taxable_reversal: number;
  vat_reversal: number;
  cost_reversal: number;
  unit_cost: number;
  tax_rule_version: string | null;
  valuation_method: string | null;
  is_final_quantity_slice: boolean;
  stock_condition: StockCondition | null;
}

export function computeHistoricalPurchaseLineReversal(input: {
  balance: LineRemainingBalance;
  returnQuantity: number;
  taxRuleVersion: string | null;
  valuationMethod: string | null;
  stockCondition?: StockCondition | null;
  /** When true, absorb remaining VAT/purchase/cost rounding on this line */
  absorbRounding?: boolean;
}): HistoricalLineReversal {
  const { balance, returnQuantity } = input;
  if (returnQuantity <= 0) {
    throw Object.assign(new Error("Return quantity must be positive."), {
      code: "zero_return_quantity",
    });
  }
  if (returnQuantity > balance.remaining_returnable_quantity + 1e-9) {
    throw Object.assign(
      new Error(
        `Over-return: requested ${returnQuantity}, remaining ${balance.remaining_returnable_quantity}.`,
      ),
      { code: "over_return_quantity" },
    );
  }

  const remainingAfter = balance.remaining_returnable_quantity - returnQuantity;
  const isFinal =
    input.absorbRounding === true || Math.abs(remainingAfter) < 1e-6;

  const purchase = proportionMoney(
    balance.original_line_total,
    returnQuantity,
    balance.original_quantity,
    balance.remaining_debitable_total,
    isFinal,
  );
  const taxable = proportionMoney(
    balance.original_taxable,
    returnQuantity,
    balance.original_quantity,
    Math.max(0, balance.original_taxable - (balance.previously_debited_total - balance.previously_reversed_vat)),
    isFinal,
  );
  const vat = proportionMoney(
    balance.original_vat,
    returnQuantity,
    balance.original_quantity,
    balance.remaining_reversible_vat,
    isFinal,
  );
  const cost = proportionMoney(
    balance.original_cost_amount,
    returnQuantity,
    balance.original_quantity,
    balance.remaining_reversible_cost,
    isFinal,
  );

  return {
    original_purchase_line_id: balance.original_purchase_line_id,
    item_id: balance.item_id,
    return_quantity: returnQuantity,
    purchase_reversal: purchase,
    taxable_reversal: Math.min(taxable, purchase),
    vat_reversal: vat,
    cost_reversal: cost,
    unit_cost: balance.original_unit_cost,
    tax_rule_version: input.taxRuleVersion,
    valuation_method: input.valuationMethod,
    is_final_quantity_slice: isFinal,
    stock_condition: input.stockCondition ?? "resalable",
  };
}

/** Financial debit note: reverse amount from remaining debitable totals without stock. */
export function computeFinancialDebitReversal(input: {
  balance: LineRemainingBalance;
  debitAmount: number;
  taxRuleVersion: string | null;
}): HistoricalLineReversal {
  const { balance, debitAmount } = input;
  if (!(debitAmount > 0)) {
    throw Object.assign(new Error("Debit amount must be positive."), {
      code: "zero_debit_amount",
    });
  }
  if (debitAmount > balance.remaining_debitable_total + 0.009) {
    throw Object.assign(
      new Error(
        `Over-debit: requested ${debitAmount}, remaining ${balance.remaining_debitable_total}.`,
      ),
      { code: "over_debit_amount" },
    );
  }

  const ratio =
    balance.remaining_debitable_total > 0
      ? debitAmount / balance.remaining_debitable_total
      : 0;
  const vat = Math.min(
    balance.remaining_reversible_vat,
    Math.round(balance.remaining_reversible_vat * ratio * 100) / 100,
  );
  const taxable = Math.max(0, Math.round((debitAmount - vat) * 100) / 100);

  return {
    original_purchase_line_id: balance.original_purchase_line_id,
    item_id: balance.item_id,
    return_quantity: 0,
    purchase_reversal: debitAmount,
    taxable_reversal: taxable,
    vat_reversal: vat,
    cost_reversal: 0,
    unit_cost: 0,
    tax_rule_version: input.taxRuleVersion,
    valuation_method: null,
    is_final_quantity_slice: false,
    stock_condition: null,
  };
}
