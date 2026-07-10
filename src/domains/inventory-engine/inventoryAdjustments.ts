import type { StockMovementRecord } from "./inventoryAggregate";
import { MovementKinds } from "./inventoryAggregate";
import { movementKindToEventType } from "./inventoryMovements";

export function buildAdjustmentMovement(input: {
  itemId: string;
  itemName: string;
  warehouseId: string;
  qty: number;
  rate: number;
  date: string;
  narration?: string;
  sequence: number;
}): StockMovementRecord {
  return {
    id: crypto.randomUUID(),
    sequence: input.sequence,
    itemId: input.itemId,
    itemName: input.itemName,
    warehouseId: input.warehouseId,
    kind: MovementKinds.ADJUSTMENT,
    qty: input.qty,
    rate: input.rate,
    amount: input.qty * input.rate,
    date: input.date,
    narration: input.narration,
    inventoryEventType: movementKindToEventType(MovementKinds.ADJUSTMENT),
    createdAt: new Date().toISOString(),
  };
}
