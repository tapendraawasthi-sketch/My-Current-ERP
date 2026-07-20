/**
 * PR-D1 / ADR_0097 — error budget & incident loop pack (not 14-day stable).
 */

export const ERROR_BUDGET_INCIDENT_LOOP_ADR = "ADR_0097" as const;
export const ERROR_BUDGET_INCIDENT_LOOP_STEP = "PR-D1" as const;
export const ERROR_BUDGET_INCIDENT_LOOP_DECISION =
  "ERROR_BUDGET_INCIDENT_LOOP_PACK" as const;
export const PACK_READY = true;
export const FOURTEEN_DAY_STABLE = false;
export const WEEKLY_REVIEWS_EXECUTED = false;
export const PRODUCTION_APPROVED = false;

export function errorBudgetIncidentLoopSnapshot() {
  return {
    authority: ERROR_BUDGET_INCIDENT_LOOP_ADR,
    step: ERROR_BUDGET_INCIDENT_LOOP_STEP,
    decision: ERROR_BUDGET_INCIDENT_LOOP_DECISION,
    packReady: PACK_READY,
    fourteenDayStable: FOURTEEN_DAY_STABLE,
    weeklyReviewsExecuted: WEEKLY_REVIEWS_EXECUTED,
    productionApproved: PRODUCTION_APPROVED,
  };
}
