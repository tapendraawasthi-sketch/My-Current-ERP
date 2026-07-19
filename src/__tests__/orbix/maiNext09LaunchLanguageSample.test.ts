import { describe, expect, it } from "vitest";
import {
  GAP_P1_009_REGISTER_STATUS,
  LAUNCH_LANGUAGE_ADR,
  LINGUIST_APPROVED_LAUNCH_SLICE,
  PRODUCT_POLICY_APPROVED_LAUNCH_SLICE,
  PRODUCTION_APPROVED,
  launchLanguageSampleHonestySnapshot,
} from "@/platform/language/launchLanguageSamplePolicy";

describe("NEXT-09 launch language sample honesty", () => {
  it("records product-policy launch slice without false linguist or production", () => {
    const snap = launchLanguageSampleHonestySnapshot();
    expect(snap.authority).toBe(LAUNCH_LANGUAGE_ADR);
    expect(snap.authority).toBe("ADR_0083");
    expect(snap.gapP1009RegisterStatus).toBe("REDUCED");
    expect(GAP_P1_009_REGISTER_STATUS).toBe("REDUCED");
    expect(snap.productPolicyApprovedLaunchLanguageSlice).toBe(true);
    expect(PRODUCT_POLICY_APPROVED_LAUNCH_SLICE).toBe(true);
    expect(snap.linguistApprovedLaunchLanguageSlice).toBe(false);
    expect(LINGUIST_APPROVED_LAUNCH_SLICE).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(snap.blockingFixCount).toBe(0);
  });
});
