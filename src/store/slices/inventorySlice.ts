import { StoreUser, CompanySettings, Notification, FiscalYear, DEFAULT_CURRENCY, DEFAULT_TDS_RATES, hashPassword, verifyPassword } from '../store.types';
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
    // Seed opening stock movement if needed
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
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)),
    }));
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
