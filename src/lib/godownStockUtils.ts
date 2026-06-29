import type { DBStockMovement, DBWarehouse } from "./db";

// Local string-based alias matching the actual usage across this file
type StockValuationMethod = "fifo" | "lifo" | "weighted-average" | string;

export interface StockPosition {
  itemId: string;
  itemName: string;
  warehouseId?: string;
  warehouseName?: string;
  branchId?: string;
  branchName?: string;
  qty: number;
  value: number;
  avgRate: number;
}

export interface GodownValuationRow {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;

  openingQty: number;
  openingValue: number;

  receiptsQty: number;
  receiptsValue: number;

  issuesQty: number;
  issuesValue: number;

  closingQty: number;
  closingValue: number;
  closingRate: number;
}

export interface MovementLedgerRow {
  id: string;
  date: string;
  dateNepali: string;
  voucherNo?: string;
  referenceId?: string;
  referenceType?: string;
  type: string;
  warehouseId: string;
  warehouseName: string;
  inwardQty: number;
  outwardQty: number;
  balanceQty: number;
  rate: number;
  value: number;
}

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isReceipt(type: string): boolean {
  return [
    "opening",
    "purchase",
    "sales-return",
    "stock-transfer-in",
    "stock-journal-in",
    "production-in",
    "physical-stock",
  ].includes(type);
}

function isIssue(type: string): boolean {
  return [
    "sales",
    "purchase-return",
    "stock-transfer-out",
    "stock-journal-out",
    "production-out",
  ].includes(type);
}

function movementSign(type: string): 1 | -1 {
  if (isReceipt(type)) return 1;
  if (isIssue(type)) return -1;
  return 1;
}

export function getMovementsAsAt(
  movements: DBStockMovement[],
  asAtDate?: string,
): DBStockMovement[] {
  return movements
    .filter((m) => !asAtDate || m.date <= asAtDate)
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Weighted average stock calculation per item/godown.
 * This is the recommended default for Nepal ERP valuation.
 */
export function computeWeightedAveragePosition(movements: DBStockMovement[]): StockPosition {
  let qty = 0;
  let value = 0;
  let itemId = "";
  let itemName = "";
  let warehouseId = "";
  let warehouseName = "";
  let branchId = "";
  let branchName = "";

  for (const m of movements) {
    itemId = m.itemId;
    itemName = m.itemName;
    warehouseId = m.warehouseId;
    warehouseName = m.warehouseName;
    branchId = m.branchId || "";
    branchName = m.branchName || "";

    const movementQty = Number(m.qty || 0);
    const movementValue = Number(m.amount || movementQty * (m.rate || 0));

    if (isReceipt(m.type)) {
      qty += movementQty;
      value += movementValue;
    } else if (isIssue(m.type)) {
      const avgRate = qty === 0 ? Number(m.rate || 0) : value / qty;
      const issueValue = movementValue || movementQty * avgRate;
      qty -= movementQty;
      value -= issueValue;
    }
  }

  return {
    itemId,
    itemName,
    warehouseId,
    warehouseName,
    branchId,
    branchName,
    qty: round2(qty),
    value: round2(value),
    avgRate: qty !== 0 ? round2(value / qty) : 0,
  };
}

export function computeFifoOrLifoPosition(
  movements: DBStockMovement[],
  method: "fifo" | "lifo",
): StockPosition {
  const layers: Array<{ qty: number; rate: number; value: number }> = [];

  let itemId = "";
  let itemName = "";
  let warehouseId = "";
  let warehouseName = "";
  let branchId = "";
  let branchName = "";

  for (const m of movements) {
    itemId = m.itemId;
    itemName = m.itemName;
    warehouseId = m.warehouseId;
    warehouseName = m.warehouseName;
    branchId = m.branchId || "";
    branchName = m.branchName || "";

    const qty = Number(m.qty || 0);
    const rate = Number(m.rate || 0);
    const value = Number(m.amount || qty * rate);

    if (isReceipt(m.type)) {
      layers.push({ qty, rate, value });
    }

    if (isIssue(m.type)) {
      let remaining = qty;

      while (remaining > 0 && layers.length > 0) {
        const index = method === "fifo" ? 0 : layers.length - 1;
        const layer = layers[index];

        const consumeQty = Math.min(layer.qty, remaining);
        const consumeValue = consumeQty * layer.rate;

        layer.qty -= consumeQty;
        layer.value -= consumeValue;
        remaining -= consumeQty;

        if (layer.qty <= 0.000001) {
          layers.splice(index, 1);
        }
      }

      // If negative stock allowed, keep a negative layer at issue rate.
      if (remaining > 0) {
        layers.push({
          qty: -remaining,
          rate,
          value: -remaining * rate,
        });
      }
    }
  }

  const closingQty = layers.reduce((s, l) => s + l.qty, 0);
  const closingValue = layers.reduce((s, l) => s + l.value, 0);

  return {
    itemId,
    itemName,
    warehouseId,
    warehouseName,
    branchId,
    branchName,
    qty: round2(closingQty),
    value: round2(closingValue),
    avgRate: closingQty !== 0 ? round2(closingValue / closingQty) : 0,
  };
}

export function computeStockPosition(
  movements: DBStockMovement[],
  method: StockValuationMethod = "weighted-average",
): StockPosition {
  if (method === "fifo") return computeFifoOrLifoPosition(movements, "fifo");
  if (method === "lifo") return computeFifoOrLifoPosition(movements, "lifo");
  return computeWeightedAveragePosition(movements);
}

export function computeGodownMatrix(args: {
  movements: DBStockMovement[];
  warehouses: DBWarehouse[];
  asAtDate?: string;
  method?: StockValuationMethod;
}) {
  const filtered = getMovementsAsAt(args.movements, args.asAtDate);
  const groupMap = new Map<string, DBStockMovement[]>();

  for (const m of filtered) {
    const key = `${m.itemId}::${m.warehouseId}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(m);
  }

  const positions = Array.from(groupMap.values()).map((list) =>
    computeStockPosition(list, args.method || "weighted-average"),
  );

  const itemIds = Array.from(new Set(positions.map((p) => p.itemId)));
  const warehouseIds = args.warehouses.map((w) => w.id);

  const matrix = itemIds.map((itemId) => {
    const itemPositions = positions.filter((p) => p.itemId === itemId);
    const itemName = itemPositions[0]?.itemName || "";

    const cells: Record<string, StockPosition> = {};

    for (const warehouseId of warehouseIds) {
      const pos = itemPositions.find((p) => p.warehouseId === warehouseId);
      cells[warehouseId] =
        pos ||
        ({
          itemId,
          itemName,
          warehouseId,
          warehouseName: args.warehouses.find((w) => w.id === warehouseId)?.name || "",
          qty: 0,
          value: 0,
          avgRate: 0,
        } as StockPosition);
    }

    const totalQty = itemPositions.reduce((s, p) => s + p.qty, 0);
    const totalValue = itemPositions.reduce((s, p) => s + p.value, 0);

    return {
      itemId,
      itemName,
      cells,
      totalQty: round2(totalQty),
      totalValue: round2(totalValue),
    };
  });

  const columnTotals = warehouseIds.reduce<Record<string, { qty: number; value: number }>>(
    (acc, warehouseId) => {
      acc[warehouseId] = {
        qty: round2(
          positions.filter((p) => p.warehouseId === warehouseId).reduce((s, p) => s + p.qty, 0),
        ),
        value: round2(
          positions.filter((p) => p.warehouseId === warehouseId).reduce((s, p) => s + p.value, 0),
        ),
      };
      return acc;
    },
    {},
  );

  return {
    warehouses: args.warehouses,
    rows: matrix,
    columnTotals,
  };
}

export function computeGodownValuationRows(args: {
  movements: DBStockMovement[];
  fromDate?: string;
  toDate?: string;
  method?: StockValuationMethod;
}): GodownValuationRow[] {
  const method = args.method || "weighted-average";

  const keys = Array.from(new Set(args.movements.map((m) => `${m.itemId}::${m.warehouseId}`)));

  return keys.map((key) => {
    const [itemId, warehouseId] = key.split("::");
    const all = args.movements
      .filter((m) => m.itemId === itemId && m.warehouseId === warehouseId)
      .sort((a, b) => a.date.localeCompare(b.date));

    const before = all.filter((m) => args.fromDate && m.date < args.fromDate);
    const period = all.filter((m) => {
      if (args.fromDate && m.date < args.fromDate) return false;
      if (args.toDate && m.date > args.toDate) return false;
      return true;
    });

    const opening = computeStockPosition(before, method);

    let receiptsQty = 0;
    let receiptsValue = 0;
    let issuesQty = 0;
    let issuesValue = 0;

    for (const m of period) {
      if (isReceipt(m.type)) {
        receiptsQty += m.qty;
        receiptsValue += m.amount;
      } else if (isIssue(m.type)) {
        issuesQty += m.qty;
        issuesValue += m.amount;
      }
    }

    const closing = computeStockPosition(
      args.toDate ? all.filter((m) => m.date <= args.toDate!) : all,
      method,
    );

    return {
      itemId,
      itemName: all[0]?.itemName || "",
      warehouseId,
      warehouseName: all[0]?.warehouseName || "",

      openingQty: round2(opening.qty),
      openingValue: round2(opening.value),

      receiptsQty: round2(receiptsQty),
      receiptsValue: round2(receiptsValue),

      issuesQty: round2(issuesQty),
      issuesValue: round2(issuesValue),

      closingQty: round2(closing.qty),
      closingValue: round2(closing.value),
      closingRate: round2(closing.avgRate),
    };
  });
}

export function buildItemMovementLedger(args: {
  movements: DBStockMovement[];
  itemId: string;
  warehouseId?: string;
  asAtDate?: string;
}): MovementLedgerRow[] {
  const list = getMovementsAsAt(args.movements, args.asAtDate)
    .filter((m) => m.itemId === args.itemId)
    .filter((m) => !args.warehouseId || m.warehouseId === args.warehouseId);

  let balanceQty = 0;

  return list.map((m) => {
    const sign = movementSign(m.type);
    const inwardQty = sign > 0 ? m.qty : 0;
    const outwardQty = sign < 0 ? m.qty : 0;

    balanceQty += inwardQty - outwardQty;

    return {
      id: m.id,
      date: m.date,
      dateNepali: m.dateNepali,
      voucherNo: m.referenceNo,
      referenceId: m.referenceId,
      referenceType: m.referenceType,
      type: m.type,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouseName,
      inwardQty,
      outwardQty,
      balanceQty: round2(balanceQty),
      rate: m.rate,
      value: m.amount,
    };
  });
}

export function computeConsolidatedStock(args: {
  movements: DBStockMovement[];
  asAtDate?: string;
  method?: StockValuationMethod;
}) {
  const filtered = getMovementsAsAt(args.movements, args.asAtDate);
  const map = new Map<string, DBStockMovement[]>();

  for (const m of filtered) {
    if (!map.has(m.itemId)) map.set(m.itemId, []);
    map.get(m.itemId)!.push(m);
  }

  return Array.from(map.values()).map((list) => {
    const pos = computeStockPosition(list, args.method || "weighted-average");
    return {
      itemId: pos.itemId,
      itemName: pos.itemName,
      totalQty: pos.qty,
      totalValue: pos.value,
      avgRate: pos.avgRate,
    };
  });
}
