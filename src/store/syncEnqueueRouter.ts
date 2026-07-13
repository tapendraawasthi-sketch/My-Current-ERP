import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { enqueueSyncRecord, type EnqueueSyncInput } from "@/lib/syncEngine";
import { syncDomain } from "@/domains/sync";

/** Accounting transaction entities must use eventSyncQueue only (Phase 6 cutover). */
const ACCOUNTING_ENTITY_TYPES = new Set([
  "invoice",
  "invoices",
  "voucher",
  "vouchers",
  "stockMovement",
  "stockMovements",
  "orbixPostingReceipt",
  "orbixPostingReceipts",
]);

export function isAccountingEntitySyncBlocked(entityType: string): boolean {
  return ACCOUNTING_ENTITY_TYPES.has(entityType);
}

export async function enqueueAfterDomainWrite(input: EnqueueSyncInput): Promise<void> {
  if (isAccountingEntitySyncBlocked(input.entityType)) {
    return;
  }

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
