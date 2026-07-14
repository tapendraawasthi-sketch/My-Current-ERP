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
import toast from "@/lib/appToast";
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

  postStockJournal: async (id: string) => {
    const db = getDB();
    const journal = await db.stockJournals.get(id);
    if (!journal) throw new Error("Stock journal not found");
    if (journal.status === "posted") throw new Error("Stock journal is already posted");

    const { warehouses, inventoryConfig } = get() as any;
    const allowNegative = inventoryConfig?.allowNegativeStock === true;
    const newMovements: any[] = [];

    for (const line of journal.lines || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;

      const fromWh = warehouses.find((w: any) => w.id === line.fromWarehouseId);
      const toWh = warehouses.find((w: any) => w.id === line.toWarehouseId);
      const rate = Number(line.rate || 0);

      if (!allowNegative && line.fromWarehouseId) {
        const existing = await db.stockMovements
          .where("itemId")
          .equals(line.itemId)
          .toArray()
          .catch(() => []);
        const onHand = existing
          .filter((m: any) => m.warehouseId === line.fromWarehouseId && m.date <= journal.date)
          .reduce((sum: number, m: any) => {
            const t = String(m.type || "").toLowerCase();
            const q = Number(m.qty || 0);
            return isOutwardType(t) ? sum - Math.abs(q) : sum + Math.abs(q);
          }, 0);
        if (onHand < qty) {
          throw new Error(
            `Insufficient stock for ${line.itemName || line.itemId} in ${fromWh?.name || "source warehouse"}`,
          );
        }
      }

      const outMov = {
        id: `mov-sj-${id}-out-${line.itemId}-${line.fromWarehouseId}`,
        date: journal.date,
        dateNepali: journal.dateNepali,
        type: "transfer-out",
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: line.fromWarehouseId,
        warehouseName: fromWh?.name,
        qty,
        rate,
        amount: qty * rate,
        referenceId: id,
        referenceNo: journal.journalNo,
        referenceType: "stock-journal",
        narration: journal.narration,
      };

      const inMov = {
        id: `mov-sj-${id}-in-${line.itemId}-${line.toWarehouseId}`,
        date: journal.date,
        dateNepali: journal.dateNepali,
        type: "transfer-in",
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: line.toWarehouseId,
        warehouseName: toWh?.name,
        qty,
        rate,
        amount: qty * rate,
        referenceId: id,
        referenceNo: journal.journalNo,
        referenceType: "stock-journal",
        narration: journal.narration,
      };

      await db.stockMovements.put(outMov);
      await db.stockMovements.put(inMov);
      newMovements.push(outMov, inMov);
    }

    await db.stockJournals.update(id, {
      status: "posted",
      postedAt: new Date().toISOString(),
    });

    set((s) => ({
      stockJournals: s.stockJournals.map((j: any) =>
        j.id === id ? { ...j, status: "posted", postedAt: new Date().toISOString() } : j,
      ),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },

  postProduction: async (id: string) => {
    const db = getDB();
    const entry = await db.productions.get(id);
    if (!entry) throw new Error("Production entry not found");
    if (entry.status === "POSTED" && entry.postedAt)
      throw new Error("Production entry is already posted");

    const { warehouses, inventoryConfig } = get() as any;
    const wh = getDefaultWarehouse(warehouses);
    const allowNegative = inventoryConfig?.allowNegativeStock === true;
    const newMovements: any[] = [];

    for (const line of entry.rawMaterials || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);
      await assertStockAvailable(db, line, wh.id, entry.date, qty, allowNegative, wh.name);
      const mov = buildOutMovement({
        id: `mov-prod-${id}-raw-${line.itemId}`,
        date: entry.date,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qty,
        rate,
        referenceId: id,
        referenceNo: entry.refNo,
        referenceType: "production",
        narration: entry.narration || "Production — raw material consumption",
        movementType: "adjustment-out",
      });
      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    for (const line of entry.finishedGoods || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);
      const mov = buildInMovement({
        id: `mov-prod-${id}-fg-${line.itemId}`,
        date: entry.date,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qty,
        rate,
        referenceId: id,
        referenceNo: entry.refNo,
        referenceType: "production",
        narration: entry.narration || "Production — finished goods",
        movementType: "adjustment-in",
      });
      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    const postedAt = new Date().toISOString();
    await db.productions.update(id, { status: "POSTED", postedAt });
    set((s) => ({
      productions: s.productions.map((p: any) =>
        p.id === id ? { ...p, status: "POSTED", postedAt } : p,
      ),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },

  postUnassemble: async (id: string) => {
    const db = getDB();
    const entry = await db.unassembles.get(id);
    if (!entry) throw new Error("Unassemble entry not found");
    if (entry.status === "POSTED" && entry.postedAt)
      throw new Error("Unassemble entry is already posted");

    const { warehouses, inventoryConfig } = get() as any;
    const wh = getDefaultWarehouse(warehouses);
    const allowNegative = inventoryConfig?.allowNegativeStock === true;
    const newMovements: any[] = [];

    for (const line of entry.finishedGoods || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);
      await assertStockAvailable(db, line, wh.id, entry.date, qty, allowNegative, wh.name);
      const mov = buildOutMovement({
        id: `mov-unasm-${id}-fg-${line.itemId}`,
        date: entry.date,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qty,
        rate,
        referenceId: id,
        referenceNo: entry.refNo,
        referenceType: "unassemble",
        narration: entry.narration || "Unassemble — finished goods out",
        movementType: "adjustment-out",
      });
      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    for (const line of entry.components || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);
      const mov = buildInMovement({
        id: `mov-unasm-${id}-comp-${line.itemId}`,
        date: entry.date,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qty,
        rate,
        referenceId: id,
        referenceNo: entry.refNo,
        referenceType: "unassemble",
        narration: entry.narration || "Unassemble — components in",
        movementType: "adjustment-in",
      });
      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    const postedAt = new Date().toISOString();
    await db.unassembles.update(id, { status: "POSTED", postedAt });
    set((s) => ({
      unassembles: s.unassembles.map((p: any) =>
        p.id === id ? { ...p, status: "POSTED", postedAt } : p,
      ),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },

  postMaterialIssued: async (id: string) => {
    const db = getDB();
    const entry = await db.materialIssued.get(id);
    if (!entry) throw new Error("Material issued entry not found");
    if (entry.status === "POSTED" && entry.postedAt)
      throw new Error("Material issued entry is already posted");

    const { warehouses, inventoryConfig } = get() as any;
    const wh = getDefaultWarehouse(warehouses);
    const allowNegative = inventoryConfig?.allowNegativeStock === true;
    const newMovements: any[] = [];

    for (const line of entry.items || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);
      await assertStockAvailable(db, line, wh.id, entry.date, qty, allowNegative, wh.name);
      const mov = buildOutMovement({
        id: `mov-mat-out-${id}-${line.itemId}`,
        date: entry.date,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qty,
        rate,
        referenceId: id,
        referenceNo: entry.refNo,
        referenceType: "material-issued",
        narration: entry.narration || `Material issued to ${entry.partyName || "party"}`,
        movementType: "material-issued",
      });
      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    const postedAt = new Date().toISOString();
    await db.materialIssued.update(id, { status: "POSTED", postedAt });
    set((s) => ({
      materialIssued: s.materialIssued.map((p: any) =>
        p.id === id ? { ...p, status: "POSTED", postedAt } : p,
      ),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },

  postMaterialReceived: async (id: string) => {
    const db = getDB();
    const entry = await db.materialReceived.get(id);
    if (!entry) throw new Error("Material received entry not found");
    if (entry.status === "POSTED" && entry.postedAt)
      throw new Error("Material received entry is already posted");

    const { warehouses } = get() as any;
    const wh = getDefaultWarehouse(warehouses);
    const newMovements: any[] = [];

    for (const line of entry.items || []) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);
      const mov = buildInMovement({
        id: `mov-mat-in-${id}-${line.itemId}`,
        date: entry.date,
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: wh.id,
        warehouseName: wh.name,
        qty,
        rate,
        referenceId: id,
        referenceNo: entry.refNo,
        referenceType: "material-received",
        narration: entry.narration || `Material received from ${entry.partyName || "party"}`,
        movementType: "material-received",
      });
      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    const postedAt = new Date().toISOString();
    await db.materialReceived.update(id, { status: "POSTED", postedAt });
    set((s) => ({
      materialReceived: s.materialReceived.map((p: any) =>
        p.id === id ? { ...p, status: "POSTED", postedAt } : p,
      ),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },

  postPhysicalStock: async (id: string) => {
    const db = getDB();
    const entry = (await db.physicalStocks.get(id)) as any;
    if (!entry) throw new Error("Physical stock entry not found");
    if (entry.status === "POSTED" && entry.postedAt)
      throw new Error("Physical stock entry is already posted");

    const { warehouses } = get() as any;
    const wh = getDefaultWarehouse(warehouses);
    const newMovements: any[] = [];
    const stockLines: any[] = entry.lines || entry.items || [];

    for (const line of stockLines) {
      const variance = Number(line.difference ?? line.variance ?? line.qty ?? 0);
      if (variance === 0) continue;
      const rate = Number(line.rate || 0);
      const qty = Math.abs(variance);
      const isExcess = variance > 0;
      const refNo = entry.stockNo || entry.refNo;

      const mov = isExcess
        ? buildInMovement({
            id: `mov-phys-${id}-${line.itemId}-in`,
            date: entry.date,
            itemId: line.itemId,
            itemName: line.itemName,
            warehouseId: wh.id,
            warehouseName: wh.name,
            qty,
            rate,
            referenceId: id,
            referenceNo: refNo,
            referenceType: "physical-stock",
            narration: entry.narration || "Physical stock — excess",
            movementType: "adjustment-in",
          })
        : buildOutMovement({
            id: `mov-phys-${id}-${line.itemId}-out`,
            date: entry.date,
            itemId: line.itemId,
            itemName: line.itemName,
            warehouseId: wh.id,
            warehouseName: wh.name,
            qty,
            rate,
            referenceId: id,
            referenceNo: refNo,
            referenceType: "physical-stock",
            narration: entry.narration || "Physical stock — shortage",
            movementType: "adjustment-out",
          });

      await db.stockMovements.put(mov);
      newMovements.push(mov);
    }

    const postedAt = new Date().toISOString();
    await db.physicalStocks.update(id, { status: "POSTED", postedAt } as any);
    set((s) => ({
      physicalStocks: s.physicalStocks.map((p: any) =>
        p.id === id ? { ...p, status: "POSTED", postedAt } : p,
      ),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },

  postRejectionStock: async (voucherId: string) => {
    const db = getDB();
    const voucher = (await db.vouchers.get(voucherId)) as any;
    if (!voucher) throw new Error("Rejection voucher not found");
    if (voucher.stockPostedAt) throw new Error("Stock already posted for this rejection");

    const isOut = String(voucher.type || "").toLowerCase() === "rejection-out";
    const { warehouses, inventoryConfig } = get() as any;
    const wh = getDefaultWarehouse(warehouses);
    const allowNegative = inventoryConfig?.allowNegativeStock === true;
    const itemLines: any[] = voucher.itemLines || [];
    const newMovements: any[] = [];

    for (const line of itemLines) {
      const qty = Number(line.qty || 0);
      if (qty <= 0) continue;
      const rate = Number(line.rate || 0);

      if (isOut) {
        await assertStockAvailable(db, line, wh.id, voucher.date, qty, allowNegative, wh.name);
        const mov = buildOutMovement({
          id: `mov-rej-${voucherId}-${line.itemId}`,
          date: voucher.date,
          itemId: line.itemId || line.id,
          itemName: line.itemName,
          warehouseId: wh.id,
          warehouseName: wh.name,
          qty,
          rate,
          referenceId: voucherId,
          referenceNo: voucher.voucherNo,
          referenceType: "rejection-out",
          narration: voucher.narration || "Rejection out to supplier",
          movementType: "rejection-out",
        });
        await db.stockMovements.put(mov);
        newMovements.push(mov);
      } else {
        const mov = buildInMovement({
          id: `mov-rej-${voucherId}-${line.itemId}`,
          date: voucher.date,
          itemId: line.itemId || line.id,
          itemName: line.itemName,
          warehouseId: wh.id,
          warehouseName: wh.name,
          qty,
          rate,
          referenceId: voucherId,
          referenceNo: voucher.voucherNo,
          referenceType: "rejection-in",
          narration: voucher.narration || "Rejection in from customer",
          movementType: "rejection-in",
        });
        await db.stockMovements.put(mov);
        newMovements.push(mov);
      }
    }

    const stockPostedAt = new Date().toISOString();
    await db.vouchers.update(voucherId, { stockPostedAt } as any);
    set((s) => ({
      vouchers: s.vouchers.map((v: any) => (v.id === voucherId ? { ...v, stockPostedAt } : v)),
      stockMovements: [...s.stockMovements, ...newMovements],
    }));
  },
});

function getDefaultWarehouse(warehouses: any[]): { id: string; name: string } {
  const wh =
    warehouses?.find((w: any) => w.isDefault && w.isActive !== false) ||
    warehouses?.find((w: any) => w.isActive !== false);
  if (!wh) throw new Error("No active warehouse configured");
  return { id: wh.id, name: wh.name };
}

async function assertStockAvailable(
  db: ReturnType<typeof getDB>,
  line: { itemId: string; itemName?: string },
  warehouseId: string,
  asOfDate: string,
  qty: number,
  allowNegative: boolean,
  warehouseName?: string,
): Promise<void> {
  if (allowNegative) return;
  const existing = await db.stockMovements
    .where("itemId")
    .equals(line.itemId)
    .toArray()
    .catch(() => []);
  const onHand = existing
    .filter((m: any) => m.warehouseId === warehouseId && m.date <= asOfDate)
    .reduce((sum: number, m: any) => {
      const t = String(m.type || "").toLowerCase();
      const q = Number(m.qty || 0);
      return isOutwardType(t) ? sum - Math.abs(q) : sum + Math.abs(q);
    }, 0);
  if (onHand < qty) {
    throw new Error(
      `Insufficient stock for ${line.itemName || line.itemId} in ${warehouseName || "warehouse"}`,
    );
  }
}

function buildInMovement(args: {
  id: string;
  date: string;
  itemId: string;
  itemName?: string;
  warehouseId: string;
  warehouseName?: string;
  qty: number;
  rate: number;
  referenceId: string;
  referenceNo?: string;
  referenceType: string;
  narration?: string;
  movementType: string;
}) {
  return {
    id: args.id,
    date: args.date,
    type: args.movementType,
    itemId: args.itemId,
    itemName: args.itemName,
    warehouseId: args.warehouseId,
    warehouseName: args.warehouseName,
    qty: args.qty,
    rate: args.rate,
    amount: args.qty * args.rate,
    referenceId: args.referenceId,
    referenceNo: args.referenceNo,
    referenceType: args.referenceType,
    narration: args.narration,
  };
}

function buildOutMovement(args: {
  id: string;
  date: string;
  itemId: string;
  itemName?: string;
  warehouseId: string;
  warehouseName?: string;
  qty: number;
  rate: number;
  referenceId: string;
  referenceNo?: string;
  referenceType: string;
  narration?: string;
  movementType: string;
}) {
  return {
    ...buildInMovement(args),
    qty: args.qty,
  };
}

function isOutwardType(type: string): boolean {
  return (
    type.includes("sales") ||
    type.includes("transfer-out") ||
    type.includes("adjustment-out") ||
    type.includes("material-issued") ||
    type.includes("rejection-out") ||
    type.includes("consumption") ||
    type === "out"
  );
}
