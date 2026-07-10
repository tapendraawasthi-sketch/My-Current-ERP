import type { IDomainEvent } from "@fios/kernel";
import type { IStreamId } from "@fios/kernel";
import {
  dedupKeyId,
  type DBDomainEvent,
  type DBEventDedupKey,
  type StoredEventEnvelope,
} from "./eventSchemas";
import { hashDomainEvent } from "./eventIntegrity";
import {
  appendEventRecord,
  findDedupedEvent,
  getEventStoreTables,
  isEventStoreSchemaReady,
  readStreamRecords,
  readTenantRecords,
} from "./eventPersistence";
import {
  readGlobalCursor,
  readStreamCursor,
  resolveStreamVersion,
} from "./eventCursor";

export const EventStoreConcurrencyErrorCode = "EVENT_STORE_CONCURRENCY" as const;

export class EventStoreConcurrencyError extends Error {
  readonly code = EventStoreConcurrencyErrorCode;
  readonly stream: IStreamId;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(stream: IStreamId, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrency conflict on ${stream.aggregateType}/${stream.aggregateId}: expected ${expectedVersion}, actual ${actualVersion}`,
    );
    this.name = "EventStoreConcurrencyError";
    this.stream = stream;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export interface PersistContext {
  tenantId: string;
  companyId: string | null;
}

function extractCommandId(event: IDomainEvent): string | undefined {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.commandId === "string" && payload.commandId) {
    return payload.commandId;
  }
  return event.causationId;
}

function toDomainEvent(record: DBDomainEvent): IDomainEvent {
  return {
    eventId: record.id,
    eventType: record.eventType,
    eventVersion: record.eventVersion,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    sequence: record.sequence,
    payload: record.payload,
    correlationId: record.correlationId,
    causationId: record.causationId,
    occurredAt: record.occurredAt,
  };
}

export class EventRepository {
  async getStreamVersion(stream: IStreamId): Promise<number> {
    if (!isEventStoreSchemaReady()) return 0;
    const tables = getEventStoreTables();
    return resolveStreamVersion(
      tables.domainEvents,
      tables.eventStoreCursors,
      stream.aggregateType,
      stream.aggregateId,
    );
  }

  async findByDedup(causationId: string, eventType: string): Promise<DBDomainEvent | null> {
    if (!isEventStoreSchemaReady()) return null;
    const tables = getEventStoreTables();
    return findDedupedEvent(tables.eventDedupKeys, tables.domainEvents, dedupKeyId(causationId, eventType));
  }

  async persistEvent(event: IDomainEvent, context: PersistContext): Promise<StoredEventEnvelope> {
    if (!isEventStoreSchemaReady()) {
      throw new Error("Event store schema is not ready");
    }

    const tables = getEventStoreTables();
    const commandId = extractCommandId(event);

    if (event.causationId) {
      const existing = await this.findByDedup(event.causationId, event.eventType);
      if (existing) {
        return { record: existing, duplicate: true };
      }
    }

    const currentGlobal = await readGlobalCursor(tables.eventStoreCursors, context.tenantId);
    const currentStream = await readStreamCursor(
      tables.eventStoreCursors,
      event.aggregateType,
      event.aggregateId,
    );

    const globalSequence = currentGlobal + 1;
    const sequence = currentStream + 1;

    const eventHash = await hashDomainEvent(event, {
      tenantId: context.tenantId,
      companyId: context.companyId,
      sequence,
      globalSequence,
    });

    const recordedAt = new Date().toISOString();
    const record: DBDomainEvent = {
      id: event.eventId,
      tenantId: context.tenantId,
      companyId: context.companyId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      sequence,
      globalSequence,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      payload: event.payload,
      correlationId: event.correlationId,
      causationId: event.causationId,
      commandId,
      occurredAt: event.occurredAt,
      recordedAt,
      eventHash,
      metadata: {
        source: "event-bus",
      },
    };

    let dedupKey: DBEventDedupKey | null = null;
    if (event.causationId) {
      dedupKey = {
        id: dedupKeyId(event.causationId, event.eventType),
        causationId: event.causationId,
        eventType: event.eventType,
        eventId: event.eventId,
        recordedAt,
      };
    }

    await appendEventRecord(tables, record, dedupKey);
    return { record, duplicate: false };
  }

  async appendToStream(
    stream: IStreamId,
    events: IDomainEvent[],
    expectedVersion: number,
    context: PersistContext,
  ): Promise<{ eventIds: string[]; newVersion: number }> {
    if (events.length === 0) {
      const version = await this.getStreamVersion(stream);
      return { eventIds: [], newVersion: version };
    }

    const actualVersion = await this.getStreamVersion(stream);
    if (expectedVersion !== actualVersion) {
      throw new EventStoreConcurrencyError(stream, expectedVersion, actualVersion);
    }

    const eventIds: string[] = [];
    let version = actualVersion;

    for (const event of events) {
      const normalized: IDomainEvent = {
        ...event,
        aggregateType: stream.aggregateType,
        aggregateId: stream.aggregateId,
      };
      const result = await this.persistEvent(normalized, context);
      eventIds.push(result.record.id);
      version = result.record.sequence;
    }

    return { eventIds, newVersion: version };
  }

  async readStream(
    stream: IStreamId,
    fromSequence = 1,
  ): Promise<IDomainEvent[]> {
    if (!isEventStoreSchemaReady()) return [];
    const tables = getEventStoreTables();
    const records = await readStreamRecords(
      tables.domainEvents,
      stream.aggregateType,
      stream.aggregateId,
      fromSequence,
    );
    return records.map(toDomainEvent);
  }

  async readTenantStream(tenantId: string, fromGlobalSequence = 1): Promise<IDomainEvent[]> {
    if (!isEventStoreSchemaReady()) return [];
    const tables = getEventStoreTables();
    const records = await readTenantRecords(tables.domainEvents, tenantId, fromGlobalSequence);
    return records.map(toDomainEvent);
  }

  async readRecordById(eventId: string): Promise<DBDomainEvent | null> {
    if (!isEventStoreSchemaReady()) return null;
    const tables = getEventStoreTables();
    return (await tables.domainEvents.get(eventId)) ?? null;
  }
}

let repositoryInstance: EventRepository | null = null;

export function getEventRepository(): EventRepository {
  if (!repositoryInstance) {
    repositoryInstance = new EventRepository();
  }
  return repositoryInstance;
}

export function resetEventRepository(): void {
  repositoryInstance = null;
}
