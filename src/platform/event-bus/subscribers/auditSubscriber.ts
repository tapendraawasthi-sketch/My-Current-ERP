import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { EventTypes } from "../eventTypes";
import { logEvent } from "../eventLogger";
import { recordDiagnostic } from "../eventDiagnostics";

/** Notification-only audit observer — does not write audit logs or touch repositories. */
export const auditSubscriber: IEventHandler = {
  eventType: "*",
  async handle(event: IDomainEvent) {
    if (event.eventType === EventTypes.HANDLER_FAILED) return;
    logEvent("info", "audit-observer", event, {
      observedAction: event.eventType,
      aggregate: `${event.aggregateType}/${event.aggregateId}`,
    });
    recordDiagnostic({
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      causationId: event.causationId,
      stage: "handler_success",
      handlerType: "audit-subscriber",
      timestamp: new Date().toISOString(),
    });
  },
};
