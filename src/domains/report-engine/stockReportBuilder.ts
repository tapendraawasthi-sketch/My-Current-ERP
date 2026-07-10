import { readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionStockLedger, DBProjectionStockBalance } from "@/platform/projections/projectionState";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export interface StockReportRow {
  itemId: string;
  itemName: string;
  inQty: number;
  outQty: number;
  balanceQty: number;
}

export async function buildStockReportFromProjection(): Promise<StockReportRow[]> {
  const ledger = await readProjectionRows<DBProjectionStockLedger>("projectionStockLedger");
  const balances = await readProjectionRows<DBProjectionStockBalance>("projectionStockBalances");
  const items = state.getItems() as Array<{ id: string; name: string }>;
  const itemMap = new Map(items.map((i) => [i.id, i.name]));

  const byItem = new Map<string, StockReportRow>();
  for (const row of ledger) {
    const itemId = String(row.itemId);
    const existing = byItem.get(itemId) ?? {
      itemId,
      itemName: itemMap.get(itemId) ?? itemId,
      inQty: 0,
      outQty: 0,
      balanceQty: 0,
    };
    existing.inQty += Number(row.inQty ?? 0);
    existing.outQty += Number(row.outQty ?? 0);
    byItem.set(itemId, existing);
  }

  for (const bal of balances) {
    const itemId = String(bal.itemId);
    const existing = byItem.get(itemId) ?? {
      itemId,
      itemName: itemMap.get(itemId) ?? itemId,
      inQty: 0,
      outQty: 0,
      balanceQty: 0,
    };
    existing.balanceQty = Number(bal.qty ?? 0);
    byItem.set(itemId, existing);
  }

  return Array.from(byItem.values());
}
