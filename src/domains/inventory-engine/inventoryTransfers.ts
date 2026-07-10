import type { StockMovementRecord } from "./inventoryAggregate";
import { MovementKinds } from "./inventoryAggregate";
import { movementKindToEventType } from "./inventoryMovements";

export function buildTransferMovements(input: {
  itemId: string;
  itemName: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qty: number;
  rate: number;
  date: string;
  referenceId?: string;
  sequence: number;
}): StockMovementRecord[] {
  const base = {
    itemId: input.itemId,
    itemName: input.itemName,
    kind: MovementKinds.TRANSFER,
    qty: input.qty,
    rate: input.rate,
    amount: input.qty * input.rate,
    date: input.date,
    referenceId: input.referenceId,
    referenceType: "transfer",
    inventoryEventType: movementKindToEventType(MovementKinds.TRANSFER),
    createdAt: new Date().toISOString(),
  };
  return [
    { ...base, id: crypto.randomUUID(), sequence: input.sequence, warehouseId: input.fromWarehouseId, qty: -Math.abs(input.qty) },
    { ...base, id: crypto.randomUUID(), sequence: input.sequence + 1, warehouseId: input.toWarehouseId, qty: Math.abs(input.qty) },
  ];
}
