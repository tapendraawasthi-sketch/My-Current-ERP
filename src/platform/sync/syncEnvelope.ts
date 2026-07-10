import type { DBDomainEvent } from "@/platform/event-store/eventSchemas";
import type { IPrincipal } from "@fios/kernel";
import type { SyncEventEnvelope } from "./syncServerContracts";

export function buildSyncEnvelope(
  record: DBDomainEvent,
  principal: IPrincipal | null,
): SyncEventEnvelope {
  return {
    eventId: record.id,
    globalSequence: record.globalSequence,
    aggregateId: record.aggregateId,
    aggregateType: record.aggregateType,
    aggregateVersion: record.sequence,
    tenantId: record.tenantId,
    principalId: principal?.userId ?? "system",
    timestamp: record.occurredAt,
    eventType: record.eventType,
    payload: record.payload,
    correlationId: record.correlationId,
    causationId: record.causationId,
    hash: record.eventHash,
    signature: "",
  };
}

export function validateSyncEnvelope(envelope: SyncEventEnvelope): boolean {
  return Boolean(
    envelope.eventId &&
      envelope.globalSequence > 0 &&
      envelope.aggregateId &&
      envelope.aggregateType &&
      envelope.tenantId &&
      envelope.eventType &&
      envelope.hash,
  );
}
