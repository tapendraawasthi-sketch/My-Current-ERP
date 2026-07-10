import type { IDomainEvent, IEventHandler, IStreamId } from "@fios/kernel";
import { verifyStoredEvent, validateSequenceChain } from "./eventIntegrity";
import { getEventRepository } from "./eventRepository";
import { isEventStoreEnabled } from "./eventStore";

export interface ReplayOptions {
  verifyHashes?: boolean;
  validateSequences?: boolean;
}

export interface ReplayResult<T = IDomainEvent> {
  events: T[];
  fromSequence: number;
  toSequence: number;
  eventCount: number;
}

export async function replayStream(
  stream: IStreamId,
  handler: IEventHandler,
  fromSequence = 1,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  if (!isEventStoreEnabled()) {
    return { events: [], fromSequence, toSequence: fromSequence - 1, eventCount: 0 };
  }

  const repository = getEventRepository();
  const records = await repository.readStream(stream, fromSequence);

  if (options.verifyHashes !== false) {
    for (const record of await loadRawStream(stream, fromSequence)) {
      await verifyStoredEvent(record);
    }
  }

  if (options.validateSequences !== false && records.length > 0) {
    const raw = await loadRawStream(stream, fromSequence);
    validateSequenceChain(raw);
  }

  for (const event of records) {
    await handler.handle(event);
  }

  const toSequence =
    records.length > 0 ? (records[records.length - 1].sequence ?? fromSequence) : fromSequence - 1;

  return {
    events: records,
    fromSequence,
    toSequence,
    eventCount: records.length,
  };
}

export async function replayTenant(
  tenantId: string,
  handler: IEventHandler,
  fromGlobalSequence = 1,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  if (!isEventStoreEnabled()) {
    return {
      events: [],
      fromSequence: fromGlobalSequence,
      toSequence: fromGlobalSequence - 1,
      eventCount: 0,
    };
  }

  const repository = getEventRepository();
  const events = await repository.readTenantStream(tenantId, fromGlobalSequence);

  if (options.verifyHashes !== false) {
    for (const event of events) {
      const record = await repository.readRecordById(event.eventId);
      if (record) await verifyStoredEvent(record);
    }
  }

  for (const event of events) {
    await handler.handle(event);
  }

  const toSequence =
    events.length > 0
      ? (await repository.readRecordById(events[events.length - 1].eventId))?.globalSequence ??
        fromGlobalSequence
      : fromGlobalSequence - 1;

  return {
    events,
    fromSequence: fromGlobalSequence,
    toSequence,
    eventCount: events.length,
  };
}

async function loadRawStream(stream: IStreamId, fromSequence: number) {
  const repository = getEventRepository();
  const events = await repository.readStream(stream, fromSequence);
  const records = [];
  for (const event of events) {
    const record = await repository.readRecordById(event.eventId);
    if (record) records.push(record);
  }
  return records;
}
