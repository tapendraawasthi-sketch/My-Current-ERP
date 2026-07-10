import type { InventoryAggregate } from "./inventoryAggregate";
import { InventoryEventTypes } from "./inventoryAggregate";

export function buildOpeningEvent(itemId: string, warehouseId: string, qty: number, rate: number) {
  return {
    eventId: crypto.randomUUID(),
    eventType: InventoryEventTypes.INVENTORY_OPENED,
    aggregateId: itemId,
    payload: { itemId, warehouseId, qty, rate },
    occurredAt: new Date().toISOString(),
  };
}

export function buildClosingEvent(aggregate: InventoryAggregate) {
  return {
    eventId: crypto.randomUUID(),
    eventType: InventoryEventTypes.INVENTORY_CLOSED,
    aggregateId: aggregate.itemId,
    payload: { ...aggregate },
    occurredAt: new Date().toISOString(),
  };
}
