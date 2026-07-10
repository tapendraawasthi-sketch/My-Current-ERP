import type { IDomainEvent } from "@fios/kernel";
import { logEvent } from "./eventLogger";
import { eventMetrics } from "./eventMetrics";
import { recordDiagnostic } from "./eventDiagnostics";
import { validateEvent } from "./eventValidator";

export type EventMiddleware = (
  event: IDomainEvent,
  next: () => Promise<void>,
) => Promise<void>;

export class EventMiddlewarePipeline {
  private readonly middlewares: EventMiddleware[] = [];

  use(middleware: EventMiddleware): () => void {
    this.middlewares.push(middleware);
    return () => {
      const index = this.middlewares.indexOf(middleware);
      if (index >= 0) this.middlewares.splice(index, 1);
    };
  }

  async run(event: IDomainEvent, terminal: () => Promise<void>): Promise<void> {
    const dispatch = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) {
        await terminal();
        return;
      }
      const middleware = this.middlewares[index];
      await middleware(event, () => dispatch(index + 1));
    };
    await dispatch(0);
  }
}

export function createValidationMiddleware(): EventMiddleware {
  return async (event, next) => {
    const result = validateEvent(event);
    if (!result.valid) {
      throw new Error(`Event validation failed: ${result.errors.join("; ")}`);
    }
    await next();
  };
}

export function createLoggingMiddleware(): EventMiddleware {
  return async (event, next) => {
    logEvent("debug", "middleware:before-dispatch", event);
    await next();
    logEvent("debug", "middleware:after-dispatch", event);
  };
}

export function createMetricsMiddleware(): EventMiddleware {
  return async (event, next) => {
    eventMetrics.incrementDispatched();
    recordDiagnostic({
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      causationId: event.causationId,
      stage: "dispatched",
      timestamp: new Date().toISOString(),
    });
    await next();
  };
}

export function createCorrelationMiddleware(): EventMiddleware {
  return async (event, next) => {
    if (!event.correlationId) {
      throw new Error("correlationId is required on domain events");
    }
    await next();
  };
}
