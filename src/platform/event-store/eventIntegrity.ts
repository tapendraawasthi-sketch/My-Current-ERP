import type { IDomainEvent } from "@fios/kernel";
import type { DBDomainEvent } from "./eventSchemas";

export const EventStoreErrorCode = {
  HASH_MISMATCH: "HASH_MISMATCH",
  SEQUENCE_GAP: "SEQUENCE_GAP",
  SEQUENCE_DUPLICATE: "SEQUENCE_DUPLICATE",
  INVALID_RECORD: "INVALID_RECORD",
} as const;

export type EventStoreErrorCode =
  (typeof EventStoreErrorCode)[keyof typeof EventStoreErrorCode];

export class EventIntegrityError extends Error {
  readonly code: EventStoreErrorCode;

  constructor(code: EventStoreErrorCode, message: string) {
    super(message);
    this.name = "EventIntegrityError";
    this.code = code;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export interface HashInput {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  sequence: number;
  globalSequence: number;
  tenantId: string;
  companyId: string | null;
  payload: unknown;
  correlationId: string;
  causationId?: string;
  occurredAt: string;
}

export async function computeEventHash(input: HashInput): Promise<string> {
  const canonical = stableStringify({
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: input.eventVersion,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    sequence: input.sequence,
    globalSequence: input.globalSequence,
    tenantId: input.tenantId,
    companyId: input.companyId,
    payload: input.payload,
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    occurredAt: input.occurredAt,
  });
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashDomainEvent(
  event: IDomainEvent,
  context: {
    tenantId: string;
    companyId: string | null;
    sequence: number;
    globalSequence: number;
  },
): Promise<string> {
  return computeEventHash({
    eventId: event.eventId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    sequence: context.sequence,
    globalSequence: context.globalSequence,
    tenantId: context.tenantId,
    companyId: context.companyId,
    payload: event.payload,
    correlationId: event.correlationId,
    causationId: event.causationId,
    occurredAt: event.occurredAt,
  });
}

export async function verifyStoredEvent(record: DBDomainEvent): Promise<void> {
  const expected = await computeEventHash({
    eventId: record.id,
    eventType: record.eventType,
    eventVersion: record.eventVersion,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    sequence: record.sequence,
    globalSequence: record.globalSequence,
    tenantId: record.tenantId,
    companyId: record.companyId,
    payload: record.payload,
    correlationId: record.correlationId,
    causationId: record.causationId,
    occurredAt: record.occurredAt,
  });
  if (expected !== record.eventHash) {
    throw new EventIntegrityError(
      EventStoreErrorCode.HASH_MISMATCH,
      `Event hash mismatch for ${record.id}`,
    );
  }
}

export function validateSequenceChain(records: DBDomainEvent[]): void {
  if (records.length === 0) return;
  const sorted = [...records].sort((a, b) => a.sequence - b.sequence);
  for (let index = 0; index < sorted.length; index++) {
    const expected = index === 0 ? 1 : sorted[index - 1].sequence + 1;
    if (sorted[index].sequence !== expected) {
      throw new EventIntegrityError(
        EventStoreErrorCode.SEQUENCE_GAP,
        `Sequence gap in stream ${sorted[0].aggregateType}/${sorted[0].aggregateId}: expected ${expected}, got ${sorted[index].sequence}`,
      );
    }
  }
}
