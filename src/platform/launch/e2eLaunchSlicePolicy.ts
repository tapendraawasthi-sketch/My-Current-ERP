/**
 * NEXT-12 / ADR_0079 — E2E launch slice honesty constants.
 * Does not post, sync, or invent receipts.
 */

export const E2E_LAUNCH_SLICE_ADR = "ADR_0079" as const;
export const E2E_LAUNCH_SLICE_DECISION = "E2E_LAUNCH_SLICE_EVIDENCE_PACK" as const;
export const PRODUCT_CONFIRM_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM" as const;
export const DUAL_SILENT_WRITERS_FORBIDDEN = true as const;
export const NL_ASSENT_POSTS = false as const;
export const QUEUED_MUST_NOT_LABEL_SYNCED = true as const;

export const LAUNCH_SLICE_EVENT_IDS = [
  "sales_invoice_draft",
  "purchase_invoice_draft",
  "ask_company_report",
] as const;

export type LaunchSliceEventId = (typeof LAUNCH_SLICE_EVENT_IDS)[number];

export function e2eLaunchSliceHonestySnapshot() {
  return {
    authority: E2E_LAUNCH_SLICE_ADR,
    decision: E2E_LAUNCH_SLICE_DECISION,
    productConfirmPath: PRODUCT_CONFIRM_PATH,
    dualSilentWritersForbidden: DUAL_SILENT_WRITERS_FORBIDDEN,
    nlAssentPosts: NL_ASSENT_POSTS,
    queuedMustNotLabelSynced: QUEUED_MUST_NOT_LABEL_SYNCED,
    launchEventIds: [...LAUNCH_SLICE_EVENT_IDS],
    productionApproved: false,
    isExecutionAuthority: false,
    oecSoleMutationAuthority: false,
    gapP0001Closed: false,
    settlementInSlice: false,
  };
}

/** Pending/local post must never present as synced. */
export function mayLabelSynced(syncStatus: string | null | undefined): boolean {
  return syncStatus === "synced";
}
