import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getEventRepository } from "@/platform/event-store/eventRepository";
import { getIdentityProvider } from "@/platform/identity/identityProvider";
import { buildSyncEnvelope, validateSyncEnvelope } from "./syncEnvelope";
import {
  claimSyncEvents,
  getPendingSyncEvents,
  markEventConflict,
  markEventSynced,
  markEventSyncFailed,
  releaseSyncClaim,
  scanUnqueuedEvents,
  type DBEventSyncQueueRow,
} from "./syncQueue";
import { advanceSyncCursor, getLastSyncedGlobalSequence, readSyncCursor } from "./syncCursor";
import { getOrCreateDeviceId, getOrCreateReplicaId, vectorClockFromString } from "./vectorClock";
import { transportPush, transportPull, SyncAuthError } from "./syncTransport";
import { detectConflict } from "./conflictDetector";
import { resolveConflict } from "./conflictResolver";
import { recordSyncDiagnostic } from "./syncDiagnostics";
import { syncMetrics } from "./syncMetrics";
import { classifySyncFailure, computeNextAttemptAt, withSyncRetry } from "./syncRetry";
import { writeDeadLetter } from "./syncDeadLetter";
import { verifySyncEnvelopeIntegrity } from "./syncIntegrity";
import { verifyAccountingEnvelopeIntegrity } from "./accountingSyncContract";
import { applyRemoteSyncEnvelope } from "./applyRemoteEvent";
import { getSyncWorkerId, withSyncWorkerLock } from "./syncWorkerLock";
import type { SyncEventEnvelope } from "./syncServerContracts";

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

    const locked = await withSyncWorkerLock(async () => {
      const pending = await getPendingSyncEvents(BATCH_SIZE);
      if (pending.length === 0) return 0;

      const workerId = getSyncWorkerId();
      const claimed = await claimSyncEvents(pending, workerId);
      if (claimed.length === 0) return 0;

      const principal = getIdentityProvider().getPrincipal();
      const repository = getEventRepository();
      const envelopes: SyncEventEnvelope[] = [];
      const envelopeByEventId = new Map<string, DBEventSyncQueueRow>();

      for (const row of claimed) {
        let envelope = row.envelope;
        if (!envelope) {
          const record = await repository.readRecordById(row.eventId);
          if (!record) {
            await markEventSyncFailed(row.id, "Event record not found", row.syncAttempts + 1, {
              errorCode: "invalid_schema",
              retryable: false,
            });
            continue;
          }
          envelope = buildSyncEnvelope(record, principal);
        }

        const accountingCheck = await verifyAccountingEnvelopeIntegrity(envelope);
        if (accountingCheck.ok === false) {
          // Material integrity failures must not ship (purchase or sales).
          await markEventConflict(row.id, accountingCheck.code, accountingCheck.code);
          continue;
        }

        if (!validateSyncEnvelope(envelope) || !verifySyncEnvelopeIntegrity(envelope)) {
          await markEventSyncFailed(row.id, "Invalid envelope", row.syncAttempts + 1, {
            errorCode: "invalid_schema",
            retryable: false,
          });
          continue;
        }
        envelopes.push(envelope);
        envelopeByEventId.set(String(envelope.eventId), row);
      }

      if (envelopes.length === 0) {
        for (const row of claimed) {
          await releaseSyncClaim(row.id, {
            error: "No valid envelopes in claimed batch",
            errorCode: "empty_envelope_batch",
          });
        }
        return 0;
      }

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
        let acceptedCount = 0;

        const results = response.results;
        if (results?.length) {
          for (const result of results) {
            const row = envelopeByEventId.get(String(result.eventId));
            if (!row) continue;
            if (result.status === "accepted" || result.status === "duplicate") {
              await markEventSynced(row.id, {
                remoteEventId: result.remoteEventId ?? undefined,
                remoteSequence: result.remoteSequence ?? undefined,
                acknowledgedAt: result.acknowledgedAt ?? undefined,
              });
              acceptedCount += 1;
            } else if (result.status === "conflict") {
              await markEventConflict(
                row.id,
                result.errorCode ?? "conflict",
                result.errorCode ?? "conflict",
              );
              syncMetrics.incrementConflicts();
              if (result.conflict) {
                resolveConflict(
                  detectConflict({
                    eventId: String(result.eventId),
                    aggregateId: result.conflict.aggregateId,
                    aggregateType: result.conflict.aggregateType,
                    localVersion: result.conflict.localVersion,
                    remoteVersion: result.conflict.remoteVersion,
                  }),
                );
              }
            } else {
              const attempts = row.syncAttempts + 1;
              const code = result.errorCode ?? "rejected";
              const klass = classifySyncFailure(code);
              if (klass === "permanent" || attempts >= 8) {
                await writeDeadLetter(row.eventId, code);
                await markEventSyncFailed(row.id, code, attempts, {
                  errorCode: code,
                  retryable: false,
                });
              } else {
                await markEventSyncFailed(row.id, code, attempts, {
                  errorCode: code,
                  retryable: true,
                  nextAttemptAt: computeNextAttemptAt(attempts),
                });
              }
            }
          }
        } else {
          // Legacy aggregate response
          for (const row of claimed.slice(0, response.accepted)) {
            await markEventSynced(row.id);
            acceptedCount += 1;
          }
          for (const conflict of response.conflicts ?? []) {
            const row = envelopeByEventId.get(String(conflict.eventId));
            if (row) {
              await markEventConflict(row.id, conflict.classification, conflict.classification);
            }
            resolveConflict(
              detectConflict({
                eventId: conflict.eventId,
                aggregateId: conflict.aggregateId,
                aggregateType: conflict.aggregateType,
                localVersion: conflict.localVersion,
                remoteVersion: conflict.remoteVersion,
              }),
            );
            syncMetrics.incrementConflicts();
          }
        }

        syncMetrics.incrementEventsPushed(acceptedCount);

        recordSyncDiagnostic({
          stage: "push-success",
          message: `accepted=${acceptedCount}`,
          timestamp: new Date().toISOString(),
        });

        return acceptedCount;
      } catch (error) {
        if (error instanceof SyncAuthError) {
          recordSyncDiagnostic({
            stage: "auth-rejected",
            message: error.message,
            timestamp: new Date().toISOString(),
          });
          for (const row of claimed) {
            await releaseSyncClaim(row.id, {
              error: error.message,
              errorCode: "auth_rejected",
            });
          }
          return 0;
        }

        const message = error instanceof Error ? error.message : String(error);
        const klass = classifySyncFailure(message);
        for (const row of claimed) {
          const attempts = row.syncAttempts + 1;
          if (klass === "permanent" || attempts >= 8) {
            await writeDeadLetter(row.eventId, message);
            await markEventSyncFailed(row.id, message, attempts, {
              errorCode: message,
              retryable: false,
            });
          } else {
            await markEventSyncFailed(row.id, message, attempts, {
              errorCode: message,
              retryable: true,
              nextAttemptAt: computeNextAttemptAt(attempts),
            });
          }
        }
        syncMetrics.incrementPushFailures();
        throw error;
      }
    });

    return locked ?? 0;
  }

  async pullRemote(companyId?: string): Promise<number> {
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
        companyId,
      });

      syncMetrics.incrementPullBatches();

      let applied = 0;
      let lastAppliedSeq = cursor?.lastGlobalSequence ?? 0;

      for (const envelope of response.envelopes) {
        const result = await applyRemoteSyncEnvelope(envelope as SyncEventEnvelope);
        if (result.status === "applied" || result.status === "duplicate" || result.status === "same_origin_ack") {
          applied += 1;
          lastAppliedSeq = Math.max(
            lastAppliedSeq,
            (envelope as { remoteSequence?: number }).remoteSequence ?? envelope.globalSequence,
          );
        } else if (result.status === "conflict") {
          syncMetrics.incrementConflicts();
          // Do not advance cursor past unapplied conflict — stop page
          recordSyncDiagnostic({
            stage: "pull-conflict",
            message: result.code,
            timestamp: new Date().toISOString(),
          });
          break;
        } else {
          recordSyncDiagnostic({
            stage: "pull-reject",
            message: result.code,
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }

      if (applied > 0) {
        await advanceSyncCursor(
          principal?.tenantId ?? "local",
          lastAppliedSeq,
          response.vectorClock,
        );
      }

      syncMetrics.incrementEventsPulled(applied);
      recordSyncDiagnostic({
        stage: "pull-success",
        message: `applied=${applied}`,
        timestamp: new Date().toISOString(),
      });

      return applied;
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
