/**
 * PR-C3-PACK / ADR_0093 — Day-0 smoke pack (NOT_RUN; not PASS).
 */

export const DAY0_SMOKE_PACK_ADR = "ADR_0093" as const;
export const DAY0_SMOKE_PACK_STEP = "PR-C3-PACK" as const;
export const DAY0_SMOKE_PACK_DECISION = "DAY0_PRODUCTION_SMOKE_PACK" as const;
export const PACK_READY = true;
export const SMOKE_STATUS = "NOT_RUN" as const;
export const SMOKE_PASS = false;
export const PRODUCTION_APPROVED = false;

export function isDay0SmokePass(): false {
  return false;
}

export function day0SmokePackSnapshot() {
  return {
    authority: DAY0_SMOKE_PACK_ADR,
    step: DAY0_SMOKE_PACK_STEP,
    decision: DAY0_SMOKE_PACK_DECISION,
    packReady: PACK_READY,
    smokeStatus: SMOKE_STATUS,
    smokePass: SMOKE_PASS,
    productionApproved: PRODUCTION_APPROVED,
    runtimeSmokePass: isDay0SmokePass(),
  };
}
