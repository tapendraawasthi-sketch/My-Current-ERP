// src/lib/inventoryValuation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure synchronous inventory costing engine.
// Works entirely on pre-loaded arrays — zero async, zero DB calls.
// Default method: Weighted Average (Nepal standard).
// ─────────────────────────────────────────────────────────────────────────────

export type ValuationMethod = "weighted-average" | "fifo";

// ── Input types (subset of DB types) ─────────────────────────────────────────

export interface RawMovement {
  id: string;
  date: string; // YYYY-MM-DD (AD)
  dateNepali?: string; // BS label if already stored
  type: string; // "opening" | "sales-invoice" | "purchase-invoice" | etc.
  itemId: string;
  warehouseId?: string;
  qty: number; // positive = inward, negative = outward
  rate: number;
  amount: number;
  referenceNo?: string;
  referenceType?: string;
  narration?: string;
}

export interface RawItem {
  id: string;
  name?: string;
  openingStock?: number;
  openingStockRate?: number;
  groupId?: string;
  [key: string]: any;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface ValuationRow {
  movementId: string;
  date: string; // AD
  type: string;
  voucherNo: string;
  voucherType: string;
  // Inward
  inQty: number;
  inRate: number;
  inValue: number;
  // Outward
  outQty: number;
  outRate: number;
  outValue: number;
  // Running balance
  balQty: number;
  balRate: number;
  balValue: number;
}

export interface ValuationResult {
  itemId: string;
  method: ValuationMethod;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  totalInQty: number;
  totalInValue: number;
  totalOutQty: number;
  totalOutValue: number;
  closingQty: number;
  closingValue: number;
  weightedAvgRate: number; // current running WA rate at close
  movements: ValuationRow[];
}

// ── FIFO internal lot ─────────────────────────────────────────────────────────

interface FifoLot {
  date: string;
  qty: number;
  rate: number;
  remainingQty: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r2 = (n: number) => Math.round(n * 100) / 100;

function voucherTypeLabel(type: string): string {
  const MAP: Record<string, string> = {
    opening: "Opening Stock",
    "sales-invoice": "Sales Invoice",
    "purchase-invoice": "Purchase Invoice",
    "sales-return": "Sales Return",
    "purchase-return": "Purchase Return",
    "stock-journal": "Stock Journal",
    "delivery-challan": "Delivery Challan",
    "goods-receipt": "GRN",
    "material-issued": "Material Issued",
    "material-received": "Material Received",
    production: "Production",
    unassemble: "Unassemble",
    "physical-stock": "Physical Stock",
    transfer: "Stock Transfer",
    adjustment: "Adjustment",
    reversal: "Reversal",
  };
  return MAP[type] ?? type;
}

/** Filter, sort, and optionally clip movements for a single item/warehouse. */
function prepareMovements(
  allMovements: RawMovement[],
  itemId: string,
  warehouseId: string | null,
  upToDate: string | null,
): RawMovement[] {
  return allMovements
    .filter((m) => {
      if (m.itemId !== itemId) return false;
      if (warehouseId && m.warehouseId && m.warehouseId !== warehouseId) return false;
      if (upToDate && m.date > upToDate) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      // "opening" type always sorts first on same date
      if (a.type === "opening" && b.type !== "opening") return -1;
      if (b.type === "opening" && a.type !== "opening") return 1;
      return 0;
    });
}

// ── Weighted Average ──────────────────────────────────────────────────────────

/**
 * Compute running weighted average for an item.
 *
 * @param allMovements  Pre-loaded array of ALL stock movements
 * @param item          The item master record
 * @param warehouseId   Null = all warehouses combined
 * @param upToDate      Null = no cut-off (include everything)
 */
export function computeWeightedAverage(
  allMovements: RawMovement[],
  item: RawItem,
  warehouseId: string | null = null,
  upToDate: string | null = null,
): ValuationResult {
  const sorted = prepareMovements(allMovements, item.id, warehouseId, upToDate);

  const rows: ValuationRow[] = [];
  let balQty = 0;
  let balValue = 0;

  // Track opening snapshot (first inward movement before any outward)
  let openingQty = 0;
  let openingRate = 0;
  let openingValue = 0;
  let seenOpening = false;

  let totalInQty = 0;
  let totalInValue = 0;
  let totalOutQty = 0;
  let totalOutValue = 0;

  for (const m of sorted) {
    const absQty = Math.abs(m.qty);
    const isInward = m.qty > 0;
    const vType = voucherTypeLabel(m.type);

    if (isInward) {
      // Weighted average recalculation
      balQty = r4(balQty + absQty);
      balValue = r4(balValue + r4(absQty * m.rate));
      const balRate = balQty > 0 ? r4(balValue / balQty) : 0;

      // Snapshot opening
      if (!seenOpening && m.type === "opening") {
        openingQty = absQty;
        openingRate = m.rate;
        openingValue = r2(absQty * m.rate);
        seenOpening = true;
      }

      totalInQty += absQty;
      totalInValue += r4(absQty * m.rate);

      rows.push({
        movementId: m.id,
        date: m.date,
        type: m.type,
        voucherNo: m.referenceNo ?? m.id.slice(-6).toUpperCase(),
        voucherType: vType,
        inQty: absQty,
        inRate: m.rate,
        inValue: r2(absQty * m.rate),
        outQty: 0,
        outRate: 0,
        outValue: 0,
        balQty,
        balRate,
        balValue: r2(balValue),
      });
    } else if (m.qty < 0) {
      // Issue at current weighted average
      const currentAvg = balQty > 0 ? r4(balValue / balQty) : 0;
      const outValue = r2(absQty * currentAvg);

      balQty = r4(balQty - absQty);
      balValue = r4(balValue - outValue);
      if (balQty <= 0) {
        balQty = 0;
        balValue = 0;
      }
      const balRate = balQty > 0 ? r4(balValue / balQty) : currentAvg;

      totalOutQty += absQty;
      totalOutValue += outValue;

      rows.push({
        movementId: m.id,
        date: m.date,
        type: m.type,
        voucherNo: m.referenceNo ?? m.id.slice(-6).toUpperCase(),
        voucherType: vType,
        inQty: 0,
        inRate: 0,
        inValue: 0,
        outQty: absQty,
        outRate: currentAvg,
        outValue,
        balQty,
        balRate,
        balValue: r2(balValue),
      });
    }
  }

  const weightedAvgRate = balQty > 0 ? r4(balValue / balQty) : 0;

  return {
    itemId: item.id,
    method: "weighted-average",
    openingQty,
    openingRate,
    openingValue,
    totalInQty: r4(totalInQty),
    totalInValue: r2(totalInValue),
    totalOutQty: r4(totalOutQty),
    totalOutValue: r2(totalOutValue),
    closingQty: r4(balQty),
    closingValue: r2(balValue),
    weightedAvgRate,
    movements: rows,
  };
}

// ── FIFO ──────────────────────────────────────────────────────────────────────

/**
 * Compute FIFO costing — oldest lot consumed first.
 *
 * @param allMovements  Pre-loaded array of ALL stock movements
 * @param item          The item master record
 * @param warehouseId   Null = all warehouses combined
 * @param upToDate      Null = no cut-off
 */
export function computeFIFO(
  allMovements: RawMovement[],
  item: RawItem,
  warehouseId: string | null = null,
  upToDate: string | null = null,
): ValuationResult {
  const sorted = prepareMovements(allMovements, item.id, warehouseId, upToDate);

  const rows: ValuationRow[] = [];
  const lots: FifoLot[] = []; // queue — front = oldest
  let balQty = 0;
  let balValue = 0;

  let openingQty = 0;
  let openingRate = 0;
  let openingValue = 0;
  let seenOpening = false;

  let totalInQty = 0;
  let totalInValue = 0;
  let totalOutQty = 0;
  let totalOutValue = 0;

  for (const m of sorted) {
    const absQty = Math.abs(m.qty);
    const isInward = m.qty > 0;
    const vType = voucherTypeLabel(m.type);

    if (isInward) {
      lots.push({ date: m.date, qty: absQty, rate: m.rate, remainingQty: absQty });

      balQty = r4(balQty + absQty);
      balValue = r4(balValue + r4(absQty * m.rate));
      const balRate = balQty > 0 ? r4(balValue / balQty) : 0;

      if (!seenOpening && m.type === "opening") {
        openingQty = absQty;
        openingRate = m.rate;
        openingValue = r2(absQty * m.rate);
        seenOpening = true;
      }

      totalInQty += absQty;
      totalInValue += r4(absQty * m.rate);

      rows.push({
        movementId: m.id,
        date: m.date,
        type: m.type,
        voucherNo: m.referenceNo ?? m.id.slice(-6).toUpperCase(),
        voucherType: vType,
        inQty: absQty,
        inRate: m.rate,
        inValue: r2(absQty * m.rate),
        outQty: 0,
        outRate: 0,
        outValue: 0,
        balQty,
        balRate,
        balValue: r2(balValue),
      });
    } else if (m.qty < 0) {
      // Consume from oldest lots first
      let remaining = absQty;
      let outValueAcc = 0;
      const consumed = absQty;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.remainingQty);
        outValueAcc += r4(take * lot.rate);
        lot.remainingQty = r4(lot.remainingQty - take);
        remaining = r4(remaining - take);
        if (lot.remainingQty <= 0) lots.shift();
      }

      const outValue = r2(outValueAcc);
      const outRate = consumed > 0 ? r4(outValue / consumed) : 0;

      balQty = r4(balQty - absQty);
      balValue = r4(balValue - outValue);
      if (balQty <= 0) {
        balQty = 0;
        balValue = 0;
      }

      // Recalculate balRate from remaining lots
      const remainingValue = lots.reduce((s, l) => s + r4(l.remainingQty * l.rate), 0);
      const fifoBalValue = r4(remainingValue);
      const balRate = balQty > 0 ? r4(fifoBalValue / balQty) : 0;
      balValue = fifoBalValue;

      totalOutQty += absQty;
      totalOutValue += outValue;

      rows.push({
        movementId: m.id,
        date: m.date,
        type: m.type,
        voucherNo: m.referenceNo ?? m.id.slice(-6).toUpperCase(),
        voucherType: vType,
        inQty: 0,
        inRate: 0,
        inValue: 0,
        outQty: absQty,
        outRate,
        outValue,
        balQty: r4(balQty),
        balRate,
        balValue: r2(fifoBalValue),
      });
    }
  }

  const fifoFinalValue = lots.reduce((s, l) => s + r4(l.remainingQty * l.rate), 0);
  const weightedAvgRate = balQty > 0 ? r4(fifoFinalValue / balQty) : 0;

  return {
    itemId: item.id,
    method: "fifo",
    openingQty,
    openingRate,
    openingValue,
    totalInQty: r4(totalInQty),
    totalInValue: r2(totalInValue),
    totalOutQty: r4(totalOutQty),
    totalOutValue: r2(totalOutValue),
    closingQty: r4(balQty),
    closingValue: r2(fifoFinalValue),
    weightedAvgRate,
    movements: rows,
  };
}

// ── Convenience dispatcher ────────────────────────────────────────────────────

export function computeValuation(
  method: ValuationMethod,
  allMovements: RawMovement[],
  item: RawItem,
  warehouseId: string | null = null,
  upToDate: string | null = null,
): ValuationResult {
  return method === "fifo"
    ? computeFIFO(allMovements, item, warehouseId, upToDate)
    : computeWeightedAverage(allMovements, item, warehouseId, upToDate);
}

// ── Summary helper for StockSummary page ─────────────────────────────────────

export interface StockSummaryRow {
  itemId: string;
  itemName: string;
  unit: string;
  groupId: string;
  groupName: string;
  openingQty: number;
  openingValue: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  closingValue: number;
  closingRate: number; // weighted avg rate at close
}

export function computeAllItemSummaries(
  method: ValuationMethod,
  allMovements: RawMovement[],
  items: RawItem[],
  itemGroups: { id: string; name: string }[],
  startDate: string,
  endDate: string,
  warehouseId: string | null = null,
): StockSummaryRow[] {
  const groupMap = new Map(itemGroups.map((g) => [g.id, g.name]));

  return items.map((item) => {
    // Compute opening: all movements BEFORE startDate (to get opening balance)
    const dayBefore = startDate; // we use < startDate for opening
    const openingResult = computeValuation(method, allMovements, item, warehouseId, dayBefore);

    // Compute period: movements from startDate through endDate
    const periodMovements = allMovements.filter(
      (m) =>
        m.itemId === item.id &&
        m.date >= startDate &&
        m.date <= endDate &&
        (!warehouseId || !m.warehouseId || m.warehouseId === warehouseId),
    );

    // Opening is the closing balance as of (startDate - 1 day)
    // We approximate by taking closingQty/closingValue from movements before startDate
    const openingQty = openingResult.closingQty;
    const openingValue = openingResult.closingValue;

    // Period inward/outward
    let inQty = 0,
      inValue = 0,
      outQty = 0,
      outValue = 0;
    for (const m of periodMovements) {
      if (m.qty > 0 && m.type !== "opening") {
        inQty += m.qty;
        inValue += m.qty * m.rate;
      } else if (m.qty < 0) {
        outQty += Math.abs(m.qty);
      }
    }

    // Closing: rerun valuation up to endDate for accurate closing rate
    const closingResult = computeValuation(method, allMovements, item, warehouseId, endDate);
    const closingQty = closingResult.closingQty;
    const closingValue = closingResult.closingValue;
    const closingRate = closingResult.weightedAvgRate;

    // Outward value: use valuation engine's total out value in the period
    // Quick: outValue = openingValue + inValue - closingValue
    outValue = r2(openingValue + inValue - closingValue);
    if (outValue < 0) outValue = 0;

    const groupId = (item as any).groupId ?? "";
    const groupName = groupMap.get(groupId) ?? "Ungrouped";

    return {
      itemId: item.id,
      itemName: item.name ?? item.id,
      unit: (item as any).unit ?? "",
      groupId,
      groupName,
      openingQty: r4(openingQty),
      openingValue: r2(openingValue),
      inQty: r4(inQty),
      inValue: r2(inValue),
      outQty: r4(outQty),
      outValue: r2(outValue),
      closingQty: r4(closingQty),
      closingValue: r2(closingValue),
      closingRate: r4(closingRate),
    };
  });
}

// ── Profit by Item helper ─────────────────────────────────────────────────────

export interface ProfitByItemRow {
  itemId: string;
  itemName: string;
  unit: string;
  qtySold: number;
  avgSaleRate: number;
  salesValue: number;
  avgCostRate: number;
  cogs: number;
  grossProfit: number;
  gpPct: number;
}

export function computeProfitByItem(
  allMovements: RawMovement[],
  items: RawItem[],
  startDate: string,
  endDate: string,
  warehouseId: string | null = null,
): ProfitByItemRow[] {
  const results: ProfitByItemRow[] = [];

  for (const item of items) {
    // Get WA cost rate at each point of sale
    const salesMovements = allMovements.filter(
      (m) =>
        m.itemId === item.id &&
        m.date >= startDate &&
        m.date <= endDate &&
        m.qty < 0 &&
        (m.type === "sales-invoice" || m.type === "delivery-challan") &&
        (!warehouseId || !m.warehouseId || m.warehouseId === warehouseId),
    );

    if (salesMovements.length === 0) continue;

    // Total sales qty and value (use stored rate from movement)
    const qtySold = salesMovements.reduce((s, m) => s + Math.abs(m.qty), 0);
    const salesValue = salesMovements.reduce((s, m) => s + Math.abs(m.amount), 0);
    const avgSaleRate = qtySold > 0 ? r4(salesValue / qtySold) : 0;

    // COGS: use weighted average cost rate at end of period
    const waResult = computeWeightedAverage(allMovements, item, warehouseId, endDate);
    const avgCostRate = waResult.weightedAvgRate;
    const cogs = r2(qtySold * avgCostRate);
    const grossProfit = r2(salesValue - cogs);
    const gpPct = salesValue > 0 ? r4((grossProfit / salesValue) * 100) : 0;

    results.push({
      itemId: item.id,
      itemName: item.name ?? item.id,
      unit: (item as any).unit ?? "",
      qtySold: r4(qtySold),
      avgSaleRate: avgSaleRate,
      salesValue: r2(salesValue),
      avgCostRate,
      cogs,
      grossProfit,
      gpPct,
    });
  }

  // Sort by gpPct ascending (loss-making items first)
  results.sort((a, b) => a.gpPct - b.gpPct);

  return results;
}

// ── Batch expiry helpers ──────────────────────────────────────────────────────

export type BatchStatus = "expired" | "near-expiry" | "expiring-soon" | "active";

export function getBatchStatus(expiryDateStr: string, todayStr: string): BatchStatus {
  if (!expiryDateStr) return "active";
  if (expiryDateStr < todayStr) return "expired";

  // Days difference
  const expiry = new Date(expiryDateStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const diffMs = expiry.getTime() - today.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 30) return "near-expiry";
  if (days <= 60) return "expiring-soon";
  return "active";
}

export function getDaysToExpiry(expiryDateStr: string, todayStr: string): number | null {
  if (!expiryDateStr) return null;
  const expiry = new Date(expiryDateStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const diffMs = expiry.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ── Stock alert helpers ───────────────────────────────────────────────────────

export type AlertType = "below-reorder" | "below-minimum";

export interface StockAlert {
  itemId: string;
  itemName: string;
  alertType: AlertType;
  currentQty: number;
  reorderQty: number;
  minimumQty: number;
  unit: string;
  shortage: number;
}

export function computeStockAlerts(
  allMovements: RawMovement[],
  items: {
    id: string;
    name?: string;
    reorderLevel?: number;
    minimumStock?: number;
    unit?: string;
  }[],
): StockAlert[] {
  const alerts: StockAlert[] = [];

  for (const item of items) {
    // Current qty = sum of all movements
    const itemMoves = allMovements.filter((m) => m.itemId === item.id);
    const currentQty = r4(itemMoves.reduce((s, m) => s + m.qty, 0));

    const reorderLevel = item.reorderLevel ?? 0;
    const minimumStock = item.minimumStock ?? 0;

    if (minimumStock > 0 && currentQty < minimumStock) {
      alerts.push({
        itemId: item.id,
        itemName: item.name ?? item.id,
        alertType: "below-minimum",
        currentQty,
        reorderQty: reorderLevel,
        minimumQty: minimumStock,
        unit: item.unit ?? "",
        shortage: r4(minimumStock - currentQty),
      });
    } else if (reorderLevel > 0 && currentQty <= reorderLevel) {
      alerts.push({
        itemId: item.id,
        itemName: item.name ?? item.id,
        alertType: "below-reorder",
        currentQty,
        reorderQty: reorderLevel,
        minimumQty: minimumStock,
        unit: item.unit ?? "",
        shortage: r4(reorderLevel - currentQty),
      });
    }
  }

  return alerts.sort((a, b) => {
    // below-minimum first, then by shortage descending
    if (a.alertType !== b.alertType) return a.alertType === "below-minimum" ? -1 : 1;
    return b.shortage - a.shortage;
  });
}
