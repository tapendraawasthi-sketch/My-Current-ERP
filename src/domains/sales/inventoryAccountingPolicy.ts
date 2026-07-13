/**
 * Explicit company inventory accounting + valuation policies (Phase 6.5).
 * Defaults preserve pre-6.5 periodic behaviour unless company opts into perpetual.
 */

export type InventoryAccountingMode = "periodic" | "perpetual";

export type ValuationMethod =
  | "fifo"
  | "moving_weighted_average"
  | "standard_cost"
  | "current_item_cost_legacy";

export type NegativeStockPolicy = "block" | "warn_and_allow" | "allow";

export interface CompanyInventoryPolicy {
  inventoryAccounting: InventoryAccountingMode;
  valuationMethod: ValuationMethod;
  negativeStock: NegativeStockPolicy;
  salesAccountId: string;
  outputVatAccountId: string;
  receivableAccountId: string;
  inventoryAccountId: string;
  cogsAccountId: string;
}

export const DEFAULT_INVENTORY_POLICY: CompanyInventoryPolicy = {
  inventoryAccounting: "periodic",
  valuationMethod: "current_item_cost_legacy",
  negativeStock: "block",
  salesAccountId: "acc-sales",
  outputVatAccountId: "acc-vat-payable",
  receivableAccountId: "acc-sundry-debtors",
  inventoryAccountId: "acc-inventory",
  cogsAccountId: "acc-cogs",
};

/** E2E Sales company uses perpetual + MWA so integrity gates are deterministic. */
export const E2E_SALES_INVENTORY_POLICY: CompanyInventoryPolicy = {
  ...DEFAULT_INVENTORY_POLICY,
  inventoryAccounting: "perpetual",
  valuationMethod: "moving_weighted_average",
  negativeStock: "block",
};

export function mapConfigValuationMethod(
  raw: string | null | undefined,
): ValuationMethod {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (v === "fifo") return "fifo";
  if (
    v === "moving_weighted_average" ||
    v === "weighted_average" ||
    v === "average" ||
    v === "wa"
  ) {
    return "moving_weighted_average";
  }
  if (v === "standard" || v === "standard_cost") return "standard_cost";
  if (v === "current_item_cost_legacy" || v === "legacy" || v === "item_cost") {
    return "current_item_cost_legacy";
  }
  return "current_item_cost_legacy";
}

export function resolveCompanyInventoryPolicy(
  settings: Record<string, unknown> | null | undefined,
): CompanyInventoryPolicy {
  const s = settings || {};
  const accountingRaw = String(
    s.inventoryAccountingMode || s.inventoryAccounting || "",
  ).toLowerCase();
  const inventoryAccounting: InventoryAccountingMode =
    accountingRaw === "perpetual" ? "perpetual" : "periodic";

  const allowNeg = s.allowNegativeStock === true;
  const negRaw = String(s.negativeStockPolicy || "").toLowerCase();
  let negativeStock: NegativeStockPolicy = allowNeg ? "allow" : "block";
  if (negRaw === "warn_and_allow" || negRaw === "warn") negativeStock = "warn_and_allow";
  if (negRaw === "allow") negativeStock = "allow";
  if (negRaw === "block") negativeStock = "block";

  return {
    inventoryAccounting,
    valuationMethod: mapConfigValuationMethod(
      String(s.stockValuationMethod || s.valuationMethod || ""),
    ),
    negativeStock,
    salesAccountId: String(s.defaultSalesAccount || DEFAULT_INVENTORY_POLICY.salesAccountId),
    outputVatAccountId: String(
      s.outputVatAccountId || DEFAULT_INVENTORY_POLICY.outputVatAccountId,
    ),
    receivableAccountId: String(
      s.receivableAccountId || DEFAULT_INVENTORY_POLICY.receivableAccountId,
    ),
    inventoryAccountId: String(
      s.inventoryAccountId || DEFAULT_INVENTORY_POLICY.inventoryAccountId,
    ),
    cogsAccountId: String(s.cogsAccountId || DEFAULT_INVENTORY_POLICY.cogsAccountId),
  };
}
