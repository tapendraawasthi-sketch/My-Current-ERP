import { createLegacyStateReader } from "@fios/legacy";
import { listAggregates, listMovements } from "./inventoryRepository";

const state = createLegacyStateReader();

export interface ReconciliationDiff {
  itemId: string;
  warehouseId?: string;
  metric: string;
  legacyValue: number;
  shadowValue: number;
  diff: number;
}

export function reconcileStockBalances(): ReconciliationDiff[] {
  const diffs: ReconciliationDiff[] = [];
  const legacyMovements = state.getStockMovements();
  const legacyByItem = new Map<string, number>();

  for (const mov of legacyMovements) {
    const itemId = String((mov as { itemId?: string }).itemId ?? "");
    if (!itemId) continue;
    const qty = Number((mov as { qty?: number }).qty ?? 0);
    legacyByItem.set(itemId, (legacyByItem.get(itemId) ?? 0) + qty);
  }

  const shadowAggregates = listAggregates();
  const shadowByItem = new Map<string, number>();
  for (const agg of shadowAggregates) {
    shadowByItem.set(agg.itemId, (shadowByItem.get(agg.itemId) ?? 0) + agg.onHandQty);
  }

  const allItems = new Set([...legacyByItem.keys(), ...shadowByItem.keys()]);
  for (const itemId of allItems) {
    const legacyValue = legacyByItem.get(itemId) ?? 0;
    const shadowValue = shadowByItem.get(itemId) ?? 0;
    if (legacyValue !== shadowValue) {
      diffs.push({
        itemId,
        metric: "closingQty",
        legacyValue,
        shadowValue,
        diff: shadowValue - legacyValue,
      });
    }
  }
  return diffs;
}

export function reconcileMovementCounts(): ReconciliationDiff[] {
  const legacyCount = state.getStockMovements().length;
  const shadowCount = listMovements().length;
  if (legacyCount === shadowCount) return [];
  return [
    {
      itemId: "*",
      metric: "movementCount",
      legacyValue: legacyCount,
      shadowValue: shadowCount,
      diff: shadowCount - legacyCount,
    },
  ];
}

export function runReconciliation(): ReconciliationDiff[] {
  return [...reconcileStockBalances(), ...reconcileMovementCounts()];
}
