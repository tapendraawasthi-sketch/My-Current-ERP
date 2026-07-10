import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { recordDiagnostic } from "../eventDiagnostics";
import { logEvent } from "../eventLogger";

/** F6 projection subscriber stub — notification only, no state writes. */
export function createProjectionSubscriberStub(projectionId: string): IEventHandler {
  return {
    eventType: "*",
    async handle(event: IDomainEvent) {
      logEvent("debug", `projection-stub:${projectionId}`, event);
      recordDiagnostic({
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        causationId: event.causationId,
        stage: "handler_success",
        handlerType: `projection-stub:${projectionId}`,
        timestamp: new Date().toISOString(),
      });
    },
  };
}

export const TRIAL_BALANCE_PROJECTION_STUB = createProjectionSubscriberStub("trial-balance");
export const LEDGER_PROJECTION_STUB = createProjectionSubscriberStub("ledger-statement");
export const STOCK_PROJECTION_STUB = createProjectionSubscriberStub("stock-ledger");
