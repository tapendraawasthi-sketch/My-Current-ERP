import type { IDomainEvent } from "@fios/kernel";
import { EventTypes } from "@/platform/event-bus/eventTypes";
import type { ShadowInventoryEvent, StockMovementRecord } from "./inventoryAggregate";
import { InventoryEventTypes } from "./inventoryAggregate";
import {
  mapInvoiceTypeToMovementKind,
  movementKindToEventType,
  signedQty,
} from "./inventoryMovements";
import { InventoryPolicies } from "./inventoryPolicies";
import {
  appendMovement,
  appendShadowEvent,
  getAggregate,
  nextMovementSequence,
} from "./inventoryRepository";
import { addCostLayer, consumeCostLayers } from "./inventoryCostLayers";
import { recordTransaction } from "./inventoryTransactions";
import { detectNegativeStock, runIntegrityChecks } from "./inventoryIntegrity";
import { inventoryMetrics } from "./inventoryMetrics";
import { inventoryLogger } from "./inventoryLogger";
import { recordInventoryDiagnostic } from "./inventoryDiagnostics";

function payloadAsObject(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object") return payload as Record<string, unknown>;
  return {};
}

function buildMovementFromInvoiceLine(input: {
  event: IDomainEvent;
  line: Record<string, unknown>;
  lineIndex: number;
  invoiceType: string;
  date: string;
  referenceId: string;
  referenceNo?: string;
  defaultWarehouseId: string;
}): StockMovementRecord | null {
  const itemId = String(input.line.itemId ?? "");
  if (!itemId) return null;

  const kind = mapInvoiceTypeToMovementKind(input.invoiceType);
  const rawQty = Number(input.line.qty ?? input.line.quantity ?? 0);
  const qty = signedQty(kind, rawQty);
  const rate = Number(input.line.rate ?? 0);
  const amount = Math.abs(rawQty) * rate;
  const lineKey = String(input.line.id ?? `${itemId}-${input.lineIndex}`);
  const movementId = `shadow-mov-${input.event.eventId}-${lineKey}`;

  return {
    id: movementId,
    sequence: nextMovementSequence(),
    itemId,
    itemName: String(input.line.itemName ?? ""),
    warehouseId: String(input.line.warehouseId ?? input.defaultWarehouseId),
    kind,
    qty,
    rate,
    amount,
    date: input.date,
    referenceId: input.referenceId,
    referenceNo: input.referenceNo,
    referenceType: input.invoiceType,
    narration: `Shadow stock for ${input.referenceNo ?? input.referenceId}`,
    inventoryEventType: movementKindToEventType(kind),
    createdAt: new Date().toISOString(),
  };
}

function emitShadowEvent(
  movement: StockMovementRecord,
  eventType: string,
): ShadowInventoryEvent {
  const shadowEvent: ShadowInventoryEvent = {
    eventId: crypto.randomUUID(),
    eventType: eventType as ShadowInventoryEvent["eventType"],
    aggregateId: movement.itemId,
    payload: { ...movement },
    occurredAt: new Date().toISOString(),
  };
  appendShadowEvent(shadowEvent);
  return shadowEvent;
}

function applyCostLayer(movement: StockMovementRecord): void {
  if (movement.qty > 0) {
    addCostLayer({
      itemId: movement.itemId,
      warehouseId: movement.warehouseId,
      qty: movement.qty,
      rate: movement.rate,
    });
    return;
  }
  if (movement.qty < 0) {
    consumeCostLayers(movement.itemId, movement.warehouseId, Math.abs(movement.qty));
  }
}

function recordMovementTransaction(movement: StockMovementRecord): void {
  recordTransaction({
    id: crypto.randomUUID(),
    movementIds: [movement.id],
    itemId: movement.itemId,
    warehouseId: movement.warehouseId,
    transactionType: movement.kind,
    totalQty: movement.qty,
    totalAmount: movement.amount,
    occurredAt: movement.createdAt,
  });
}

function applyMovement(movement: StockMovementRecord): void {
  appendMovement(movement);
  applyCostLayer(movement);
  recordMovementTransaction(movement);
  emitShadowEvent(movement, movement.inventoryEventType);

  const aggregate = getAggregate(movement.itemId, movement.warehouseId);
  if (aggregate) {
    const issue = detectNegativeStock(movement.itemId, movement.warehouseId, aggregate.onHandQty);
    if (issue) {
      recordInventoryDiagnostic({
        stage: "integrity-fail",
        message: issue.message,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

function processInvoiceEvent(event: IDomainEvent): void {
  const payload = payloadAsObject(event.payload);
  const invoiceType = String(payload.type ?? payload.invoiceType ?? "");
  const date = String(payload.date ?? event.occurredAt.slice(0, 10));
  const referenceId = String(payload.id ?? event.aggregateId);
  const referenceNo = payload.invoiceNo ? String(payload.invoiceNo) : undefined;
  const lines = (payload.lines as Array<Record<string, unknown>>) || [];
  const defaultWarehouseId = InventoryPolicies.defaultWarehouseId;

  for (let index = 0; index < lines.length; index++) {
    const movement = buildMovementFromInvoiceLine({
      event,
      line: lines[index],
      lineIndex: index,
      invoiceType,
      date,
      referenceId,
      referenceNo,
      defaultWarehouseId,
    });
    if (!movement) continue;
    applyMovement(movement);
    inventoryMetrics.incrementMovementsApplied();
  }
}

export function processInventoryDomainEvent(event: IDomainEvent): void {
  if (!InventoryPolicies.shadowModeOnly) return;

  inventoryMetrics.incrementEventsProcessed();
  inventoryLogger.debug("inventory-event-received", { eventType: event.eventType, eventId: event.eventId });
  recordInventoryDiagnostic({
    stage: "event-received",
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: new Date().toISOString(),
  });

  try {
    if (
      event.eventType === EventTypes.INVOICE_POSTED ||
      event.eventType === EventTypes.INVOICE_UPDATED
    ) {
      processInvoiceEvent(event);
    }

    const integrityIssues = runIntegrityChecks();
    if (integrityIssues.length > 0) {
      inventoryMetrics.incrementIntegrityFailures(integrityIssues.length);
    }

    recordInventoryDiagnostic({
      stage: "applied",
      eventId: event.eventId,
      eventType: event.eventType,
      message: `shadow movements applied`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    inventoryMetrics.incrementErrors();
    recordInventoryDiagnostic({
      stage: "error",
      eventId: event.eventId,
      eventType: event.eventType,
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    inventoryLogger.error("inventory-event-error", { eventId: event.eventId, error });
  }
}

export function isInventoryEventType(eventType: string): boolean {
  return Object.values(InventoryEventTypes).includes(eventType as never);
}
