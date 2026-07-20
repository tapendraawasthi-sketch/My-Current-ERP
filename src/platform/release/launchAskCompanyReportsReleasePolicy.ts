/**
 * PR-C2 / ADR_0092 — Ask company reports release package (flag OFF).
 * Does not enable production traffic.
 */

export const LAUNCH_ASK_COMPANY_REPORTS_RELEASE_ADR = "ADR_0092" as const;
export const LAUNCH_ASK_COMPANY_REPORTS_RELEASE_STEP = "PR-C2" as const;
export const LAUNCH_ASK_COMPANY_REPORTS_RELEASE_DECISION =
  "LAUNCH_ASK_COMPANY_REPORTS_RELEASE_PACKAGE" as const;
export const CAPABILITY_ROW = "LAUNCH-ASK-COMPANY-REPORTS" as const;
export const FLAG_ARMED = false;
export const PRODUCTION_APPROVED = false;
export const NEXT_20_DONE = false;
export const OWNER_SIGNED = false;
export const ZERO_MUTATION = true;

/** UI / docs disclosure strings (Ask reports launch row). */
export const LAUNCH_ASK_COMPANY_REPORTS_DISCLOSURES = [
  "Ask Mode is zero mutation — never posts or drafts sales/purchase.",
  "Natural-language yes does not post.",
  "Legal and tax-current answers may abstain.",
  "Production retrieval is LEXICAL_ONLY.",
  "Ungrounded claims force abstain / citation honesty.",
] as const;

export function isLaunchAskCompanyReportsProductionApproved(): false {
  // Armed flip is a later PR-C2-ARM change; keep hard false in this ship.
  return false;
}

export function launchAskCompanyReportsReleaseSnapshot() {
  return {
    authority: LAUNCH_ASK_COMPANY_REPORTS_RELEASE_ADR,
    step: LAUNCH_ASK_COMPANY_REPORTS_RELEASE_STEP,
    decision: LAUNCH_ASK_COMPANY_REPORTS_RELEASE_DECISION,
    capabilityRow: CAPABILITY_ROW,
    flagArmed: FLAG_ARMED,
    productionApproved: PRODUCTION_APPROVED,
    next20Done: NEXT_20_DONE,
    ownerSigned: OWNER_SIGNED,
    zeroMutation: ZERO_MUTATION,
    runtimeProductionApproved: isLaunchAskCompanyReportsProductionApproved(),
    disclosures: [...LAUNCH_ASK_COMPANY_REPORTS_DISCLOSURES],
  };
}
