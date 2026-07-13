/**
 * Authoritative Sales cost allocation — persists exact unit/total cost at posting time.
 * Device B must apply these facts; must not revalue from mutable item.costPrice.
 */

import type { SutraERPDatabase, DBItem } from "@/lib/db";
import { generateId } from "@/lib/db";
import { parseMoneyToPaisa, paisaToString, paisaToNumber } from "@/domains/purchase/money";
import type { ValuationMethod } from "./inventoryAccountingPolicy";

export interface CostLayerConsume {
  layer_id: string;
  source_purchase_id: string | null;
  quantity_consumed: string;
  unit_cost: string;
  cost: string;
}

export interface SalesLineCostAllocation {
  id: string;
  posting_id: string;
  invoice_id: string;
  sales_line_id: string;
  item_id: string;
  warehouse_id: string;
  quantity: string;
  valuation_method: ValuationMethod;
  unit_cost: string;
  total_cost: string;
  valuation_version: number;
  valued_at: string;
  source_layers: CostLayerConsume[];
  company_id: string;
}

function moneyFromNumber(n: number): string {
  return paisaToString(Math.round(n * 100));
}

/**
 * Compute moving weighted-average unit cost from stock movements (qty-weighted).
 * Falls back to item.costPrice / purchaseRate / 0.
 */
export async function computeMovingWeightedAverageUnitCost(
  db: SutraERPDatabase,
  itemId: string,
  warehouseId: string,
  asOfDate: string,
  item: DBItem,
): Promise<{ unitCost: number; valuationVersion: number }> {
  const movements = await db.stockMovements.where("itemId").equals(itemId).toArray();
  let qty = 0;
  let value = 0;
  const sorted = movements
    .filter((m) => (m.warehouseId || "wh-main") === warehouseId && String(m.date || "") <= asOfDate)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  for (const m of sorted) {
    const q = Number(m.qty || 0);
    const absQ = Math.abs(q);
    const unit =
      absQ > 0
        ? Math.abs(Number(m.amount || 0)) / absQ
        : Number(m.rate || 0);
    if (q >= 0) {
      qty += absQ;
      value += absQ * unit;
    } else {
      // outward reduces qty at current average
      const avg = qty > 0 ? value / qty : unit;
      qty = Math.max(0, qty - absQ);
      value = Math.max(0, qty * avg);
    }
  }

  if (qty > 0 && value > 0) {
    return { unitCost: value / qty, valuationVersion: sorted.length };
  }

  const fallback = Number(
    (item as { costPrice?: number }).costPrice ||
      (item as { purchaseRate?: number }).purchaseRate ||
      0,
  );
  return { unitCost: fallback, valuationVersion: sorted.length };
}

export async function allocateSalesLineCost(input: {
  db: SutraERPDatabase;
  postingId: string;
  invoiceId: string;
  salesLineId: string;
  item: DBItem;
  warehouseId: string;
  quantity: number;
  transactionDate: string;
  valuationMethod: ValuationMethod;
  companyId: string;
  nowIso: string;
}): Promise<SalesLineCostAllocation> {
  const { db, item, warehouseId, quantity, transactionDate, valuationMethod } = input;

  let unitCost = 0;
  let valuationVersion = 1;
  const layers: CostLayerConsume[] = [];

  if (valuationMethod === "moving_weighted_average") {
    const wma = await computeMovingWeightedAverageUnitCost(
      db,
      item.id,
      warehouseId,
      transactionDate,
      item,
    );
    unitCost = wma.unitCost;
    valuationVersion = wma.valuationVersion || 1;
    layers.push({
      layer_id: `wma-${item.id}-${valuationVersion}`,
      source_purchase_id: null,
      quantity_consumed: String(quantity),
      unit_cost: moneyFromNumber(unitCost),
      cost: moneyFromNumber(unitCost * quantity),
    });
  } else if (valuationMethod === "fifo") {
    // Minimal FIFO from positive movements (oldest first) — ephemeral layers
    const movements = await db.stockMovements.where("itemId").equals(item.id).toArray();
    const ins = movements
      .filter(
        (m) =>
          (m.warehouseId || "wh-main") === warehouseId &&
          Number(m.qty || 0) > 0 &&
          String(m.date || "") <= transactionDate,
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let remaining = quantity;
    let total = 0;
    for (const layer of ins) {
      if (remaining <= 0) break;
      const avail = Number(layer.qty || 0);
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      const u =
        avail > 0 ? Math.abs(Number(layer.amount || 0)) / avail : Number(layer.rate || 0);
      total += take * u;
      layers.push({
        layer_id: String(layer.id),
        source_purchase_id: String(layer.referenceId || "") || null,
        quantity_consumed: String(take),
        unit_cost: moneyFromNumber(u),
        cost: moneyFromNumber(take * u),
      });
      remaining -= take;
    }
    if (remaining > 0) {
      const fb = Number((item as { costPrice?: number }).costPrice || 0);
      total += remaining * fb;
      layers.push({
        layer_id: `fallback-${item.id}`,
        source_purchase_id: null,
        quantity_consumed: String(remaining),
        unit_cost: moneyFromNumber(fb),
        cost: moneyFromNumber(remaining * fb),
      });
      remaining = 0;
    }
    unitCost = quantity > 0 ? total / quantity : 0;
    valuationVersion = layers.length;
  } else {
    // standard_cost / current_item_cost_legacy
    unitCost = Number(
      (item as { standardCost?: number }).standardCost ||
        (item as { costPrice?: number }).costPrice ||
        (item as { purchaseRate?: number }).purchaseRate ||
        0,
    );
    layers.push({
      layer_id: `legacy-${item.id}`,
      source_purchase_id: null,
      quantity_consumed: String(quantity),
      unit_cost: moneyFromNumber(unitCost),
      cost: moneyFromNumber(unitCost * quantity),
    });
  }

  const totalCost = unitCost * quantity;
  // Canonical money strings
  const unitStr = moneyFromNumber(unitCost);
  const totalStr = paisaToString(parseMoneyToPaisa(unitStr) * quantity);

  return {
    id: generateId(),
    posting_id: input.postingId,
    invoice_id: input.invoiceId,
    sales_line_id: input.salesLineId,
    item_id: item.id,
    warehouse_id: warehouseId,
    quantity: String(quantity),
    valuation_method: valuationMethod,
    unit_cost: unitStr,
    total_cost: moneyFromNumber(paisaToNumber(parseMoneyToPaisa(unitStr)) * quantity),
    valuation_version: valuationVersion,
    valued_at: input.nowIso,
    source_layers: layers,
    company_id: input.companyId,
  };
}

export function sumAllocationCosts(allocations: SalesLineCostAllocation[]): string {
  let paisa = 0;
  for (const a of allocations) {
    paisa += parseMoneyToPaisa(a.total_cost);
  }
  return paisaToString(paisa);
}
