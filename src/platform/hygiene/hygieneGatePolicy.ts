/** PR-B6 / ADR_0089 — hygiene gate constants. */

export const HYGIENE_GATE_ADR = "ADR_0089" as const;
export const HYGIENE_GATE_STEP = "PR-B6" as const;
export const HYGIENE_GATE_DECISION = "PROD_READY_HYGIENE_GATE" as const;
export const INVOICE_PRINT_SYNTAX_FIXED = true;
export const FULL_TSC_GREEN_CLAIMED = false;
export const PLAYWRIGHT_REQUIRED_GREEN = false;
export const VACUOUS_GREENS_ALLOWED = false;
export const GAP_P1_005_REGISTER_STATUS = "REDUCED" as const;
export const GAP_P2_004_REGISTER_STATUS = "REDUCED" as const;
export const PRODUCTION_APPROVED = false;

export function hygieneGateSnapshot() {
  return {
    authority: HYGIENE_GATE_ADR,
    step: HYGIENE_GATE_STEP,
    decision: HYGIENE_GATE_DECISION,
    invoicePrintSyntaxFixed: INVOICE_PRINT_SYNTAX_FIXED,
    fullTscGreenClaimed: FULL_TSC_GREEN_CLAIMED,
    playwrightRequiredGreen: PLAYWRIGHT_REQUIRED_GREEN,
    vacuousGreensAllowed: VACUOUS_GREENS_ALLOWED,
    gapP1005RegisterStatus: GAP_P1_005_REGISTER_STATUS,
    gapP2004RegisterStatus: GAP_P2_004_REGISTER_STATUS,
    productionApproved: PRODUCTION_APPROVED,
  };
}
