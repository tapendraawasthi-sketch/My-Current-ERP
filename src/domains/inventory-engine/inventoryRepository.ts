import type {
  InventoryAggregate,
  ShadowInventoryEvent,
  StockMovementRecord,
} from "./inventoryAggregate";

const aggregates = new Map<string, InventoryAggregate>();
const movements: StockMovementRecord[] = [];
const shadowEvents: ShadowInventoryEvent[] = [];
const movementIds = new Set<string>();

function aggregateKey(itemId: string, warehouseId: string): string {
  return `${itemId}:${warehouseId}`;
}

export function getAggregate(itemId: string, warehouseId: string): InventoryAggregate | null {
  return aggregates.get(aggregateKey(itemId, warehouseId)) ?? null;
}

export function listAggregates(): InventoryAggregate[] {
  return Array.from(aggregates.values());
}

export function listMovements(itemId?: string): StockMovementRecord[] {
  if (!itemId) return [...movements];
  return movements.filter((m) => m.itemId === itemId);
}

export function appendMovement(movement: StockMovementRecord): void {
  if (movementIds.has(movement.id)) return;
  movementIds.add(movement.id);
  movements.push(movement);

  const key = aggregateKey(movement.itemId, movement.warehouseId);
  const existing = aggregates.get(key);
  const onHandQty = (existing?.onHandQty ?? 0) + movement.qty;
  const totalValue = (existing?.totalValue ?? 0) + movement.amount;
  const averageCost = onHandQty !== 0 ? totalValue / onHandQty : movement.rate;
  const reservedQty = existing?.reservedQty ?? 0;

  aggregates.set(key, {
    itemId: movement.itemId,
    itemName: movement.itemName,
    warehouseId: movement.warehouseId,
    onHandQty,
    reservedQty,
    availableQty: onHandQty - reservedQty,
    averageCost,
    totalValue,
    lastMovementSequence: movement.sequence,
    version: (existing?.version ?? 0) + 1,
  });
}

export function appendShadowEvent(event: ShadowInventoryEvent): void {
  shadowEvents.push(event);
}

export function listShadowEvents(): ShadowInventoryEvent[] {
  return [...shadowEvents];
}

export function nextMovementSequence(): number {
  return movements.length + 1;
}

export function clearShadowRepository(): void {
  aggregates.clear();
  movements.length = 0;
  shadowEvents.length = 0;
  movementIds.clear();
}

export function hasDuplicateMovement(id: string): boolean {
  return movementIds.has(id);
}
