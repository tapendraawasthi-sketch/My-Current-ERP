/**
 * PR-D3 / ADR_0099 — dual-writer/sync residual burn-down (gaps still REDUCED).
 */

export const DUAL_WRITER_SYNC_BURNDOWN_ADR = "ADR_0099" as const;
export const DUAL_WRITER_SYNC_BURNDOWN_STEP = "PR-D3" as const;
export const DUAL_WRITER_SYNC_BURNDOWN_DECISION =
  "DUAL_WRITER_SYNC_RESIDUAL_BURNDOWN_PACK" as const;
export const PACK_READY = true;
export const GAP_P0_001_CLOSED = false;
export const GAP_P1_002_CLOSED = false;
export const OEC_SOLE = false;
export const PRODUCTION_APPROVED = false;

export function dualWriterSyncBurndownSnapshot() {
  return {
    authority: DUAL_WRITER_SYNC_BURNDOWN_ADR,
    step: DUAL_WRITER_SYNC_BURNDOWN_STEP,
    decision: DUAL_WRITER_SYNC_BURNDOWN_DECISION,
    packReady: PACK_READY,
    gapP0001Closed: GAP_P0_001_CLOSED,
    gapP1002Closed: GAP_P1_002_CLOSED,
    oecSole: OEC_SOLE,
    productionApproved: PRODUCTION_APPROVED,
  };
}
