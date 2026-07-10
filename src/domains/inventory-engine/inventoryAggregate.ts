import type { EntityId } from "@fios/kernel";

export const InventoryEventTypes = {
  STOCK_RECEIVED: "StockReceived",
  STOCK_ISSUED: "StockIssued",
  STOCK_ADJUSTED: "StockAdjusted",
  STOCK_TRANSFERRED: "StockTransferred",
  STOCK_RESERVED: "StockReserved",
  STOCK_RELEASED: "StockReleased",
  INVENTORY_CLOSED: "InventoryClosed",
  INVENTORY_OPENED: "InventoryOpened",
} as const;

export type InventoryEventType = (typeof InventoryEventTypes)[keyof typeof InventoryEventTypes];

export const MovementKinds = {
  PURCHASE: "purchase",
  SALE: "sale",
  PURCHASE_RETURN: "purchase_return",
  SALES_RETURN: "sales_return",
  OPENING: "opening",
  ADJUSTMENT: "adjustment",
  TRANSFER: "transfer",
  PRODUCTION: "production",
  CONSUMPTION: "consumption",
} as const;

export type MovementKind = (typeof MovementKinds)[keyof typeof MovementKinds];

export interface WarehouseRef {
  warehouseId: EntityId;
  warehouseName?: string;
}

export interface LotRef {
  lotId?: EntityId;
  batchNo?: string;
  expiryDate?: string;
}

export interface SerialRef {
  serialNo?: string;
}

export interface InventoryAggregate {
  itemId: EntityId;
  itemName: string;
  warehouseId: EntityId;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  averageCost: number;
  totalValue: number;
  lastMovementSequence: number;
  version: number;
}

export interface StockMovementRecord {
  id: EntityId;
  sequence: number;
  itemId: EntityId;
  itemName: string;
  warehouseId: EntityId;
  kind: MovementKind;
  qty: number;
  rate: number;
  amount: number;
  date: string;
  referenceId?: EntityId;
  referenceType?: string;
  referenceNo?: string;
  lot?: LotRef;
  serial?: SerialRef;
  narration?: string;
  inventoryEventType: InventoryEventType;
  createdAt: string;
}

export interface InventoryTransaction {
  id: EntityId;
  movementIds: EntityId[];
  itemId: EntityId;
  warehouseId: EntityId;
  transactionType: MovementKind;
  totalQty: number;
  totalAmount: number;
  occurredAt: string;
}

export interface InventoryReservation {
  id: EntityId;
  itemId: EntityId;
  warehouseId: EntityId;
  qty: number;
  referenceId: EntityId;
  status: "active" | "released" | "consumed";
  createdAt: string;
}

export interface CostLayer {
  id: EntityId;
  itemId: EntityId;
  warehouseId: EntityId;
  qty: number;
  rate: number;
  remainingQty: number;
  createdAt: string;
}

export interface ShadowInventoryEvent {
  eventId: EntityId;
  eventType: InventoryEventType;
  aggregateId: EntityId;
  payload: Record<string, unknown>;
  occurredAt: string;
}
