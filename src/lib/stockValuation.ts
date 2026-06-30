// FIFO, LIFO, Weighted Average stock valuation engine

export type ValuationMethod = "fifo" | "lifo" | "weighted_average";

export interface StockMovementRaw {
  id: string;
  date: string;           // "YYYY-MM-DD"
  type: string;           // e.g. "purchase", "sales", "opening", "stock-transfer-in", etc.
  itemId: string;
  itemName: string;
  warehouseId?: string;
  warehouseName?: string;
  qty: number;
  rate: number;
  amount?: number;
}

export interface ValuationLayer {
  qty: number;
  rate: number;
}

export interface StockLedgerEntry {
  date: string;
  particulars: string;
  inQty: number;
  inRate: number;
  inAmount: number;
  outQty: number;
  outRate: number;
  outAmount: number;
  balanceQty: number;
  balanceRate: number;
  balanceAmount: number;
}

export interface StockItemSummary {
  itemId: string;
  itemName: string;
  openingQty: number;
  openingRate: number;
  openingAmount: number;
  purchaseQty: number;
  purchaseRate: number; // weighted avg purchase rate during period
  purchaseAmount: number;
  salesQty: number;
  salesRate: number;   // avg sales rate during period
  salesAmount: number;
  closingQty: number;
  closingRate: number;
  closingAmount: number;
  ledger: StockLedgerEntry[];
}

function isInward(type: string): boolean {
  const t = (type || "").toLowerCase();
  return (
    t.includes("purchase") ||
    t.includes("opening") ||
    t.includes("transfer-in") ||
    t.includes("receipt") ||
    t.includes("adjustment-in") ||
    t === "in"
  );
}

function isOutward(type: string): boolean {
  const t = (type || "").toLowerCase();
  return (
    t.includes("sales") ||
    t.includes("transfer-out") ||
    t.includes("adjustment-out") ||
    t === "out"
  );
}

/**
 * Compute per-item stock summary using chosen valuation method.
 */
export function computeStockSummary(
  movements: StockMovementRaw[],
  method: ValuationMethod,
  fromDate?: string,
  toDate?: string,
): StockItemSummary[] {
  // Group by itemId
  const byItem = new Map<string, StockMovementRaw[]>();
  for (const m of movements) {
    const arr = byItem.get(m.itemId) ?? [];
    arr.push(m);
    byItem.set(m.itemId, arr);
  }

  const results: StockItemSummary[] = [];

  for (const [itemId, rawMovs] of byItem) {
    // Sort chronologically
    const sorted = [...rawMovs].sort((a, b) => a.date.localeCompare(b.date));

    // Split into pre-period (opening) and in-period
    const preMovs = fromDate ? sorted.filter(m => m.date < fromDate) : [];
    const inPeriod = fromDate && toDate
      ? sorted.filter(m => m.date >= fromDate && m.date <= toDate)
      : sorted;

    // Compute opening stock using method
    const { closingQty: openingQty, closingRate: openingRate, closingAmount: openingAmount } =
      runValuation(preMovs, method);

    // Run in-period
    const {
      closingQty,
      closingRate,
      closingAmount,
      purchaseQty,
      purchaseAmount,
      salesQty,
      salesAmount,
      ledger,
    } = runValuationDetailed(inPeriod, method, openingQty, openingRate, openingAmount);

    results.push({
      itemId,
      itemName: rawMovs[0]?.itemName ?? itemId,
      openingQty,
      openingRate,
      openingAmount,
      purchaseQty,
      purchaseRate: purchaseQty > 0 ? purchaseAmount / purchaseQty : 0,
      purchaseAmount,
      salesQty,
      salesRate: salesQty > 0 ? salesAmount / salesQty : 0,
      salesAmount,
      closingQty,
      closingRate,
      closingAmount,
      ledger,
    });
  }

  return results.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

interface ValuationResult {
  closingQty: number;
  closingRate: number;
  closingAmount: number;
}

function runValuation(
  movs: StockMovementRaw[],
  method: ValuationMethod,
): ValuationResult {
  const layers: ValuationLayer[] = [];
  let waQty = 0;
  let waAmount = 0;

  for (const m of movs) {
    const qty = Math.abs(Number(m.qty) || 0);
    const rate = Number(m.rate) || 0;
    if (qty === 0) continue;

    if (isInward(m.type)) {
      if (method === "weighted_average") {
        waAmount += qty * rate;
        waQty += qty;
      } else {
        layers.push({ qty, rate });
      }
    } else if (isOutward(m.type)) {
      if (method === "weighted_average") {
        waQty = Math.max(0, waQty - qty);
        const avgRate = waQty > 0 ? waAmount / (waQty + qty) : rate;
        waAmount = Math.max(0, waAmount - qty * avgRate);
      } else {
        consumeLayers(layers, qty, method);
      }
    }
  }

  if (method === "weighted_average") {
    const avgRate = waQty > 0 ? waAmount / waQty : 0;
    return { closingQty: waQty, closingRate: avgRate, closingAmount: waAmount };
  }

  const totalQty = layers.reduce((s, l) => s + l.qty, 0);
  const totalAmt = layers.reduce((s, l) => s + l.qty * l.rate, 0);
  return {
    closingQty: totalQty,
    closingRate: totalQty > 0 ? totalAmt / totalQty : 0,
    closingAmount: totalAmt,
  };
}

interface DetailedResult extends ValuationResult {
  purchaseQty: number;
  purchaseAmount: number;
  salesQty: number;
  salesAmount: number;
  ledger: StockLedgerEntry[];
}

function runValuationDetailed(
  movs: StockMovementRaw[],
  method: ValuationMethod,
  openingQty: number,
  openingRate: number,
  openingAmount: number,
): DetailedResult {
  const layers: ValuationLayer[] = [];
  let waQty = openingQty;
  let waAmount = openingAmount;

  if (method !== "weighted_average" && openingQty > 0) {
    layers.push({ qty: openingQty, rate: openingRate });
  }

  let purchaseQty = 0, purchaseAmount = 0;
  let salesQty = 0, salesAmount = 0;
  let balQty = openingQty;
  let balAmount = openingAmount;

  const ledger: StockLedgerEntry[] = [];

  for (const m of movs) {
    const qty = Math.abs(Number(m.qty) || 0);
    const rate = Number(m.rate) || (qty > 0 ? m.amount! / qty : 0) || 0;
    if (qty === 0) continue;

    let entry: StockLedgerEntry;

    if (isInward(m.type)) {
      purchaseQty += qty;
      purchaseAmount += qty * rate;
      balQty += qty;

      if (method === "weighted_average") {
        waAmount += qty * rate;
        waQty += qty;
        balAmount = waAmount;
        const avgRate = waQty > 0 ? waAmount / waQty : 0;
        entry = {
          date: m.date,
          particulars: m.type.replace(/-/g, " "),
          inQty: qty, inRate: rate, inAmount: qty * rate,
          outQty: 0, outRate: 0, outAmount: 0,
          balanceQty: waQty,
          balanceRate: avgRate,
          balanceAmount: waAmount,
        };
      } else {
        layers.push({ qty, rate });
        balAmount += qty * rate;
        const bRate = balQty > 0 ? balAmount / balQty : 0;
        entry = {
          date: m.date,
          particulars: m.type.replace(/-/g, " "),
          inQty: qty, inRate: rate, inAmount: qty * rate,
          outQty: 0, outRate: 0, outAmount: 0,
          balanceQty: balQty,
          balanceRate: bRate,
          balanceAmount: balAmount,
        };
      }
    } else if (isOutward(m.type)) {
      salesQty += qty;

      if (method === "weighted_average") {
        const avgRate = waQty > 0 ? waAmount / waQty : rate;
        const cost = qty * avgRate;
        salesAmount += cost;
        waQty = Math.max(0, waQty - qty);
        waAmount = Math.max(0, waAmount - cost);
        balQty -= qty;
        balAmount = waAmount;
        entry = {
          date: m.date,
          particulars: m.type.replace(/-/g, " "),
          inQty: 0, inRate: 0, inAmount: 0,
          outQty: qty, outRate: avgRate, outAmount: cost,
          balanceQty: waQty,
          balanceRate: waQty > 0 ? waAmount / waQty : 0,
          balanceAmount: waAmount,
        };
      } else {
        const { consumed, costOfGoods } = consumeLayers(layers, qty, method);
        salesAmount += costOfGoods;
        balQty -= qty;
        balAmount -= costOfGoods;
        if (balAmount < 0) balAmount = 0;
        const bRate = balQty > 0 ? balAmount / balQty : 0;
        entry = {
          date: m.date,
          particulars: m.type.replace(/-/g, " "),
          inQty: 0, inRate: 0, inAmount: 0,
          outQty: qty, outRate: qty > 0 ? costOfGoods / qty : 0, outAmount: costOfGoods,
          balanceQty: balQty,
          balanceRate: bRate,
          balanceAmount: balAmount,
        };
      }
    } else {
      continue;
    }

    ledger.push(entry);
  }

  const closingQty = method === "weighted_average" ? waQty : layers.reduce((s, l) => s + l.qty, 0);
  const closingAmount = method === "weighted_average"
    ? waAmount
    : layers.reduce((s, l) => s + l.qty * l.rate, 0);
  const closingRate = closingQty > 0 ? closingAmount / closingQty : 0;

  return {
    closingQty,
    closingRate,
    closingAmount,
    purchaseQty,
    purchaseAmount,
    salesQty,
    salesAmount,
    ledger,
  };
}

function consumeLayers(
  layers: ValuationLayer[],
  qty: number,
  method: ValuationMethod,
): { consumed: number; costOfGoods: number } {
  let remaining = qty;
  let costOfGoods = 0;

  if (method === "lifo") {
    // consume from end
    while (remaining > 0 && layers.length > 0) {
      const last = layers[layers.length - 1];
      const take = Math.min(remaining, last.qty);
      costOfGoods += take * last.rate;
      last.qty -= take;
      remaining -= take;
      if (last.qty <= 0) layers.pop();
    }
  } else {
    // fifo — consume from front
    while (remaining > 0 && layers.length > 0) {
      const first = layers[0];
      const take = Math.min(remaining, first.qty);
      costOfGoods += take * first.rate;
      first.qty -= take;
      remaining -= take;
      if (first.qty <= 0) layers.shift();
    }
  }

  return { consumed: qty - remaining, costOfGoods };
}
