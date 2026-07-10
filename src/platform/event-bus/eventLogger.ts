import type { IDomainEvent } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { serializeEvent } from "./eventSerializer";

export type EventLogLevel = "debug" | "info" | "warn" | "error";

export function logEvent(
  level: EventLogLevel,
  message: string,
  event: IDomainEvent,
  extra?: Record<string, unknown>,
): void {
  if (!isMigrationFlagEnabled("MIGRATION_EVENT_BUS")) return;

  const payload = {
    message,
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    ...extra,
  };

  const line = `[FIOS:EventBus] ${message}`;
  switch (level) {
    case "debug":
      console.debug(line, payload);
      break;
    case "info":
      console.info(line, payload);
      break;
    case "warn":
      console.warn(line, payload);
      break;
    case "error":
      console.error(line, payload, serializeEvent(event));
      break;
  }
}
