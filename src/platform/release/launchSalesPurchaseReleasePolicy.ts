/**
 * PR-C1 / ADR_0090 — launch sales/purchase release package (flag OFF).
 * Does not enable production traffic.
 */

export const LAUNCH_SALES_PURCHASE_RELEASE_ADR = "ADR_0090" as const;
export const LAUNCH_SALES_PURCHASE_RELEASE_STEP = "PR-C1" as const;
export const LAUNCH_SALES_PURCHASE_RELEASE_DECISION =
  "LAUNCH_SALES_PURCHASE_RELEASE_PACKAGE" as const;
export const CAPABILITY_ROW = "LAUNCH-ACCOUNTANT-SALES-PURCHASE" as const;
export const FLAG_ARMED = false;
export const PRODUCTION_APPROVED = false;
export const NEXT_20_DONE = false;
export const OWNER_SIGNED = false;

/** UI / docs disclosure strings (launch row). */
export const LAUNCH_SALES_PURCHASE_DISCLOSURES = [
  "Settlement, returns, and bank recon are not in the AI launch set.",
  "Natural-language yes does not post.",
  "Sync may show Waiting to sync until acknowledged.",
  "Legal and tax-current answers may abstain.",
  "Invoice UI totals are display estimates; ledger uses the domain engine.",
] as const;

export function isLaunchSalesPurchaseProductionApproved(): false {
  // Armed flip is a later PR-C1-ARM change; keep hard false in this ship.
  return false;
}

export function launchSalesPurchaseReleaseSnapshot() {
  return {
    authority: LAUNCH_SALES_PURCHASE_RELEASE_ADR,
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
