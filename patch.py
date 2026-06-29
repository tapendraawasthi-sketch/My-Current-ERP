import sys

with open('src/store/index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports and slice interface
imports = '''import type {
  DBWarehouse,
  DBStockMovement,
  DBStockTransferVoucher,
} from "../lib/db";

const transferNo = (n: number) => `TRF-${String(n).padStart(4, "0")}`;

export interface MultiGodownStoreSlice {
  warehouses: DBWarehouse[];
  stockMovements: DBStockMovement[];
  stockTransfers: DBStockTransferVoucher[];

  loadWarehouses: () => Promise<void>;
  addWarehouse: (warehouse: Omit<DBWarehouse, "id">) => Promise<DBWarehouse>;
  updateWarehouse: (id: string, updates: Partial<DBWarehouse>) => Promise<void>;

  getNextTransferNo: () => Promise<string>;
  saveStockTransfer: (
    transfer: Omit<
      DBStockTransferVoucher,
      "id" | "transferNo" | "createdAt" | "updatedAt" | "status"
    >
  ) => Promise<DBStockTransferVoucher>;
}
'''
if 'export interface MultiGodownStoreSlice' not in content:
    content = content.replace('interface AppState {', imports + '\ninterface AppState extends MultiGodownStoreSlice {')

# 2. Add stockTransfers to initial state
if 'stockTransfers: [],' not in content:
    content = content.replace('warehouses: [],', 'warehouses: [],\n  stockTransfers: [],')

# 3. Add actions to end of create block
actions = '''
  loadWarehouses: async () => {
    const db = getDB();
    const warehouses = await db.warehouses.toArray();
    set({ warehouses });
  },

  addWarehouse: async (warehouse) => {
    const db = getDB();
    const row: DBWarehouse = {
      ...warehouse,
      id: crypto.randomUUID(),
    };

    await db.warehouses.put(row);

    set((state: any) => ({
      warehouses: [...(state.warehouses || []), row],
    }));

    return row;
  },

  updateWarehouse: async (id, updates) => {
    const db = getDB();

    await db.warehouses.update(id, updates);

    set((state: any) => ({
      warehouses: (state.warehouses || []).map((w: DBWarehouse) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    }));
  },

  getNextTransferNo: async () => {
    const db = getDB();
    const count = await db.stockTransfers.count();
    return transferNo(count + 1);
  },

  saveStockTransfer: async (draft) => {
    const db = getDB();
    const no = await get().getNextTransferNo();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const voucher: DBStockTransferVoucher = {
      ...draft,
      id,
      transferNo: no,
      status: "posted",
      createdAt: now,
      updatedAt: now,
    };

    const movements: DBStockMovement[] = [];

    for (const line of voucher.lines) {
      movements.push({
        id: crypto.randomUUID(),
        date: voucher.date,
        dateNepali: voucher.dateNepali,
        type: "stock-transfer-out",
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: voucher.fromWarehouseId,
        warehouseName: voucher.fromWarehouseName,
        qty: line.qty,
        rate: line.rate,
        amount: line.amount,
        referenceId: voucher.id,
        referenceType: "stock-transfer",
        referenceNo: voucher.transferNo,
        batchNo: line.fromBatch,
        branchId: voucher.fromBranchId,
        branchName: voucher.fromBranchName,
      });

      movements.push({
        id: crypto.randomUUID(),
        date: voucher.date,
        dateNepali: voucher.dateNepali,
        type: "stock-transfer-in",
        itemId: line.itemId,
        itemName: line.itemName,
        warehouseId: voucher.toWarehouseId,
        warehouseName: voucher.toWarehouseName,
        qty: line.qty,
        rate: line.rate,
        amount: line.amount,
        referenceId: voucher.id,
        referenceType: "stock-transfer",
        referenceNo: voucher.transferNo,
        batchNo: line.fromBatch,
        branchId: voucher.toBranchId,
        branchName: voucher.toBranchName,
      });
    }

    await db.transaction("rw", db.stockTransfers, db.stockMovements, async () => {
      await db.stockTransfers.put(voucher);
      await db.stockMovements.bulkPut(movements);
    });

    if (voucher.isInterBranch && get().addVoucher) {
      const accountingVoucher = await get().addVoucher({
        date: voucher.date,
        dateNepali: voucher.dateNepali,
        type: "journal",
        narration: `Inter-branch stock transfer ${voucher.transferNo}: ${voucher.fromBranchName} to ${voucher.toBranchName}`,
        totalDebit: voucher.totalAmount,
        totalCredit: voucher.totalAmount,
        lines: [
          {
            accountName: "Branch Transfer Receivable",
            debit: voucher.totalAmount,
            credit: 0,
            costCenterId: undefined,
          },
          {
            accountName: "Branch Transfer Payable",
            debit: 0,
            credit: voucher.totalAmount,
            costCenterId: undefined,
          },
        ],
      });

      voucher.accountingVoucherId = accountingVoucher?.id;
      await db.stockTransfers.update(voucher.id, {
        accountingVoucherId: accountingVoucher?.id,
      });
    }

    set((state: any) => ({
      stockTransfers: [...(state.stockTransfers || []), voucher],
      stockMovements: [...(state.stockMovements || []), ...movements],
    }));

    return voucher;
  },
'''
if 'loadWarehouses: async' not in content:
    content = content.replace('}));\n\n// \u2500\u2500\u2500 Private helpers', actions + '\n}));\n\n// \u2500\u2500\u2500 Private helpers')

with open('src/store/index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
