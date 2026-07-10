import type { InventoryAggregate } from "./inventoryAggregate";
import { buildClosingEvent } from "./inventoryOpening";

export function closeInventoryPeriod(aggregates: InventoryAggregate[]) {
  return aggregates.map((aggregate) => buildClosingEvent(aggregate));
}
