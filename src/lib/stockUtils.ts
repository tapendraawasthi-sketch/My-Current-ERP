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
  warehouseId: string | null,
): StockPosition {
  let qty = 0;
  let value = 0;

  for (const mov of movements || []) {
    if (!mov || mov.itemId !== itemId) continue;
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
  movements: any[],
): number {
  return computeStockPosition(movements, itemId, warehouseId || null).qty;
}

export function computeAllStockPositions(
  movements: any[],
  items: any[],
  warehouses: any[],
): StockPosition[] {
  return (items || []).filter(Boolean).map((item) => {
    const pos = computeStockPosition(movements, item.id, null);
    const totalQty = (item.openingStock || 0) + pos.qty;
    const totalValue = pos.value + (item.openingStock || 0) * (item.openingStockRate || 0);
    return {
      itemId: item.id,
      warehouseId: null,
      qty: totalQty,
      value: Math.round(totalValue * 100) / 100,
      avgRate: totalQty !== 0 ? Math.round((totalValue / totalQty) * 100) / 100 : 0,
    };
  });
}

export function calculateStockSummary(items: any[], movements: any[]): StockSummaryRow[] {
  return (items || []).filter(Boolean).map((item) => {
    const opening = item.openingStock || 0;
    const itemMovs = (movements || []).filter((m) => m && m.itemId === item.id);
    const inQty = itemMovs.filter((m) => Number(m.qty) > 0).reduce((s, m) => s + Number(m.qty), 0);
    const outQty = Math.abs(
      itemMovs.filter((m) => Number(m.qty) < 0).reduce((s, m) => s + Number(m.qty), 0),
    );
    const closing = opening + inQty - outQty;
    // Weighted average: combine opening stock value + inward movement values
    const openingValue = opening * (item.openingStockRate || 0);
    const inValue = itemMovs
      .filter((m) => Number(m.qty) > 0)
      .reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const totalCostPool = openingValue + inValue;
    const totalQtyPool = opening + inQty;
    const weightedAvgRate = totalQtyPool !== 0 ? totalCostPool / totalQtyPool : 0;
    const value = closing * weightedAvgRate;

    return {
      itemId: item.id,
      itemName: item.name,
      unit: item.unit || "pcs",
      openingQty: opening,
      inQty: Math.round(inQty * 10000) / 10000,
      outQty: Math.round(outQty * 10000) / 10000,
      closingQty: Math.round(closing * 10000) / 10000,
      closingValue: Math.round(value * 100) / 100,
      avgRate:
        closing !== 0
          ? Math.round((value / closing) * 100) / 100
          : Math.round(weightedAvgRate * 100) / 100,
    };
  });
}

export function getLowStockItems(movements: any[], items: any[], _warehouses?: any[]): any[] {
  return (items || [])
    .filter((item) => {
      if (!item || !item.reorderLevel) return false;
      const pos = computeStockPosition(movements || [], item.id, null);
      const currentQty = (item.openingStock || 0) + pos.qty;
      return currentQty <= item.reorderLevel;
    })
    .map((item) => {
      const pos = computeStockPosition(movements, item.id, null);
      const currentQty = (item.openingStock || 0) + pos.qty;
      return { ...item, currentQty, shortage: (item.reorderLevel || 0) - currentQty };
    });
}

export function getStockValuationSummary(
  movements: any[],
  items: any[],
  _warehouses?: any[],
  _method?: string,
  _asOfDate?: string,
): any[] {
  return calculateStockSummary(items, movements).map((row) => ({
    ...row,
    avgRate: row.avgRate,
    closingValue: row.closingValue,
  }));
}
