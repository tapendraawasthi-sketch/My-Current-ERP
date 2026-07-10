import type { EntityId, JsonObject } from "./types";

/**
 * Event bus contracts — interfaces only (F3 implements runtime).
 * @see SYSTEM-06 §06.14
 */

export interface IDomainEvent<TPayload extends JsonObject = JsonObject> {
  eventId: EntityId;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: EntityId;
  sequence?: number;
  payload: TPayload;
  correlationId: EntityId;
  causationId?: EntityId;
  occurredAt: string;
}

export interface IEventHandler<TPayload extends JsonObject = JsonObject> {
  eventType: string;
  handle(event: IDomainEvent<TPayload>): Promise<void>;
}

export interface IEventSubscription {
  id: string;
  eventType: string;
  unsubscribe(): void;
}

export interface IEventBus {
  publish<TPayload extends JsonObject>(event: IDomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload extends JsonObject>(handler: IEventHandler<TPayload>): () => void;
  unsubscribe(subscriptionId: string): void;
}
