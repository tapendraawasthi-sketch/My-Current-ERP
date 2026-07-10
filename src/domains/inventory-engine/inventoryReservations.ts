import type { InventoryReservation } from "./inventoryAggregate";

const reservations: InventoryReservation[] = [];

export function createReservation(input: Omit<InventoryReservation, "id" | "status" | "createdAt">): InventoryReservation {
  const row: InventoryReservation = {
    ...input,
    id: crypto.randomUUID(),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  reservations.push(row);
  return row;
}

export function releaseReservation(id: string): void {
  const row = reservations.find((r) => r.id === id);
  if (row) row.status = "released";
}

export function listReservations(itemId?: string): InventoryReservation[] {
  if (!itemId) return [...reservations];
  return reservations.filter((r) => r.itemId === itemId);
}

export function activeReservedQty(itemId: string, warehouseId: string): number {
  return reservations
    .filter((r) => r.itemId === itemId && r.warehouseId === warehouseId && r.status === "active")
    .reduce((sum, r) => sum + r.qty, 0);
}

export function clearReservations(): void {
  reservations.length = 0;
}
