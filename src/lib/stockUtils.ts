// src/lib/stockUtils.ts

export interface StockPosition {
  itemId: string;
  warehouseId?: string | null;
  qty: number;
  value: number;
  avgRate: number;
}

export interface StockSummaryRow {
  itemId: string;
  itemName: string;
  unit: string;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  closingValue: number;
  avgRate: number;
}

export function computeStockPosition(
  movements: any[],
  itemId: string,
  warehouseId: string | null
): StockPosition {
  let qty = 0;
  let value = 0;

  for (const mov of movements) {
    if (mov.itemId !== itemId) continue;
    if (warehouseId && mov.warehouseId !== warehouseId) continue;
    qty += Number(mov.qty) || 0;
    value += Number(mov.amount) || 0;
  }

  return {
    itemId,
    warehouseId,
    qty: Math.round(qty * 10000) / 10000,
    value: Math.round(value * 100) / 100,
    avgRate: qty !== 0 ? Math.round((value / qty) * 100) / 100 : 0,
  };
}

export function getCurrentStock(
  itemId: string,
  warehouseId: string | null | undefined,
  movements: any[]
): number {
  return computeStockPosition(movements, itemId, warehouseId || null).qty;
}

export function computeAllStockPositions(
  movements: any[],
  items: any[],
  warehouses: any[]
): StockPosition[] {
  return items.map((item) => {
    const pos = computeStockPosition(movements, item.id, null);
    return {
      itemId: item.id,
      warehouseId: null,
      qty: (item.openingStock || 0) + pos.qty,
      value: pos.value + (item.openingStock || 0) * (item.openingStockRate || 0),
      avgRate: pos.avgRate,
    };
  });
}

export function calculateStockSummary(items: any[], movements: any[]): StockSummaryRow[] {
  return items.map((item) => {
    const opening = item.openingStock || 0;
    const itemMovs = movements.filter((m) => m.itemId === item.id);
    const inQty = itemMovs
      .filter((m) => Number(m.qty) > 0)
      .reduce((s, m) => s + Number(m.qty), 0);
    const outQty = Math.abs(
      itemMovs
        .filter((m) => Number(m.qty) < 0)
        .reduce((s, m) => s + Number(m.qty), 0)
    );
    const closing = opening + inQty - outQty;
    const value = closing * (item.openingStockRate || item.purchaseRate || 0);

    return {
      itemId: item.id,
      itemName: item.name,
      unit: item.unit || "pcs",
      openingQty: opening,
      inQty: Math.round(inQty * 10000) / 10000,
      outQty: Math.round(outQty * 10000) / 10000,
      closingQty: Math.round(closing * 10000) / 10000,
      closingValue: Math.round(value * 100) / 100,
      avgRate: closing !== 0
        ? Math.round((value / closing) * 100) / 100
        : item.openingStockRate || 0,
    };
  });
}
