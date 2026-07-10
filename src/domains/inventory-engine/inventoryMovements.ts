export {
  MovementKinds,
  InventoryEventTypes,
  type MovementKind,
  type InventoryEventType,
  type InventoryAggregate,
  type StockMovementRecord,
  type InventoryTransaction,
  type InventoryReservation,
  type CostLayer,
  type ShadowInventoryEvent,
  type WarehouseRef,
  type LotRef,
  type SerialRef,
} from "./inventoryAggregate";

import type { MovementKind, InventoryEventType } from "./inventoryAggregate";
import { MovementKinds, InventoryEventTypes } from "./inventoryAggregate";

export function movementKindToEventType(kind: MovementKind): InventoryEventType {
  switch (kind) {
    case MovementKinds.PURCHASE:
    case MovementKinds.OPENING:
    case MovementKinds.PURCHASE_RETURN:
      return InventoryEventTypes.STOCK_RECEIVED;
    case MovementKinds.SALE:
    case MovementKinds.SALES_RETURN:
    case MovementKinds.CONSUMPTION:
      return InventoryEventTypes.STOCK_ISSUED;
    case MovementKinds.ADJUSTMENT:
      return InventoryEventTypes.STOCK_ADJUSTED;
    case MovementKinds.TRANSFER:
      return InventoryEventTypes.STOCK_TRANSFERRED;
    case MovementKinds.PRODUCTION:
      return InventoryEventTypes.STOCK_RECEIVED;
    default:
      return InventoryEventTypes.STOCK_ADJUSTED;
  }
}

export function mapInvoiceTypeToMovementKind(invoiceType: string): MovementKind {
  const t = (invoiceType || "").toLowerCase();
  if (t.includes("purchase") && t.includes("return")) return MovementKinds.PURCHASE_RETURN;
  if (t.includes("sales") && t.includes("return")) return MovementKinds.SALES_RETURN;
  if (t.includes("purchase")) return MovementKinds.PURCHASE;
  if (t.includes("sales")) return MovementKinds.SALE;
  return MovementKinds.ADJUSTMENT;
}

export function isInwardMovement(kind: MovementKind): boolean {
  return (
    kind === MovementKinds.PURCHASE ||
    kind === MovementKinds.OPENING ||
    kind === MovementKinds.PURCHASE_RETURN ||
    kind === MovementKinds.PRODUCTION
  );
}

export function signedQty(kind: MovementKind, qty: number): number {
  const abs = Math.abs(qty);
  if (kind === MovementKinds.SALE || kind === MovementKinds.CONSUMPTION) return -abs;
  if (kind === MovementKinds.SALES_RETURN) return abs;
  if (kind === MovementKinds.PURCHASE_RETURN) return -abs;
  return isInwardMovement(kind) ? abs : -abs;
}
