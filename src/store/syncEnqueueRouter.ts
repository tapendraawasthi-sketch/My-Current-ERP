import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { enqueueSyncRecord, type EnqueueSyncInput } from "@/lib/syncEngine";
import { syncDomain } from "@/domains/sync";

export async function enqueueAfterDomainWrite(input: EnqueueSyncInput): Promise<void> {
  if (isMigrationFlagEnabled("MIGRATION_EVENT_SYNC") && !isMigrationFlagEnabled("MIGRATION_DUAL_WRITE")) {
    return;
  }

  if (isMigrationFlagEnabled("MIGRATION_DOMAIN_FACADES")) {
    await syncDomain.enqueue({
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
    });
    return;
  }

  await enqueueSyncRecord(input);
}
