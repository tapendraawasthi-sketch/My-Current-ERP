// src/lib/stockValuation.ts
// Pure stock valuation functions — FIFO, LIFO, Moving Weighted Average
// No side-effects, no DB access, no store access.
// Used by StockSummary page and future costing integrations.

export type CostingMethod = "fifo" | "lifo" | "moving_avg" | "weighted_avg";

export interface StockLot {
  date: string;       // ISO date of purchase/receipt
  qty: number;        // quantity received in this lot
  rate: number;       // cost per unit of this lot
}

export interface ValuationResult {
  closingQty: number;
  closingValue: number;
  closingRate: number;   // average rate of closing stock
  cogsSold: number;      // cost of goods sold (consumed)
  cogsValue: number;     // total COGS value
}

export interface StockMovement {
  date: string;
  type: "in" | "out";
  qty: number;
  rate: number;  // purchase rate for "in", ignored for "out" in FIFO/LIFO
}

// ─── MOVING WEIGHTED AVERAGE ──────────────────────────────────────────────────
// Most common in Nepal for daily trading. Recalculates average cost on every
// purchase. Sale uses the current running average rate.
export function computeMovingWeightedAverage(
  movements: StockMovement[]
): ValuationResult {
  let runningQty = 0;
  let runningValue = 0;
  let cogsValue = 0;
  let cogsSold = 0;

  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));

  for (const mv of sorted) {
    if (mv.type === "in") {
      runningQty += mv.qty;
      runningValue += mv.qty * mv.rate;
    } else {
      const avgRate = runningQty > 0 ? runningValue / runningQty : 0;
      const consumed = Math.min(mv.qty, runningQty);
      cogsValue += consumed * avgRate;
      cogsSold += consumed;
      runningQty -= consumed;
      runningValue -= consumed * avgRate;
      if (runningValue < 0) runningValue = 0;
    }
  }

  const closingRate = runningQty > 0 ? runningValue / runningQty : 0;

  return {
    closingQty: Math.max(0, runningQty),
    closingValue: Math.max(0, runningValue),
    closingRate,
    cogsSold,
    cogsValue,
  };
}

// ─── SIMPLE WEIGHTED AVERAGE ──────────────────────────────────────────────────
// Calculates a single weighted average for the entire period.
// Simpler than moving WA — uses total receipts to set one rate.
export function computeWeightedAverage(
  movements: StockMovement[],
  openingQty = 0,
  openingValue = 0
): ValuationResult {
  const totalInQty =
    openingQty +
    movements.filter((m) => m.type === "in").reduce((s, m) => s + m.qty, 0);
  const totalInValue =
    openingValue +
    movements
      .filter((m) => m.type === "in")
      .reduce((s, m) => s + m.qty * m.rate, 0);

  const avgRate = totalInQty > 0 ? totalInValue / totalInQty : 0;

  const totalOutQty = movements
    .filter((m) => m.type === "out")
    .reduce((s, m) => s + m.qty, 0);

  const closingQty = Math.max(0, totalInQty - totalOutQty);
  const cogsValue = totalOutQty * avgRate;

  return {
    closingQty,
    closingValue: closingQty * avgRate,
    closingRate: avgRate,
    cogsSold: totalOutQty,
    cogsValue,
  };
}

// ─── FIFO (First-In, First-Out) ───────────────────────────────────────────────
// Oldest purchased lots are consumed first on each sale.
// Required by IFRS. Shows higher profits when prices are rising.
export function computeFIFO(
  movements: StockMovement[],
  openingLots: StockLot[] = []
): ValuationResult {
  // Build a queue of lots sorted by date (oldest first)
  const lots: StockLot[] = [...openingLots];
  let cogsValue = 0;
  let cogsSold = 0;

  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));

  for (const mv of sorted) {
    if (mv.type === "in") {
      lots.push({ date: mv.date, qty: mv.qty, rate: mv.rate });
    } else {
      let remaining = mv.qty;
      cogsSold += mv.qty;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.qty <= remaining) {
          // Consume entire lot
          cogsValue += lot.qty * lot.rate;
          remaining -= lot.qty;
          lots.shift();
        } else {
          // Partially consume lot
          cogsValue += remaining * lot.rate;
          lot.qty -= remaining;
          remaining = 0;
        }
      }
    }
  }

  const closingQty = lots.reduce((s, l) => s + l.qty, 0);
  const closingValue = lots.reduce((s, l) => s + l.qty * l.rate, 0);
  const closingRate = closingQty > 0 ? closingValue / closingQty : 0;

  return {
    closingQty: Math.max(0, closingQty),
    closingValue: Math.max(0, closingValue),
    closingRate,
    cogsSold,
    cogsValue,
  };
}

// ─── LIFO (Last-In, First-Out) ────────────────────────────────────────────────
// Newest purchased lots consumed first. Reduces taxable profit during inflation.
// Banned under IFRS but included for completeness.
export function computeLIFO(
  movements: StockMovement[],
  openingLots: StockLot[] = []
): ValuationResult {
  // Stack — newest first
  const lots: StockLot[] = [...openingLots];
  let cogsValue = 0;
  let cogsSold = 0;

  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));

  for (const mv of sorted) {
    if (mv.type === "in") {
      lots.push({ date: mv.date, qty: mv.qty, rate: mv.rate });
    } else {
      let remaining = mv.qty;
      cogsSold += mv.qty;

      // Consume from the end (newest lots first)
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[lots.length - 1];
        if (lot.qty <= remaining) {
          cogsValue += lot.qty * lot.rate;
          remaining -= lot.qty;
          lots.pop();
        } else {
          cogsValue += remaining * lot.rate;
          lot.qty -= remaining;
          remaining = 0;
        }
      }
    }
  }

  const closingQty = lots.reduce((s, l) => s + l.qty, 0);
  const closingValue = lots.reduce((s, l) => s + l.qty * l.rate, 0);
  const closingRate = closingQty > 0 ? closingValue / closingQty : 0;

  return {
    closingQty: Math.max(0, closingQty),
    closingValue: Math.max(0, closingValue),
    closingRate,
    cogsSold,
    cogsValue,
  };
}

// ─── DISPATCHER ───────────────────────────────────────────────────────────────
// Single entry point — call with your chosen method.
export function computeStockValuation(
  method: CostingMethod,
  movements: StockMovement[],
  openingQty = 0,
  openingValue = 0,
  openingLots: StockLot[] = []
): ValuationResult {
  switch (method) {
    case "fifo":
      return computeFIFO(movements, openingLots);
    case "lifo":
      return computeLIFO(movements, openingLots);
    case "weighted_avg":
      return computeWeightedAverage(movements, openingQty, openingValue);
    case "moving_avg":
    default:
      return computeMovingWeightedAverage(movements);
  }
}

// ─── HELPER: Convert raw DB stock movements to StockMovement[] ─────────────
// Works with whatever shape your stockMovements records have.
export function normalizeDBMovements(rawMovements: any[]): StockMovement[] {
  return rawMovements.map((m) => {
    const type = normalizeMovementType(m.type || m.movementType || "");
    const qty = Math.abs(
      Number(m.qty ?? m.quantity ?? 0)
    );
    const rate = Number(m.rate ?? m.costRate ?? m.purchaseRate ?? 0);

    return {
      date: String(m.date || ""),
      type,
      qty,
      rate,
    };
  });
}

function normalizeMovementType(raw: string): "in" | "out" {
  const t = raw.toLowerCase();
  if (
    t.includes("purchase") ||
    t.includes("in") ||
    t.includes("receipt") ||
    t.includes("grn") ||
    t.includes("opening") ||
    t.includes("transfer-in") ||
    t.includes("adjustment-in") ||
    t.includes("production")
  ) {
    return "in";
  }
  return "out";
}

// ─── LABEL HELPER ─────────────────────────────────────────────────────────────
export function costingMethodLabel(method: CostingMethod): string {
  switch (method) {
    case "fifo":       return "FIFO (First-In, First-Out)";
    case "lifo":       return "LIFO (Last-In, First-Out)";
    case "weighted_avg": return "Weighted Average";
    case "moving_avg": return "Moving Weighted Average";
    default:           return "Moving Weighted Average";
  }
}
