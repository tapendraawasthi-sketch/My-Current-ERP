import type { IDomainEvent } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { EventTypes } from "@/platform/event-bus/eventTypes";
import type { EventMiddleware } from "@/platform/event-bus/middleware";
import { logEvent } from "@/platform/event-bus/eventLogger";
import { recordDiagnostic } from "@/platform/event-bus/eventDiagnostics";
import { getEventStore, isEventStoreEnabled } from "./eventStore";
import { getEventRepository } from "./eventRepository";

const PERSISTED_META_EVENTS = new Set<string>([
  EventTypes.COMMAND_ACCEPTED,
  EventTypes.HANDLER_FAILED,
]);

function shouldPersist(event: IDomainEvent): boolean {
  if (PERSISTED_META_EVENTS.has(event.eventType)) {
    return false;
  }
  return true;
}

export function createEventStoreMiddleware(): EventMiddleware {
  return async (event, next) => {
    if (!isEventStoreEnabled()) {
      await next();
      return;
    }

    if (shouldPersist(event)) {
      const store = getEventStore();
      const repository = getEventRepository();
      try {
        if (event.causationId) {
          const existing = await repository.findByDedup(event.causationId, event.eventType);
          if (existing) {
            recordDiagnostic({
              eventId: event.eventId,
              eventType: event.eventType,
              correlationId: event.correlationId,
              causationId: event.causationId,
              stage: "published",
              error: "duplicate-skipped",
              timestamp: new Date().toISOString(),
            });
          } else {
            await store.persistPublishedEvent(event);
            recordDiagnostic({
              eventId: event.eventId,
              eventType: event.eventType,
              correlationId: event.correlationId,
              causationId: event.causationId,
              stage: "dispatched",
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          await store.persistPublishedEvent(event);
          recordDiagnostic({
            eventId: event.eventId,
            eventType: event.eventType,
            correlationId: event.correlationId,
            causationId: event.causationId,
            stage: "dispatched",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logEvent("error", "event-store:persist-failed", event, { error: message });
        recordDiagnostic({
          eventId: event.eventId,
          eventType: event.eventType,
          correlationId: event.correlationId,
          causationId: event.causationId,
          stage: "handler_failure",
          error: message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    await next();
  };
}

export function bootstrapEventStore(): void {
  if (!isMigrationFlagEnabled("MIGRATION_EVENT_STORE")) {
    return;
  }
  getEventStore();
}
