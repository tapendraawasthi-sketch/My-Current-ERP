import type { EntityId, JsonObject } from "@fios/kernel";

/** Canonical stored event schema — SYSTEM-08 §06 domainEvents table. */
export const EVENT_SCHEMA_VERSION = 1;

export const GLOBAL_CURSOR_ID = "global";

export function streamCursorId(aggregateType: string, aggregateId: string): string {
  return `stream:${aggregateType}:${aggregateId}`;
}

export function dedupKeyId(causationId: string, eventType: string): string {
  return `${causationId}:${eventType}`;
}

export interface DBDomainEvent {
  id: EntityId;
  tenantId: EntityId;
  companyId: EntityId | null;
  aggregateType: string;
  aggregateId: EntityId;
  sequence: number;
  globalSequence: number;
  eventType: string;
  eventVersion: number;
  payload: JsonObject;
  correlationId: EntityId;
  causationId?: EntityId;
  commandId?: EntityId;
  occurredAt: string;
  recordedAt: string;
  eventHash: string;
  metadata?: JsonObject;
  migrationTag?: string;
}

export interface DBEventSnapshot {
  aggregateKey: string;
  sequence: number;
  state: JsonObject;
  createdAt: string;
}

export interface DBEventStoreCursor {
  id: string;
  tenantId: EntityId;
  lastGlobalSequence: number;
  lastAggregateSequence?: number;
  aggregateType?: string;
  aggregateId?: EntityId;
  updatedAt: string;
}

export interface DBEventDedupKey {
  id: string;
  causationId: EntityId;
  eventType: string;
  eventId: EntityId;
  recordedAt: string;
}

export interface StoredEventEnvelope {
  record: DBDomainEvent;
  duplicate: boolean;
}
