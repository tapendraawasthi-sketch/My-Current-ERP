import { executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuery, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import {
  enqueueSyncRecord,
  onSyncStatusChange,
  getPendingSyncCount,
  syncNow,
  type SyncStatus,
} from "@/lib/syncEngine";

export const syncDomain = {
  enqueue(input: {
    entityType: string;
    entityId: string;
    operation: "create" | "update";
    payload: Record<string, unknown>;
  }) {
    return executeCommandVoid({
      commandType: CommandTypes.ENQUEUE_SYNC_RECORD,
      aggregateType: AggregateTypes.SYNC,
      aggregateId: input.entityId,
      payload: input,
    });
  },
  enqueueLegacy: enqueueSyncRecord,
  onStatusChange(listener: (status: SyncStatus, pendingCount: number) => void) {
    return onSyncStatusChange(listener);
  },
  pendingCount() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuery<{ pendingCount: number }>({
        queryType: QueryTypes.SYNC_STATUS,
        payload: {},
      }).then((result) => result.pendingCount);
    }
    return getPendingSyncCount();
  },
  syncNow() {
    return syncNow();
  },
};

export type SyncDomain = typeof syncDomain;
