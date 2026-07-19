/**
 * NEXT-04 / ADR_0074 — sync authority constants (accounting event-sync path).
 * Does not start workers or mutate queues. Enforcement for accounting→legacy
 * outbox blocking remains in syncEnqueueRouter + noDoubleSync tests.
 */

export const SYNC_AUTHORITY_ADR = "ADR_0074" as const;
export const ACCOUNTING_SYNC_AUTHORITY = "EVENT_SYNC_QUEUE" as const;
export const CONFLICT_POLICY =
  "REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT" as const;
export const QUEUED_MUST_NOT_LABEL_SYNCED = true;
export const CONFLICT_AUTO_OVERWRITE = false;
/** Runtime residual dual remains OPEN; register status is REDUCED. */
export const GAP_P1_002_RUNTIME_STATUS = "OPEN" as const;
export const GAP_P1_002_REGISTER_STATUS = "REDUCED" as const;
export const DUAL_SYNC_WRITTEN_EXCEPTION =
  "NON_ACCOUNTING_LEGACY_OUTBOX_AND_AGGREGATE_BADGE_RESIDUAL" as const;

export function syncAuthorityHonestySnapshot() {
  return {
    authority: SYNC_AUTHORITY_ADR,
    accountingSyncAuthority: ACCOUNTING_SYNC_AUTHORITY,
    conflictPolicy: CONFLICT_POLICY,
    queuedMustNotLabelSynced: QUEUED_MUST_NOT_LABEL_SYNCED,
    conflictAutoOverwrite: CONFLICT_AUTO_OVERWRITE,
    gapP1002RuntimeStatus: GAP_P1_002_RUNTIME_STATUS,
    gapP1002RegisterStatus: GAP_P1_002_REGISTER_STATUS,
    dualSyncWrittenException: DUAL_SYNC_WRITTEN_EXCEPTION,
    oecIsSoleMutationAuthority: false,
    productionApproved: false,
  };
}
