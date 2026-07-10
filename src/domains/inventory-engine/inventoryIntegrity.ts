import type { StockMovementRecord } from "./inventoryAggregate";
import { activeReservedQty } from "./inventoryReservations";
import { getAggregate, hasDuplicateMovement, listAggregates, listMovements } from "./inventoryRepository";
import { listCostLayers } from "./inventoryCostLayers";

export interface IntegrityIssue {
  code: string;
  message: string;
  itemId?: string;
  warehouseId?: string;
}

export function detectNegativeStock(
  itemId: string,
  warehouseId: string,
  onHandQty: number,
): IntegrityIssue | null {
  if (onHandQty < 0) {
    return {
      code: "NEGATIVE_STOCK",
      message: `Negative stock for ${itemId}@${warehouseId}: ${onHandQty}`,
      itemId,
      warehouseId,
    };
  }
  return null;
}

export function detectDuplicateMovement(movementId: string): IntegrityIssue | null {
  if (hasDuplicateMovement(movementId)) {
    return { code: "DUPLICATE_MOVEMENT", message: `Duplicate movement ${movementId}` };
  }
  return null;
}

export function validateMovementSequence(records: StockMovementRecord[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const byKey = new Map<string, StockMovementRecord[]>();
  for (const record of records) {
    const key = `${record.itemId}:${record.warehouseId}`;
    const list = byKey.get(key) ?? [];
    list.push(record);
    byKey.set(key, list);
  }
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].sequence !== i + 1) {
        issues.push({
          code: "SEQUENCE_GAP",
          message: `Movement sequence gap for ${key}`,
        });
        break;
      }
    }
  }
  return issues;
}

export function validateReservationConsistency(itemId: string, warehouseId: string, onHandQty: number): IntegrityIssue | null {
  const reserved = activeReservedQty(itemId, warehouseId);
  if (reserved > onHandQty) {
    return {
      code: "RESERVATION_OVERFLOW",
      message: `Reserved qty ${reserved} exceeds on hand ${onHandQty}`,
      itemId,
      warehouseId,
    };
  }
  return null;
}

export function validateCostLayerConsistency(itemId: string, warehouseId: string): IntegrityIssue | null {
  const aggregate = getAggregate(itemId, warehouseId);
  if (!aggregate) return null;
  const layerQty = listCostLayers(itemId)
    .filter((l) => l.warehouseId === warehouseId)
    .reduce((sum, l) => sum + l.remainingQty, 0);
  if (Math.abs(layerQty - aggregate.onHandQty) > 0.001) {
    return {
      code: "COST_LAYER_MISMATCH",
      message: `Cost layer qty ${layerQty} != on hand ${aggregate.onHandQty}`,
      itemId,
      warehouseId,
    };
  }
  return null;
}

export function runIntegrityChecks(): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  issues.push(...validateMovementSequence(listMovements()));
  for (const aggregate of listAggregates()) {
    const negIssue = detectNegativeStock(aggregate.itemId, aggregate.warehouseId, aggregate.onHandQty);
    if (negIssue) issues.push(negIssue);
    const layerIssue = validateCostLayerConsistency(aggregate.itemId, aggregate.warehouseId);
    if (layerIssue) issues.push(layerIssue);
    const reservationIssue = validateReservationConsistency(
      aggregate.itemId,
      aggregate.warehouseId,
      aggregate.onHandQty,
    );
    if (reservationIssue) issues.push(reservationIssue);
  }
  return issues;
}
