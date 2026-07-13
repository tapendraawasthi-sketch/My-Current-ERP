/**
 * Atomic durable outbox writer for sales_posted (Phase 6).
 * Must run inside the same Dexie transaction as accounting posting.
 */

import type { SutraERPDatabase } from "@/lib/db";
import { generateId } from "@/lib/db";
import Dexie from "dexie";
import {
  accountingEventToEnvelope,
  buildSalesPostedEvent,
  type SalesPostedPayload,
} from "./accountingSyncContract";
import { allocateLocalSequence, commitLocalSequenceHash } from "./localSequence";
import { getOrCreateDeviceId } from "./vectorClock";
import type { DBEventSyncQueueRow } from "./syncQueue";
import type { CompanySyncPolicy } from "./companySyncPolicy";
import { isLocalOnly, requiresOutboxEvent } from "./companySyncPolicy";

export interface EnqueueSalesSyncInput {
  tenantId: string;
  companyId: string;
  financialYearId: string | null;
  userId: string;
  source: string;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
  syncPolicy?: CompanySyncPolicy;
  payload: Omit<
    SalesPostedPayload,
    "device_id" | "company_id" | "user_id" | "aggregate_version"
  > & {
    aggregate_version?: number;
  };
}

export type EnqueueSalesSyncResult =
  | { syncStatus: "disabled"; eventId: null }
  | { syncStatus: "pending"; eventId: string; localSequence: number };

export async function enqueueSalesSyncInTransaction(
  db: SutraERPDatabase,
  input: EnqueueSalesSyncInput,
): Promise<EnqueueSalesSyncResult> {
  const policy = input.syncPolicy ?? "sync_enabled";
  if (isLocalOnly(policy)) {
    return { syncStatus: "disabled", eventId: null };
  }
  if (!requiresOutboxEvent(policy)) {
    return { syncStatus: "disabled", eventId: null };
  }

  if (!db.eventSyncQueue || !db.domainEvents) {
    throw new Error("Event sync schema not ready — cannot post without durable outbox.");
  }

  const deviceId = getOrCreateDeviceId();
  const eventId = generateId();
  const seqTable = (
    db as unknown as { syncLocalSequences: Parameters<typeof allocateLocalSequence>[0] }
  ).syncLocalSequences;

  let localSequence = 1;
  let previousEventHash: string | null = null;
  if (seqTable) {
    const allocated = await allocateLocalSequence(seqTable, input.tenantId, input.companyId);
    localSequence = allocated.localSequence;
    previousEventHash = allocated.previousEventHash;
  }

  const fullPayload: SalesPostedPayload = {
    ...input.payload,
    device_id: deviceId,
    company_id: input.companyId,
    user_id: input.userId,
    aggregate_version: input.payload.aggregate_version ?? 1,
  };

  const event = await Dexie.waitFor(
    buildSalesPostedEvent({
      eventId,
      tenantId: input.tenantId,
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      deviceId,
      userId: input.userId,
      source: input.source,
      localSequence,
      previousEventHash,
      correlationId: input.correlationId,
      causationId: input.causationId,
      idempotencyKey: input.idempotencyKey,
      payload: fullPayload,
    }),
    8000,
  );

  const envelope = accountingEventToEnvelope(event);

  await db.domainEvents.put({
    id: event.event_id,
    tenantId: event.tenant_id,
    companyId: event.company_id,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    sequence: event.aggregate_version,
    globalSequence: event.local_sequence,
    eventType: event.event_type,
    eventVersion: 1,
    payload: envelope.payload,
    correlationId: event.correlation_id,
    causationId: event.causation_id ?? undefined,
    commandId: input.idempotencyKey,
    occurredAt: event.occurred_at,
    recordedAt: event.recorded_at,
    eventHash: event.integrity.event_hash,
    metadata: {
      schema_version: event.schema_version,
      origin: event.origin,
      device_id: event.device_id,
      idempotency_key: event.idempotency_key,
    },
  });

  const queueRow: DBEventSyncQueueRow = {
    id: event.event_id,
    eventId: event.event_id,
    globalSequence: event.local_sequence,
    tenantId: event.tenant_id,
    companyId: event.company_id,
    status: "pending",
    syncAttempts: 0,
    createdAt: event.recorded_at,
    idempotencyKey: event.idempotency_key,
    payloadHash: event.integrity.payload_hash,
    previousEventHash: event.integrity.previous_event_hash,
    eventHash: event.integrity.event_hash,
    origin: "local_user",
    envelope,
    nextAttemptAt: null,
  };

  await db.eventSyncQueue.put(queueRow);

  if (seqTable) {
    await commitLocalSequenceHash(
      seqTable,
      input.tenantId,
      input.companyId,
      localSequence,
      event.integrity.event_hash,
    );
  }

  return { syncStatus: "pending", eventId: event.event_id, localSequence };
}
