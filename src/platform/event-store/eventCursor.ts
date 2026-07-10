import type { Table } from "dexie";
import type { DBEventStoreCursor, DBDomainEvent } from "./eventSchemas";
import { GLOBAL_CURSOR_ID, streamCursorId } from "./eventSchemas";

export interface CursorState {
  lastGlobalSequence: number;
  lastStreamSequence: number;
}

export async function readGlobalCursor(
  cursorTable: Table<DBEventStoreCursor>,
  tenantId: string,
): Promise<number> {
  const row = await cursorTable.get(GLOBAL_CURSOR_ID);
  if (!row || row.tenantId !== tenantId) return 0;
  return row.lastGlobalSequence;
}

export async function readStreamCursor(
  cursorTable: Table<DBEventStoreCursor>,
  aggregateType: string,
  aggregateId: string,
): Promise<number> {
  const row = await cursorTable.get(streamCursorId(aggregateType, aggregateId));
  return row?.lastAggregateSequence ?? 0;
}

export async function resolveStreamVersion(
  eventsTable: Table<DBDomainEvent>,
  cursorTable: Table<DBEventStoreCursor>,
  aggregateType: string,
  aggregateId: string,
): Promise<number> {
  const fromCursor = await readStreamCursor(cursorTable, aggregateType, aggregateId);
  if (fromCursor > 0) return fromCursor;
  const last = await eventsTable
    .where("[aggregateType+aggregateId+sequence]")
    .between([aggregateType, aggregateId, 0], [aggregateType, aggregateId, Number.MAX_SAFE_INTEGER])
    .last();
  return last?.sequence ?? 0;
}

export function buildGlobalCursorUpdate(
  tenantId: string,
  globalSequence: number,
): DBEventStoreCursor {
  return {
    id: GLOBAL_CURSOR_ID,
    tenantId,
    lastGlobalSequence: globalSequence,
    updatedAt: new Date().toISOString(),
  };
}

export function buildStreamCursorUpdate(
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  sequence: number,
): DBEventStoreCursor {
  return {
    id: streamCursorId(aggregateType, aggregateId),
    tenantId,
    lastAggregateSequence: sequence,
    aggregateType,
    aggregateId,
    updatedAt: new Date().toISOString(),
  };
}
