/**
 * PR-D2 / ADR_0098 — language defect burn-down pack (not collected yet).
 */

export const LANGUAGE_DEFECT_BURNDOWN_ADR = "ADR_0098" as const;
export const LANGUAGE_DEFECT_BURNDOWN_STEP = "PR-D2" as const;
export const LANGUAGE_DEFECT_BURNDOWN_DECISION =
  "LANGUAGE_DEFECT_BURNDOWN_PACK" as const;
export const PACK_READY = true;
export const DEFECTS_COLLECTED = false;
export const BURN_DOWN_COMPLETE = false;
export const ASSERTION_WEAKENING_ALLOWED = false;
export const PRODUCTION_APPROVED = false;

export function languageDefectBurndownSnapshot() {
  return {
    authority: LANGUAGE_DEFECT_BURNDOWN_ADR,
    step: LANGUAGE_DEFECT_BURNDOWN_STEP,
    decision: LANGUAGE_DEFECT_BURNDOWN_DECISION,
    packReady: PACK_READY,
    defectsCollected: DEFECTS_COLLECTED,
    burnDownComplete: BURN_DOWN_COMPLETE,
    assertionWeakeningAllowed: ASSERTION_WEAKENING_ALLOWED,
    productionApproved: PRODUCTION_APPROVED,
  };
}
