import { readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionStockBalance } from "@/platform/projections/projectionState";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export interface InventoryValuationRow {
  itemId: string;
  itemName: string;
  qty: number;
  value: number;
  rate: number;
}

export async function buildInventoryValuationReport(): Promise<{
  rows: InventoryValuationRow[];
  totalValue: number;
}> {
  const balances = await readProjectionRows<DBProjectionStockBalance>("projectionStockBalances");
  const items = state.getItems() as Array<{ id: string; name: string }>;
  const itemMap = new Map(items.map((i) => [i.id, i.name]));

  const rows: InventoryValuationRow[] = balances.map((b) => {
    const qty = Number(b.qty ?? 0);
    const value = Number(b.value ?? 0);
    return {
      itemId: String(b.itemId),
      itemName: itemMap.get(String(b.itemId)) ?? String(b.itemId),
      qty,
      value,
      rate: qty > 0 ? value / qty : 0,
    };
  });

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  return { rows, totalValue };
}
