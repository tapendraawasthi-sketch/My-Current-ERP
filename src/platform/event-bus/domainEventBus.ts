import type { IDomainEvent, IEventHandler, IEventBus, IEventSubscription, JsonObject } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { EventMiddlewarePipeline } from "./middleware";
import { dispatchToHandlers } from "./eventDispatcher";
import { eventMetrics } from "./eventMetrics";
import { recordDiagnostic } from "./eventDiagnostics";
import { logEvent } from "./eventLogger";
import { publishLegacyBridge } from "./legacyBridge";
import { validateEvent } from "./eventValidator";

interface SubscriptionRecord {
  id: string;
  eventType: string;
  handler: IEventHandler;
}

export class DomainEventBus implements IEventBus {
  private readonly wildcardHandlers: SubscriptionRecord[] = [];
  private readonly handlersByType = new Map<string, SubscriptionRecord[]>();
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  readonly middleware: EventMiddlewarePipeline;

  constructor(middleware?: EventMiddlewarePipeline) {
    this.middleware = middleware ?? new EventMiddlewarePipeline();
  }

  async publish<TPayload extends JsonObject>(event: IDomainEvent<TPayload>): Promise<void> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_BUS")) return;

    const validation = validateEvent(event);
    if (!validation.valid) {
      throw new Error(`Cannot publish invalid event: ${validation.errors.join("; ")}`);
    }

    eventMetrics.incrementPublished(event.eventType);
    recordDiagnostic({
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      causationId: event.causationId,
      stage: "published",
      timestamp: new Date().toISOString(),
    });
    logEvent("info", "publish", event);

    await this.middleware.run(event, async () => {
      const handlers = this.resolveHandlers(event.eventType);
      await dispatchToHandlers(event, handlers);
      publishLegacyBridge(event);
    });
  }

  subscribe<TPayload extends JsonObject>(handler: IEventHandler<TPayload>): () => void {
    const record: SubscriptionRecord = {
      id: crypto.randomUUID(),
      eventType: handler.eventType,
      handler: handler as IEventHandler,
    };
    this.subscriptions.set(record.id, record);
    if (handler.eventType === "*") {
      this.wildcardHandlers.push(record);
    } else {
      const list = this.handlersByType.get(handler.eventType) ?? [];
      list.push(record);
      this.handlersByType.set(handler.eventType, list);
    }
    return () => this.unsubscribe(record.id);
  }

  unsubscribe(subscriptionId: string): void {
    const record = this.subscriptions.get(subscriptionId);
    if (!record) return;
    this.subscriptions.delete(subscriptionId);
    if (record.eventType === "*") {
      const index = this.wildcardHandlers.findIndex((item) => item.id === subscriptionId);
      if (index >= 0) this.wildcardHandlers.splice(index, 1);
      return;
    }
    const list = this.handlersByType.get(record.eventType) ?? [];
    const index = list.findIndex((item) => item.id === subscriptionId);
    if (index >= 0) list.splice(index, 1);
    if (list.length === 0) {
      this.handlersByType.delete(record.eventType);
    } else {
      this.handlersByType.set(record.eventType, list);
    }
  }

  listSubscriptions(): IEventSubscription[] {
    return Array.from(this.subscriptions.values()).map((record) => ({
      id: record.id,
      eventType: record.eventType,
      unsubscribe: () => this.unsubscribe(record.id),
    }));
  }

  private resolveHandlers(eventType: string): IEventHandler[] {
    const typed = this.handlersByType.get(eventType) ?? [];
    const wildcards = this.wildcardHandlers.map((record) => record.handler);
    return [...typed.map((record) => record.handler), ...wildcards];
  }
}
