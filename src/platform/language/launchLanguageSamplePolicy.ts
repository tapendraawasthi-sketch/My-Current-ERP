/** NEXT-09 / ADR_0083 — launch language sample product-policy honesty (TS mirror). */

export const LAUNCH_LANGUAGE_ADR = "ADR_0083" as const;
export const LAUNCH_LANGUAGE_STEP = "NEXT-09" as const;
export const LAUNCH_LANGUAGE_DECISION =
  "LAUNCH_LANGUAGE_SAMPLE_PRODUCT_POLICY_REVIEW" as const;
export const GAP_P1_009_REGISTER_STATUS = "REDUCED" as const;
export const PRODUCT_POLICY_APPROVED_LAUNCH_SLICE = true;
export const LINGUIST_APPROVED_LAUNCH_SLICE = false;
export const PRODUCTION_APPROVED = false;

export function launchLanguageSampleHonestySnapshot() {
  return {
    authority: LAUNCH_LANGUAGE_ADR,
    step: LAUNCH_LANGUAGE_STEP,
    decision: LAUNCH_LANGUAGE_DECISION,
    gapP1009RegisterStatus: GAP_P1_009_REGISTER_STATUS,
    productPolicyApprovedLaunchLanguageSlice: PRODUCT_POLICY_APPROVED_LAUNCH_SLICE,
    linguistApprovedLaunchLanguageSlice: LINGUIST_APPROVED_LAUNCH_SLICE,
    productionApproved: PRODUCTION_APPROVED,
    blockingFixCount: 0,
  };
}
