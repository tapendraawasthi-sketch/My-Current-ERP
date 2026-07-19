/** PR-B3 / ADR_0086 — sync honesty residual (TS mirror). */

export const SYNC_HONESTY_ADR = "ADR_0086" as const;
export const SYNC_HONESTY_STEP = "PR-B3" as const;
export const SYNC_HONESTY_DECISION = "SYNC_HONESTY_RESIDUAL_PACK" as const;
export const ACCOUNTING_SYNC_AUTHORITY = "EVENT_SYNC_QUEUE" as const;
export const QUEUED_MUST_NOT_LABEL_SYNCED = true;
export const CONFLICT_AUTO_OVERWRITE = false;
export const DUAL_SYNC_CLOSED = false;
export const GAP_P1_002_REGISTER_STATUS = "REDUCED" as const;
export const GAP_P1_002_CLOSED = false;
export const STAGING_CONFLICT_ATTESTED = false;
export const PRODUCTION_APPROVED = false;

/** Posting sync_status values that must never present as Synced. */
export const NON_SYNCED_POST_STATUSES = [
  "pending",
  "queued",
  "waiting_to_sync",
  "syncing",
  "retry_scheduled",
] as const;

export function syncHonestyResidualSnapshot() {
  return {
    authority: SYNC_HONESTY_ADR,
    step: SYNC_HONESTY_STEP,
    decision: SYNC_HONESTY_DECISION,
    accountingSyncAuthority: ACCOUNTING_SYNC_AUTHORITY,
    queuedMustNotLabelSynced: QUEUED_MUST_NOT_LABEL_SYNCED,
    conflictAutoOverwrite: CONFLICT_AUTO_OVERWRITE,
    dualSyncClosed: DUAL_SYNC_CLOSED,
    gapP1002RegisterStatus: GAP_P1_002_REGISTER_STATUS,
    gapP1002Closed: GAP_P1_002_CLOSED,
    stagingConflictAttested: STAGING_CONFLICT_ATTESTED,
    productionApproved: PRODUCTION_APPROVED,
  };
}
