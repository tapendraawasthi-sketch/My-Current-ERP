/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Item,
  Warehouse,
  StockMovement,
  StockJournal,
  Invoice,
  MovementType,
  StockSummaryRow,
  VoucherType,
  ItemType,
  StockValuationMethod,
} from "./types";

// ==========================================
// PRECISION ROUNDING HELPER
// ==========================================
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface StockPosition {
  itemId: string;
  warehouseId: string | null;
  qty: number;
  value: number;
  avgRate: number;
}

export interface FIFOLayer {
  qty: number;
  rate: number;
  date: string;
}

// ==========================================
// 1. DATA PRE-SEEDS
// ==========================================

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: "wh-main",
    code: "MAIN",
    name: "Main Store Godown",
    address: "Anamnagar, Kathmandu, Nepal",
    isDefault: true,
    isActive: true,
  },
  {
    id: "wh-sub",
    code: "SUBSTORE",
    name: "Patan Branch Sub-Store",
    address: "Jawalakhel, Lalitpur, Nepal",
    isDefault: false,
    isActive: true,
  },
];

export const INITIAL_ITEMS: Item[] = [
  {
    id: "itm-tea",
    code: "CTC-01",
    name: "Ilam Organic CTC Tea (First Flush)",
    nameNepali: "à¤‡à¤²à¤¾à¤® à¤ªà¥à¤°à¤¾à¤™à¥à¤—à¤¾à¤°à¤¿à¤• à¤šà¤¿à¤¯à¤¾",
    type: ItemType.PRODUCT,
    unit: "KG",
    purchaseRate: 350.0,
    salesRate: 480.0,
    mrp: 500.0,
    hsnCode: "0902",
    isTaxable: true,
    vatRate: 13,
    minimumStock: 20,
    maximumStock: 500,
    reorderLevel: 50,
    isActive: true,
    openingStock: 100,
    openingStockRate: 320.0,
    description: "Fresh organic first flush CTC tea imported from the tea estates of Ilam, Nepal.",
  },
  {
    id: "itm-rice",
    code: "BAS-02",
    name: "Pokhreli Premium Basmati Rice (25kg Bag)",
    nameNepali: "à¤ªà¥‹à¤–à¥à¤°à¥‡à¤²à¥€ à¤¬à¤¾à¤¸à¤®à¤¤à¥€ à¤šà¤¾à¤®à¤²",
    type: ItemType.PRODUCT,
    unit: "BAG",
    purchaseRate: 2400.0,
    salesRate: 2850.0,
    mrp: 3000.0,
    hsnCode: "1006",
    isTaxable: false,
    vatRate: 0,
    minimumStock: 10,
    maximumStock: 100,
    reorderLevel: 15,
    isActive: true,
    openingStock: 40,
    openingStockRate: 2300.0,
    description: "Long grain, highly fragrant basmati processed from Pokhara valleys.",
  },
  {
    id: "itm-mac",
    code: "LAP-03",
    name: 'Dell Vostro Business Laptop 15.6"',
    nameNepali: "à¤¡à¥‡à¤² à¤­à¥‹à¤¸à¥à¤Ÿà¥à¤°à¥‹ à¤²à¥à¤¯à¤¾à¤ªà¤Ÿà¤ª",
    type: ItemType.PRODUCT,
    unit: "PCS",
    purchaseRate: 75000.0,
    salesRate: 88000.0,
    mrp: 95000.0,
    hsnCode: "8471",
    isTaxable: true,
    vatRate: 13,
    minimumStock: 3,
    maximumStock: 20,
    reorderLevel: 5,
    isActive: true,
    openingStock: 8,
    openingStockRate: 72000.0,
    description: "Dell Vostro Intel Core i5 processor, 16GB RAM, 512GB SSD.",
  },
];

export const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: "mov-init-tea",
    date: "2026-07-16",
    dateNepali: "2083-04-01",
    type: MovementType.OPENING,
    itemId: "itm-tea",
    itemName: "Ilam Organic CTC Tea (First Flush)",
    warehouseId: "wh-main",
    warehouseName: "Main Store Godown",
    qty: 100,
    rate: 320.0,
    amount: 32000.0,
    narration: "Opening Stock Balance for Shrawan 1, 2083",
  },
  {
    id: "mov-init-rice",
    date: "2026-07-16",
    dateNepali: "2083-04-01",
    type: MovementType.OPENING,
    itemId: "itm-rice",
    itemName: "Pokhreli Premium Basmati Rice (25kg Bag)",
    warehouseId: "wh-main",
    warehouseName: "Main Store Godown",
    qty: 40,
    rate: 2300.0,
    amount: 92000.0,
    narration: "Opening Stock Balance for Shrawan 1, 2083",
  },
  {
    id: "mov-init-mac",
    date: "2026-07-16",
    dateNepali: "2083-04-01",
    type: MovementType.OPENING,
    itemId: "itm-mac",
    itemName: 'Dell Vostro Business Laptop 15.6"',
    warehouseId: "wh-main",
    warehouseName: "Main Store Godown",
    qty: 8,
    rate: 72000.0,
    amount: 576000.0,
    narration: "Opening Stock Balance for Shrawan 1, 2083",
  },
];

// ==========================================
// 2. STOCK CALCULATION CORE
// ==========================================

export function computeStockPosition(
  movements: StockMovement[],
  itemId: string,
  warehouseId: string | null,
  asOfDate?: string,
): StockPosition {
  let filtered = movements.filter((m) => m.itemId === itemId);

  if (warehouseId !== null) {
    filtered = filtered.filter((m) => m.warehouseId === warehouseId);
  }

  if (asOfDate) {
    filtered = filtered.filter((m) => m.date <= asOfDate);
  }

  const sorted = [...filtered].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (a.id || "").localeCompare(b.id || "");
  });

  let totalQty = 0;
  let totalValue = 0;
  let avgRate = 0;

  for (const m of sorted) {
    const isIncoming =
      m.type === MovementType.PURCHASE ||
      m.type === MovementType.TRANSFER_IN ||
      m.type === MovementType.OPENING ||
      m.type === MovementType.ADJUSTMENT ||
      m.type === MovementType.SALES_RETURN ||
      (m.type as string) === "purchase-return-inbound";

    const isOutgoing =
      m.type === MovementType.SALES ||
      m.type === MovementType.TRANSFER_OUT ||
      m.type === MovementType.PURCHASE_RETURN ||
      (m.type as string) === "sales-return-outbound";

    if (isIncoming) {
      totalQty = round2(totalQty + m.qty);
      totalValue = round2(totalValue + round2(m.qty * m.rate));
      if (totalQty > 0) {
        avgRate = round2(totalValue / totalQty);
      } else {
        avgRate = 0;
      }
    } else if (isOutgoing) {
      const mValue = round2(m.qty * avgRate);
      totalQty = round2(totalQty - m.qty);
      totalValue = round2(totalValue - mValue);

      if (totalQty <= 0) {
        totalQty = 0;
        totalValue = 0;
        avgRate = 0;
      } else {
        avgRate = round2(totalValue / totalQty);
      }
    }
  }

  return {
    itemId,
    warehouseId,
    qty: totalQty,
    value: totalValue,
    avgRate: totalQty > 0 ? avgRate : 0,
  };
}

export function computeAllStockPositions(
  movements: StockMovement[],
  items: Item[],
  warehouses: Warehouse[],
  asOfDate?: string,
): StockSummaryRow[] {
  const result: StockSummaryRow[] = [];
  const fyStartDate = "2026-04-14";

  for (const item of items) {
    let openingQty = 0;
    let openingValue = 0;
    let closingQty = 0;
    let closingValue = 0;

    for (const wh of warehouses) {
      const openingPos = computeStockPosition(movements, item.id, wh.id, "2026-04-13");
      openingQty += openingPos.qty;
      openingValue += openingPos.value;

      const closingPos = computeStockPosition(movements, item.id, wh.id, asOfDate);
      closingQty += closingPos.qty;
      closingValue += closingPos.value;
    }

    if (openingQty === 0 && item.openingStock) {
      openingQty = item.openingStock;
      openingValue = round2(item.openingStock * (item.openingStockRate || 0));
    }

    const openingRate = openingQty > 0 ? round2(openingValue / openingQty) : 0;

    const itemMovements = movements.filter((m) => m.itemId === item.id);
    const periodMovements = asOfDate
      ? itemMovements.filter((m) => m.date >= fyStartDate && m.date <= asOfDate)
      : itemMovements.filter((m) => m.date >= fyStartDate);

    let inQty = 0;
    let inValue = 0;
    let outQty = 0;
    let outValue = 0;

    for (const m of periodMovements) {
      const isIncoming =
        m.type === MovementType.PURCHASE ||
        m.type === MovementType.TRANSFER_IN ||
        m.type === MovementType.OPENING ||
        m.type === MovementType.ADJUSTMENT ||
        m.type === MovementType.SALES_RETURN ||
        (m.type as string) === "purchase-return-inbound";

      const isOutgoing =
        m.type === MovementType.SALES ||
        m.type === MovementType.TRANSFER_OUT ||
        m.type === MovementType.PURCHASE_RETURN ||
        (m.type as string) === "sales-return-outbound";

      if (isIncoming && m.type !== MovementType.OPENING) {
        inQty = round2(inQty + m.qty);
        inValue = round2(inValue + round2(m.qty * m.rate));
      } else if (isOutgoing) {
        outQty = round2(outQty + m.qty);
        outValue = round2(outValue + round2(m.qty * m.rate));
      }
    }

    const closingRate = closingQty > 0 ? round2(closingValue / closingQty) : 0;

    result.push({
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      unit: item.unit || "PCS",
      openingQty,
      openingRate,
      openingValue,
      inQty,
      inValue,
      outQty,
      outValue,
      closingQty: closingQty >= 0 ? closingQty : 0,
      closingRate,
      closingValue: closingQty >= 0 ? closingValue : 0,
    });
  }

  return result;
}

// ==========================================
// 3. FIFO VALUATION
// ==========================================

export function computeFIFOValuation(
  movements: StockMovement[],
  itemId: string,
  warehouseId: string | null,
  asOfDate?: string,
): {
  qty: number;
  value: number;
  layers: FIFOLayer[];
} {
  let filtered = movements.filter((m) => m.itemId === itemId);
  if (warehouseId !== null) {
    filtered = filtered.filter((m) => m.warehouseId === warehouseId);
  }
  if (asOfDate) {
    filtered = filtered.filter((m) => m.date <= asOfDate);
  }

  const sorted = [...filtered].sort((a, b) => {
    const dDiff = a.date.localeCompare(b.date);
    if (dDiff !== 0) return dDiff;
    return (a.id || "").localeCompare(b.id || "");
  });

  const layers: FIFOLayer[] = [];

  for (const m of sorted) {
    const isIncoming =
      m.type === MovementType.PURCHASE ||
      m.type === MovementType.TRANSFER_IN ||
      m.type === MovementType.OPENING ||
      m.type === MovementType.ADJUSTMENT ||
      m.type === MovementType.SALES_RETURN ||
      (m.type as string) === "purchase-return-inbound";

    let qtyFactor = m.qty;

    if (isIncoming) {
      layers.push({
        qty: qtyFactor,
        rate: m.rate,
        date: m.date,
      });
    } else {
      while (qtyFactor > 0 && layers.length > 0) {
        const oldest = layers[0];
        if (oldest.qty <= qtyFactor) {
          qtyFactor = round2(qtyFactor - oldest.qty);
          layers.shift();
        } else {
          oldest.qty = round2(oldest.qty - qtyFactor);
          qtyFactor = 0;
        }
      }
    }
  }

  const netQty = round2(layers.reduce((sum, item) => sum + item.qty, 0));
  const netValue = round2(layers.reduce((sum, item) => sum + round2(item.qty * item.rate), 0));

  return {
    qty: netQty,
    value: netValue,
    layers,
  };
}

// ==========================================
// 4. STOCK MOVEMENT HELPERS
// ==========================================

export function createSaleMovement(invoice: Invoice, warehouses: Warehouse[]): StockMovement[] {
  const defaultWh = warehouses.find((w) => w.isDefault) || warehouses[0];
  const movements: StockMovement[] = [];

  for (const line of invoice.lines) {
    if (!line.itemId) continue;

    const targetWhId = line.warehouseId || defaultWh?.id || "wh-main";
    const targetWhName = warehouses.find((w) => w.id === targetWhId)?.name || "Main Warehouse";

    movements.push({
      id: `mov-${invoice.invoiceNo}-${line.id || Math.random().toString(36).substr(2, 9)}`,
      date: invoice.date,
      dateNepali: invoice.dateNepali,
      type: MovementType.SALES,
      itemId: line.itemId,
      itemName: line.itemName,
      warehouseId: targetWhId,
      warehouseName: targetWhName,
      qty: line.qty,
      rate: line.rate,
      amount: round2(line.qty * line.rate),
      referenceId: invoice.id,
      referenceNo: invoice.invoiceNo,
      referenceType: "sales-invoice",
      batchNo: line.batchNo,
      narration: invoice.narration || `Sales Invoice Outward - ${invoice.invoiceNo}`,
    });
  }

  return movements;
}

export function createPurchaseMovement(invoice: Invoice, warehouses: Warehouse[]): StockMovement[] {
  const defaultWh = warehouses.find((w) => w.isDefault) || warehouses[0];
  const movements: StockMovement[] = [];

  for (const line of invoice.lines) {
    if (!line.itemId) continue;

    const targetWhId = line.warehouseId || defaultWh?.id || "wh-main";
    const targetWhName = warehouses.find((w) => w.id === targetWhId)?.name || "Main Warehouse";

    movements.push({
      id: `mov-${invoice.invoiceNo}-${line.id || Math.random().toString(36).substr(2, 9)}`,
      date: invoice.date,
      dateNepali: invoice.dateNepali,
      type: MovementType.PURCHASE,
      itemId: line.itemId,
      itemName: line.itemName,
      warehouseId: targetWhId,
      warehouseName: targetWhName,
      qty: line.qty,
      rate: line.rate,
      amount: round2(line.qty * line.rate),
      referenceId: invoice.id,
      referenceNo: invoice.invoiceNo,
      referenceType: "purchase-invoice",
      batchNo: line.batchNo,
      narration: invoice.narration || `Purchase Invoice Receipt - ${invoice.invoiceNo}`,
    });
  }

  return movements;
}

export function createReturnMovement(
  invoice: Invoice,
  originalType: "sales" | "purchase",
): StockMovement[] {
  const movements: StockMovement[] = [];

  for (const line of invoice.lines) {
    if (!line.itemId) continue;

    const movType =
      originalType === "sales" ? MovementType.SALES_RETURN : MovementType.PURCHASE_RETURN;

    movements.push({
      id: `mov-ret-${invoice.invoiceNo}-${line.id || Math.random().toString(36).substr(2, 9)}`,
      date: invoice.date,
      dateNepali: invoice.dateNepali,
      type: movType,
      itemId: line.itemId,
      itemName: line.itemName,
      warehouseId: line.warehouseId || "wh-main",
      warehouseName: "Main Store Godown",
      qty: line.qty,
      rate: line.rate,
      amount: round2(line.qty * line.rate),
      referenceId: invoice.id,
      referenceNo: invoice.invoiceNo,
      referenceType: originalType === "sales" ? "sales-return" : "purchase-return",
      batchNo: line.batchNo,
      narration: invoice.narration || `Return transaction - ${invoice.invoiceNo}`,
    });
  }

  return movements;
}

export function createTransferMovement(
  journal: StockJournal,
  warehouses: Warehouse[],
): StockMovement[] {
  const movements: StockMovement[] = [];

  for (const line of journal.lines) {
    if (!line.itemId) continue;

    const fromWhId = line.fromWarehouseId || "wh-main";
    const toWhId = line.toWarehouseId || "wh-main";

    const fromWhName =
      warehouses.find((w) => w.id === fromWhId)?.name ||
      line.fromWarehouseName ||
      "Source Warehouse";
    const toWhName =
      warehouses.find((w) => w.id === toWhId)?.name ||
      line.toWarehouseName ||
      "Destination Warehouse";

    movements.push({
      id: `mov-transout-${journal.journalNo}-${line.id || Math.random().toString(36).substr(2, 9)}`,
      date: journal.date,
      dateNepali: journal.dateNepali,
      type: MovementType.TRANSFER_OUT,
      itemId: line.itemId,
      itemName: line.itemName,
      warehouseId: fromWhId,
      warehouseName: fromWhName,
      qty: line.qty,
      rate: line.rate,
      amount: round2(line.qty * line.rate),
      referenceId: journal.id,
      referenceNo: journal.journalNo,
      referenceType: "stock-journal",
      narration: journal.narration || `Transfer out of ${fromWhName} to ${toWhName}`,
    });

    movements.push({
      id: `mov-transin-${journal.journalNo}-${line.id || Math.random().toString(36).substr(2, 9)}`,
      date: journal.date,
      dateNepali: journal.dateNepali,
      type: MovementType.TRANSFER_IN,
      itemId: line.itemId,
      itemName: line.itemName,
      warehouseId: toWhId,
      warehouseName: toWhName,
      qty: line.qty,
      rate: line.rate,
      amount: round2(line.qty * line.rate),
      referenceId: journal.id,
      referenceNo: journal.journalNo,
      referenceType: "stock-journal",
      narration: journal.narration || `Transfer in to ${toWhName} from ${fromWhName}`,
    });
  }

  return movements;
}

// ==========================================
// 5. STOCK REPORT HELPERS
// ==========================================

export function getStockMovementReport(
  movements: StockMovement[],
  items: Item[],
  warehouses: Warehouse[],
  startDate: string,
  endDate: string,
  itemId?: string,
  warehouseId?: string,
): (StockMovement & { itemName: string; warehouseName: string; runningQty: number })[] {
  let filtered = [...movements];
  if (itemId) {
    filtered = filtered.filter((m) => m.itemId === itemId);
  }
  if (warehouseId) {
    filtered = filtered.filter((m) => m.warehouseId === warehouseId);
  }

  filtered.sort((a, b) => {
    const dDiff = a.date.localeCompare(b.date);
    if (dDiff !== 0) return dDiff;
    return (a.id || "").localeCompare(b.id || "");
  });

  let running = 0;
  const mapped = filtered.map((m) => {
    const item = items.find((i) => i.id === m.itemId);
    const wh = warehouses.find((w) => w.id === m.warehouseId);

    const isIncoming =
      m.type === MovementType.PURCHASE ||
      m.type === MovementType.TRANSFER_IN ||
      m.type === MovementType.OPENING ||
      m.type === MovementType.ADJUSTMENT ||
      m.type === MovementType.SALES_RETURN ||
      (m.type as string) === "purchase-return-inbound";

    if (isIncoming) {
      running = round2(running + m.qty);
    } else {
      running = round2(running - m.qty);
    }

    return {
      ...m,
      itemName: item?.name || m.itemName || "Unknown Item",
      warehouseName: wh?.name || m.warehouseName || "Unknown Warehouse",
      runningQty: running,
    };
  });

  return mapped.filter((m) => m.date >= startDate && m.date <= endDate);
}

export function getLowStockItems(
  movements: StockMovement[],
  items: Item[],
  warehouses: Warehouse[],
): (Item & { currentStock: number; warehouseId: string; warehouseName: string })[] {
  const result: (Item & { currentStock: number; warehouseId: string; warehouseName: string })[] =
    [];

  for (const item of items) {
    for (const wh of warehouses) {
      const position = computeStockPosition(movements, item.id, wh.id);
      const reorder = item.reorderLevel || 10;

      if (position.qty < reorder) {
        result.push({
          ...item,
          currentStock: position.qty,
          warehouseId: wh.id,
          warehouseName: wh.name,
        });
      }
    }
  }

  return result;
}

export function getStockValuationSummary(
  movements: StockMovement[],
  items: Item[],
  warehouses: Warehouse[],
  method: StockValuationMethod,
  asOfDate?: string,
): {
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
  rate: number;
  value: number;
}[] {
  return items
    .map((item) => {
      let positionQty = 0;
      let positionVal = 0;

      if (method === StockValuationMethod.FIFO) {
        const valuation = computeFIFOValuation(movements, item.id, null, asOfDate);
        positionQty = valuation.qty;
        positionVal = valuation.value;
      } else {
        const valuation = computeStockPosition(movements, item.id, null, asOfDate);
        positionQty = valuation.qty;
        positionVal = valuation.value;
      }

      const rate = positionQty > 0 ? round2(positionVal / positionQty) : 0;

      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit || "PCS",
        qty: positionQty,
        rate,
        value: positionVal,
      };
    })
    .filter((r) => r.qty > 0);
}

export function validateStockTransfer(
  fromWarehouseId: string,
  itemId: string,
  qty: number,
  movements: StockMovement[],
): { isValid: boolean; availableQty: number; error?: string } {
  const pos = computeStockPosition(movements, itemId, fromWarehouseId);
  const isValid = pos.qty >= qty;

  return {
    isValid,
    availableQty: pos.qty,
    error: isValid
      ? undefined
      : `Insufficient stock in source warehouse. Available: ${pos.qty}, Requested: ${qty}`,
  };
}

export function calculateStock(
  itemId: string,
  warehouseId: string | null,
): { qty: number; value: number; avgRate: number } {
  return {
    qty: 0,
    value: 0,
    avgRate: 0,
  };
}

export function calculateStockSummary(
  items: Item[],
  movements: StockMovement[],
): StockSummaryRow[] {
  const warehouses = [
    { id: "wh-main", name: "Primary Warehouse", code: "WH-01", isDefault: true, isActive: true },
  ];
  return computeAllStockPositions(movements, items, warehouses);
}
