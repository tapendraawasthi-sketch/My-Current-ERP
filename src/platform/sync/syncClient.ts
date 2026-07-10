import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getEventRepository } from "@/platform/event-store/eventRepository";
import { getIdentityProvider } from "@/platform/identity/identityProvider";
import { buildSyncEnvelope, validateSyncEnvelope } from "./syncEnvelope";
import {
  getPendingSyncEvents,
  markEventSynced,
  markEventSyncFailed,
  markEventSyncing,
  scanUnqueuedEvents,
} from "./syncQueue";
import { advanceSyncCursor, getLastSyncedGlobalSequence } from "./syncCursor";
import { getOrCreateDeviceId, getOrCreateReplicaId, vectorClockFromString } from "./vectorClock";
import { transportPush, transportPull, SyncAuthError } from "./syncTransport";
import { detectConflict } from "./conflictDetector";
import { resolveConflict } from "./conflictResolver";
import { recordSyncDiagnostic } from "./syncDiagnostics";
import { syncMetrics } from "./syncMetrics";
import { withSyncRetry } from "./syncRetry";
import { writeDeadLetter } from "./syncDeadLetter";
import { verifySyncEnvelopeIntegrity } from "./syncIntegrity";
import { readSyncCursor } from "./syncCursor";

const BATCH_SIZE = 20;

export class EventSyncClient {
  async ingestFromEventStore(): Promise<number> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_SYNC")) return 0;
    const principal = getIdentityProvider().getPrincipal();
    const tenantId = principal?.tenantId ?? "local";
    const lastSeq = await getLastSyncedGlobalSequence();
    const repository = getEventRepository();
    return scanUnqueuedEvents(tenantId, lastSeq, async (tid, from) => {
      const events = await repository.readTenantStream(tid, from);
      const records = [];
      for (const event of events) {
        const record = await repository.readRecordById(event.eventId);
        if (record) records.push(record);
      }
      return records;
    });
  }

  async pushPending(): Promise<number> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_SYNC")) return 0;

    const pending = await getPendingSyncEvents(BATCH_SIZE);
    if (pending.length === 0) return 0;

    const principal = getIdentityProvider().getPrincipal();
    const repository = getEventRepository();
    const envelopes = [];

    for (const row of pending) {
      await markEventSyncing(row.id);
      const record = await repository.readRecordById(row.eventId);
      if (!record) {
        await markEventSyncFailed(row.id, "Event record not found", row.syncAttempts + 1);
        continue;
      }
      const envelope = buildSyncEnvelope(record, principal);
      if (!validateSyncEnvelope(envelope) || !verifySyncEnvelopeIntegrity(envelope)) {
        await markEventSyncFailed(row.id, "Invalid envelope", row.syncAttempts + 1);
        continue;
      }
      envelopes.push(envelope);
    }

    if (envelopes.length === 0) return 0;

    try {
      const deviceId = getOrCreateDeviceId();
      const cursor = await readSyncCursor(deviceId);
      const response = await withSyncRetry(() =>
        transportPush({
          deviceId,
          replicaId: getOrCreateReplicaId(),
          tenantId: principal?.tenantId ?? "local",
          vectorClock: vectorClockFromString(cursor?.vectorClock),
          envelopes,
        }),
      );

      syncMetrics.incrementPushBatches();
      syncMetrics.incrementEventsPushed(response.accepted);

      for (const row of pending.slice(0, response.accepted)) {
        await markEventSynced(row.id);
      }

      for (const conflict of response.conflicts ?? []) {
        const detected = detectConflict({
          eventId: conflict.eventId,
          aggregateId: conflict.aggregateId,
          aggregateType: conflict.aggregateType,
          localVersion: conflict.localVersion,
          remoteVersion: conflict.remoteVersion,
        });
        resolveConflict(detected);
        syncMetrics.incrementConflicts();
      }

      const maxSeq = Math.max(...envelopes.map((e) => e.globalSequence));
      await advanceSyncCursor(principal?.tenantId ?? "local", maxSeq);

      recordSyncDiagnostic({
        stage: "push-success",
        message: `accepted=${response.accepted}`,
        timestamp: new Date().toISOString(),
      });

      return response.accepted;
    } catch (error) {
      if (error instanceof SyncAuthError) {
        recordSyncDiagnostic({
          stage: "auth-rejected",
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return 0;
      }

      const message = error instanceof Error ? error.message : String(error);
      for (const row of pending) {
        const attempts = row.syncAttempts + 1;
        if (attempts >= 5) {
          await writeDeadLetter(row.eventId, message);
        } else {
          await markEventSyncFailed(row.id, message, attempts);
        }
      }
      syncMetrics.incrementPushFailures();
      throw error;
    }
  }

  async pullRemote(): Promise<number> {
    if (!isMigrationFlagEnabled("MIGRATION_EVENT_SYNC")) return 0;

    const deviceId = getOrCreateDeviceId();
    const cursor = await readSyncCursor(deviceId);
    const principal = getIdentityProvider().getPrincipal();

    try {
      const response = await transportPull({
        deviceId,
        tenantId: principal?.tenantId ?? "local",
        sinceGlobalSequence: cursor?.lastGlobalSequence ?? 0,
        vectorClock: vectorClockFromString(cursor?.vectorClock),
      });

      syncMetrics.incrementPullBatches();
      syncMetrics.incrementEventsPulled(response.envelopes.length);

      if (response.envelopes.length > 0) {
        await advanceSyncCursor(
          principal?.tenantId ?? "local",
          response.lastGlobalSequence,
          response.vectorClock,
        );
      }

      recordSyncDiagnostic({
        stage: "pull-success",
        message: `count=${response.envelopes.length}`,
        timestamp: new Date().toISOString(),
      });

      return response.envelopes.length;
    } catch (error) {
      if (error instanceof SyncAuthError) {
        recordSyncDiagnostic({
          stage: "auth-rejected",
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return 0;
      }
      syncMetrics.incrementPullFailures();
      throw error;
    }
  }
}

let clientInstance: EventSyncClient | null = null;

export function getEventSyncClient(): EventSyncClient {
  if (!clientInstance) {
    clientInstance = new EventSyncClient();
  }
  return clientInstance;
}
