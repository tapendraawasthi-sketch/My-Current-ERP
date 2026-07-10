import type { IDomainEvent } from "@fios/kernel";
import type { EventEnvelope } from "./eventEnvelope";

export interface SerializedEvent {
  v: 1;
  event: IDomainEvent;
  serializedAt: string;
}

export function serializeEvent(event: IDomainEvent | EventEnvelope): string {
  const payload: SerializedEvent = {
    v: 1,
    event: {
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      sequence: event.sequence,
      payload: event.payload,
      correlationId: event.correlationId,
      causationId: event.causationId,
      occurredAt: event.occurredAt,
    },
    serializedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export function deserializeEvent(raw: string): IDomainEvent | null {
  try {
    const parsed = JSON.parse(raw) as SerializedEvent;
    if (!parsed || parsed.v !== 1 || !parsed.event?.eventType) {
      return null;
    }
    return parsed.event;
  } catch {
    return null;
  }
}

export function cloneEvent<T extends IDomainEvent>(event: T): T {
  return JSON.parse(serializeEvent(event)) as T;
}
