import type { IDomainEvent } from "@fios/kernel";
import { serializeEvent } from "./eventSerializer";

const LEGACY_EVENT_NAME = "fios:domain-event";

export function publishLegacyBridge(event: IDomainEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LEGACY_EVENT_NAME, {
      detail: {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAt: event.occurredAt,
        payload: event.payload,
        serialized: serializeEvent(event),
      },
    }),
  );
}

export function onLegacyDomainEvent(
  listener: (event: IDomainEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (raw: Event) => {
    const custom = raw as CustomEvent;
    const detail = custom.detail as { serialized?: string } & IDomainEvent;
    if (!detail?.eventType) return;
    listener({
      eventId: detail.eventId,
      eventType: detail.eventType,
      eventVersion: detail.eventVersion ?? 1,
      aggregateType: detail.aggregateType,
      aggregateId: detail.aggregateId,
      sequence: detail.sequence,
      payload: detail.payload ?? {},
      correlationId: detail.correlationId,
      causationId: detail.causationId,
      occurredAt: detail.occurredAt,
    });
  };
  window.addEventListener(LEGACY_EVENT_NAME, handler);
  return () => window.removeEventListener(LEGACY_EVENT_NAME, handler);
}
