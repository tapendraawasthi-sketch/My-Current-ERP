import type { IDomainEvent, ICommandEnvelope, JsonObject } from "@fios/kernel";

export interface EventEnvelopeMetadata {
  commandType?: string;
  commandId?: string;
  source?: string;
  publishedAt?: string;
}

export interface EventEnvelope<TPayload extends JsonObject = JsonObject>
  extends IDomainEvent<TPayload> {
  metadata?: EventEnvelopeMetadata;
}

export function createEventEnvelope<TPayload extends JsonObject>(input: {
  eventType: string;
  eventVersion?: number;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  correlationId: string;
  causationId?: string;
  metadata?: EventEnvelopeMetadata;
}): EventEnvelope<TPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    eventVersion: input.eventVersion ?? 1,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    correlationId: input.correlationId,
    causationId: input.causationId,
    occurredAt: new Date().toISOString(),
    metadata: {
      ...input.metadata,
      publishedAt: new Date().toISOString(),
    },
  };
}

export function createEventFromCommand<TPayload extends JsonObject>(
  command: ICommandEnvelope,
  eventType: string,
  payload: TPayload,
  aggregateId: string,
): EventEnvelope<TPayload> {
  return createEventEnvelope({
    eventType,
    aggregateType: command.aggregateType,
    aggregateId,
    payload,
    correlationId: command.correlationId,
    causationId: command.commandId,
    metadata: {
      commandType: command.commandType,
      commandId: command.commandId,
      source: "command-bus",
    },
  });
}
