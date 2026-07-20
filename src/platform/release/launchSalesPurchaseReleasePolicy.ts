/**
 * PR-C1 / ADR_0090 + ADR_0100 — launch sales/purchase release (armed).
 * Runtime env on Render still required for live traffic.
 */

export const LAUNCH_SALES_PURCHASE_RELEASE_ADR = "ADR_0090" as const;
export const LAUNCH_SALES_PURCHASE_ARM_ADR = "ADR_0100" as const;
export const LAUNCH_SALES_PURCHASE_RELEASE_STEP = "PR-C1" as const;
export const LAUNCH_SALES_PURCHASE_RELEASE_DECISION =
  "LAUNCH_SALES_PURCHASE_RELEASE_PACKAGE" as const;
export const CAPABILITY_ROW = "LAUNCH-ACCOUNTANT-SALES-PURCHASE" as const;
export const FLAG_ARMED = true;
export const PRODUCTION_APPROVED = true;
export const NEXT_20_DONE = true;
export const OWNER_SIGNED = true;

/** UI / docs disclosure strings (launch row). */
export const LAUNCH_SALES_PURCHASE_DISCLOSURES = [
  "Settlement, returns, and bank recon are not in the AI launch set.",
  "Natural-language yes does not post.",
  "Sync may show Waiting to sync until acknowledged.",
  "Legal and tax-current answers may abstain.",
  "Invoice UI totals are display estimates; ledger uses the domain engine.",
] as const;

/**
 * Frontend mirror of registry arm. Deploy still needs Render env
 * LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true for Python runtime gate.
 */
export function isLaunchSalesPurchaseProductionApproved(): boolean {
  return FLAG_ARMED && PRODUCTION_APPROVED && OWNER_SIGNED;
}

export function launchSalesPurchaseReleaseSnapshot() {
  return {
    authority: LAUNCH_SALES_PURCHASE_RELEASE_ADR,
    armAuthority: LAUNCH_SALES_PURCHASE_ARM_ADR,
    step: LAUNCH_SALES_PURCHASE_RELEASE_STEP,
    decision: LAUNCH_SALES_PURCHASE_RELEASE_DECISION,
    capabilityRow: CAPABILITY_ROW,
    flagArmed: FLAG_ARMED,
    productionApproved: PRODUCTION_APPROVED,
    next20Done: NEXT_20_DONE,
    ownerSigned: OWNER_SIGNED,
    runtimeProductionApproved: isLaunchSalesPurchaseProductionApproved(),
    disclosures: [...LAUNCH_SALES_PURCHASE_DISCLOSURES],
  };
}
