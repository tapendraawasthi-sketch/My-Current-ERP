import type { IDomainEvent } from "@fios/kernel";
import { getEventSchema } from "./eventRegistry";

export interface EventValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEvent(event: IDomainEvent): EventValidationResult {
  const errors: string[] = [];

  if (!event.eventId) errors.push("eventId is required");
  if (!event.eventType) errors.push("eventType is required");
  if (!event.aggregateType) errors.push("aggregateType is required");
  if (!event.aggregateId) errors.push("aggregateId is required");
  if (!event.correlationId) errors.push("correlationId is required");
  if (!event.occurredAt) errors.push("occurredAt is required");
  if (!event.payload || typeof event.payload !== "object") {
    errors.push("payload must be an object");
  }

  const schema = getEventSchema(event.eventType);
  if (!schema) {
    errors.push(`Unknown event type: ${event.eventType}`);
  } else {
    if (event.eventVersion !== schema.eventVersion) {
      errors.push(
        `eventVersion mismatch: expected ${schema.eventVersion}, got ${event.eventVersion}`,
      );
    }
    if (schema.aggregateType && event.aggregateType !== schema.aggregateType) {
      errors.push(
        `aggregateType mismatch: expected ${schema.aggregateType}, got ${event.aggregateType}`,
      );
    }
    for (const key of schema.requiredPayloadKeys) {
      if (event.payload[key] === undefined || event.payload[key] === null) {
        errors.push(`payload.${key} is required`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
