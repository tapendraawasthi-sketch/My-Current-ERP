import type { InventoryTransaction } from "./inventoryAggregate";

const transactions: InventoryTransaction[] = [];

export function recordTransaction(tx: InventoryTransaction): void {
  transactions.push(tx);
}

export function listTransactions(itemId?: string): InventoryTransaction[] {
  if (!itemId) return [...transactions];
  return transactions.filter((t) => t.itemId === itemId);
}

export function clearTransactions(): void {
  transactions.length = 0;
}
