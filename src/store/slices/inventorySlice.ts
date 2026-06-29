import {
  StoreUser,
  CompanySettings,
  Notification,
  FiscalYear,
  DEFAULT_CURRENCY,
  DEFAULT_TDS_RATES,
  hashPassword,
  verifyPassword,
} from "../store.types";
import { StateCreator } from "zustand";
import type { AppState } from "../store.types";
import { getDB, generateId } from "../../lib/db";
import { generateNextNumber } from "../../lib/accounting";
import { startCbmsQueueWorker } from "../../lib/cbmsService";
import { validateVoucherBalance, assertDateInFiscalYear } from "../store.types";
import toast from "react-hot-toast";
import { migrateWorkflowFields } from "../../lib/workflowMigration";
import { createWorkflowActions } from "../workflowActions";

export const createInventorySlice: StateCreator<AppState, [], [], any> = (set, get) => ({
  // ── Items ─────────────────────────────────────────────────────────────────
  addItem: async (item) => {
    const db = getDB();
    const id = item.id || `item-${generateId()}`;
    const newItem = { ...item, id, isActive: item.isActive !== false } as any;
    await db.items.add(newItem as any);
    if (((newItem as any).openingStock || 0) > 0) {
      const movId = `mov-opening-${id}`;
      const movement = {
        id: movId,
        date: get().currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
        dateNepali: get().currentFiscalYear?.name || "",
        type: "opening",
        itemId: id,
        itemName: (newItem as any).name,
        warehouseId: get().warehouses.find((w: any) => w.isDefault)?.id || "wh-main",
        warehouseName: get().warehouses.find((w: any) => w.isDefault)?.name || "Main Warehouse",
        qty: (newItem as any).openingStock,
        rate: (newItem as any).openingStockRate || 0,
        amount: ((newItem as any).openingStock || 0) * ((newItem as any).openingStockRate || 0),
        referenceType: "opening-balance",
        narration: "Opening stock",
      };
      await db.stockMovements.add(movement as any);
      set((s) => ({ stockMovements: [...s.stockMovements, movement] }));
    }
    set((s) => ({ items: [...s.items, newItem] }));
    return newItem;
  },

  updateItem: async (item) => {
    const db = getDB();
    await db.items.update(item.id, item);
    const fullItem = await db.items.get(item.id);
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, ...fullItem } : i)),
    }));
    return fullItem;
  },

  // ── Warehouses & Stock Transfers ──────────────────────────────────────────
  loadWarehouses: async () => {
    const db = getDB();
    const warehouses = await db.warehouses.toArray();
    set({ warehouses });
  },

  addWarehouse: async (w) => {
    const db = getDB();
    const id = w.id || `wh-${generateId()}`;
    const newWh = { ...w, id } as any;
    await db.warehouses.add(newWh);
    set((s) => ({ warehouses: [...s.warehouses, newWh] }));
    return newWh;
  },

  updateWarehouse: async (w) => {
    const db = getDB();
    await db.warehouses.update(w.id, w as any);
    set((s) => ({
      warehouses: s.warehouses.map((wh) => (wh.id === w.id ? { ...wh, ...w } : wh)),
    }));
  },

  getNextTransferNo: async () => {
    const db = getDB();
    const count = await db.stockTransfers.count();
    return `TR-${String(count + 1).padStart(4, "0")}`;
  },

  saveStockTransfer: async (t) => {
    const db = getDB();
    const id = t.id || `tr-${generateId()}`;
    const newTransfer = { ...t, id } as any;

    if (newTransfer.status === "completed" && newTransfer.lines) {
      for (const line of newTransfer.lines) {
        await db.stockMovements.add({
          id: `mov-${id}-out-${line.itemId}`,
          date: newTransfer.date,
          dateNepali: newTransfer.dateNepali,
          type: "transfer-out",
          itemId: line.itemId,
          itemName: line.itemName,
          warehouseId: newTransfer.fromWarehouseId,
          warehouseName: newTransfer.fromWarehouseName,
          qty: -Number(line.qty || 0),
          rate: line.rate,
          amount: Number(line.amount || 0),
          referenceId: id,
          referenceNo: newTransfer.transferNo,
          referenceType: "stock-transfer",
        } as any);

        await db.stockMovements.add({
          id: `mov-${id}-in-${line.itemId}`,
          date: newTransfer.date,
          dateNepali: newTransfer.dateNepali,
          type: "transfer-in",
          itemId: line.itemId,
          itemName: line.itemName,
          warehouseId: newTransfer.toWarehouseId,
          warehouseName: newTransfer.toWarehouseName,
          qty: Number(line.qty || 0),
          rate: line.rate,
          amount: Number(line.amount || 0),
          referenceId: id,
          referenceNo: newTransfer.transferNo,
          referenceType: "stock-transfer",
        } as any);
      }
    }

    await db.stockTransfers.add(newTransfer);
    set((s) => ({ stockTransfers: [...s.stockTransfers, newTransfer] }));
    return newTransfer;
  },

  // ── Delivery / GRN ────────────────────────────────────────────────────────
  addDeliveryChallan: async (challan) => {
    const { currentFiscalYear } = get();
    assertDateInFiscalYear(challan.date, currentFiscalYear);

    const db = getDB();
    const id = generateId();
    const count = await db.deliveryChallans.count();
    const challanNo = `DC-${String(count + 1).padStart(4, "0")}`;
    const newChallan = { ...challan, id, challanNo };
    await db.deliveryChallans.add(newChallan as any);
    set((s) => ({ deliveryChallans: [...s.deliveryChallans, newChallan] }));
    return newChallan;
  },

  addGoodsReceiptNote: async (grn) => {
    const { currentFiscalYear } = get();
    assertDateInFiscalYear(grn.date, currentFiscalYear);

    const db = getDB();
    const id = generateId();
    const count = await db.goodsReceiptNotes.count();
    const grnNo = `GRN-${String(count + 1).padStart(4, "0")}`;
    const newGrn = { ...grn, id, grnNo };
    await db.goodsReceiptNotes.add(newGrn as any);
    set((s) => ({ goodsReceiptNotes: [...s.goodsReceiptNotes, newGrn] }));
    return newGrn;
  },
});
