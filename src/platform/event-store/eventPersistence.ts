import type { Table } from "dexie";
import { getDB } from "@/lib/db";
import type {
  DBDomainEvent,
  DBEventDedupKey,
  DBEventStoreCursor,
} from "./eventSchemas";
import {
  buildGlobalCursorUpdate,
  buildStreamCursorUpdate,
  readGlobalCursor,
  readStreamCursor,
} from "./eventCursor";

export interface EventStoreTables {
  domainEvents: Table<DBDomainEvent>;
  eventStoreCursors: Table<DBEventStoreCursor>;
  eventDedupKeys: Table<DBEventDedupKey>;
}

export function getEventStoreTables(): EventStoreTables {
  const db = getDB() as unknown as EventStoreTables;
  return {
    domainEvents: db.domainEvents,
    eventStoreCursors: db.eventStoreCursors,
    eventDedupKeys: db.eventDedupKeys,
  };
}

export function isEventStoreSchemaReady(): boolean {
  try {
    const db = getDB();
    return Boolean(db.domainEvents && db.eventStoreCursors && db.eventDedupKeys);
  } catch {
    return false;
  }
}

export async function findDedupedEvent(
  dedupTable: Table<DBEventDedupKey>,
  eventsTable: Table<DBDomainEvent>,
  dedupId: string,
): Promise<DBDomainEvent | null> {
  const key = await dedupTable.get(dedupId);
  if (!key) return null;
  return (await eventsTable.get(key.eventId)) ?? null;
}

export async function appendEventRecord(
  tables: EventStoreTables,
  record: DBDomainEvent,
  dedupKey: DBEventDedupKey | null,
): Promise<void> {
  const db = getDB();
  await db.transaction(
    "rw",
    [tables.domainEvents, tables.eventStoreCursors, tables.eventDedupKeys],
    async () => {
      const currentGlobal = await readGlobalCursor(tables.eventStoreCursors, record.tenantId);
      const currentStream = await readStreamCursor(
        tables.eventStoreCursors,
        record.aggregateType,
        record.aggregateId,
      );

      if (record.globalSequence !== currentGlobal + 1) {
        throw new Error(
          `Global sequence mismatch: expected ${currentGlobal + 1}, got ${record.globalSequence}`,
        );
      }
      if (record.sequence !== currentStream + 1) {
        throw new Error(
          `Aggregate sequence mismatch: expected ${currentStream + 1}, got ${record.sequence}`,
        );
      }

      await tables.domainEvents.add(record);
      await tables.eventStoreCursors.put(
        buildGlobalCursorUpdate(record.tenantId, record.globalSequence),
      );
      await tables.eventStoreCursors.put(
        buildStreamCursorUpdate(
          record.tenantId,
          record.aggregateType,
          record.aggregateId,
          record.sequence,
        ),
      );
      if (dedupKey) {
        await tables.eventDedupKeys.put(dedupKey);
      }
    },
  );
}

export async function readStreamRecords(
  eventsTable: Table<DBDomainEvent>,
  aggregateType: string,
  aggregateId: string,
  fromSequence = 1,
): Promise<DBDomainEvent[]> {
  return eventsTable
    .where("[aggregateType+aggregateId+sequence]")
    .between(
      [aggregateType, aggregateId, fromSequence],
      [aggregateType, aggregateId, Number.MAX_SAFE_INTEGER],
    )
    .toArray();
}

export async function readTenantRecords(
  eventsTable: Table<DBDomainEvent>,
  tenantId: string,
  fromGlobalSequence = 1,
): Promise<DBDomainEvent[]> {
  return eventsTable
    .where("[tenantId+globalSequence]")
    .between([tenantId, fromGlobalSequence], [tenantId, Number.MAX_SAFE_INTEGER])
    .toArray();
}
