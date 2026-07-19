/**
 * PR-B4 / ADR_0087 — calc/preview residual (GAP-P2-002 stays REDUCED).
 * Extends ADR_0078; does not claim CLOSED.
 */

export const CALC_PREVIEW_RESIDUAL_ADR = "ADR_0087" as const;
export const CALC_PREVIEW_RESIDUAL_STEP = "PR-B4" as const;
export const CALC_PREVIEW_RESIDUAL_DECISION = "CALC_PREVIEW_RESIDUAL_SPOTCHECK" as const;
export const CALC_AUTHORITY_ON_CONFIRM = "DEXIE_DOMAIN_ENGINE" as const;
export const UI_CALCULATES_AUTHORITATIVE_TOTALS = false as const;
export const GAP_P2_002_REGISTER_STATUS = "REDUCED" as const;
export const GAP_P2_002_CLOSED = false;
export const KNOWN_PAISA_DRIFT_ON_LAUNCH_FIXTURES = false;
export const PRODUCTION_APPROVED = false;

export function calcPreviewResidualSnapshot() {
  return {
    authority: CALC_PREVIEW_RESIDUAL_ADR,
    step: CALC_PREVIEW_RESIDUAL_STEP,
    decision: CALC_PREVIEW_RESIDUAL_DECISION,
    calcAuthorityOnConfirm: CALC_AUTHORITY_ON_CONFIRM,
    uiCalculatesAuthoritativeTotals: UI_CALCULATES_AUTHORITATIVE_TOTALS,
    gapP2002RegisterStatus: GAP_P2_002_REGISTER_STATUS,
    gapP2002Closed: GAP_P2_002_CLOSED,
    knownPaisaDriftOnLaunchFixtures: KNOWN_PAISA_DRIFT_ON_LAUNCH_FIXTURES,
    productionApproved: PRODUCTION_APPROVED,
  };
}

/** Paisa distance between display estimate and posted ledger grand total. */
export function paisaDrift(displayGrand: number, postedGrand: number): number {
  const toPaisa = (n: number) => Math.round((Number(n) || 0) * 100);
  return Math.abs(toPaisa(displayGrand) - toPaisa(postedGrand));
}
