/**
 * PR-D4 / ADR_0096 — operator runbook pack (READY; not post-launch stable).
 */

export const OPERATOR_RUNBOOK_ADR = "ADR_0096" as const;
export const OPERATOR_RUNBOOK_STEP = "PR-D4" as const;
export const OPERATOR_RUNBOOK_DECISION = "OPERATOR_RUNBOOK_PACK" as const;
export const PACK_READY = true;
export const POST_LAUNCH_STABLE = false;
export const PRODUCTION_APPROVED = false;
export const DAY0_SMOKE_PASS = false;

export function operatorRunbookSnapshot() {
  return {
    authority: OPERATOR_RUNBOOK_ADR,
    step: OPERATOR_RUNBOOK_STEP,
    decision: OPERATOR_RUNBOOK_DECISION,
    packReady: PACK_READY,
    postLaunchStable: POST_LAUNCH_STABLE,
    productionApproved: PRODUCTION_APPROVED,
    day0SmokePass: DAY0_SMOKE_PASS,
  };
}
