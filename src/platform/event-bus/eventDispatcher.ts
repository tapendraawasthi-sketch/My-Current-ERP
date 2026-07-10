import type { IDomainEvent, IEventHandler } from "@fios/kernel";
import { DEFAULT_RETRY_POLICY, withRetry } from "./retryPolicy";
import { enqueueDeadLetter } from "./deadLetterQueue";
import { eventMetrics } from "./eventMetrics";
import { recordDiagnostic } from "./eventDiagnostics";
import { logEvent } from "./eventLogger";

export async function dispatchToHandlers(
  event: IDomainEvent,
  handlers: IEventHandler[],
): Promise<void> {
  for (const handler of handlers) {
    const started = performance.now();
    try {
      await withRetry(
        () => handler.handle(event),
        DEFAULT_RETRY_POLICY,
        () => eventMetrics.incrementRetried(),
      );
      const durationMs = Math.round(performance.now() - started);
      eventMetrics.incrementHandlerSuccess();
      recordDiagnostic({
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        causationId: event.causationId,
        stage: "handler_success",
        handlerType: handler.eventType,
        durationMs,
        timestamp: new Date().toISOString(),
      });
      logEvent("debug", "handler:success", event, { handlerType: handler.eventType, durationMs });
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const message = error instanceof Error ? error.message : String(error);
      eventMetrics.incrementHandlerFailure();
      eventMetrics.incrementDlq();
      enqueueDeadLetter(event, handler.eventType, message, DEFAULT_RETRY_POLICY.maxAttempts);
      recordDiagnostic({
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        causationId: event.causationId,
        stage: "handler_failure",
        handlerType: handler.eventType,
        durationMs,
        error: message,
        timestamp: new Date().toISOString(),
      });
      logEvent("error", "handler:failure", event, { handlerType: handler.eventType, error: message });
    }
  }
}
