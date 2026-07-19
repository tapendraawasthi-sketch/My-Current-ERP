import { describe, expect, it } from "vitest";
import {
  APPLIED_RESPONSE_REWRITE,
  LITERARY_NEPALI_CLAIMED,
  PRODUCTION_APPROVED,
  RESPONSE_LANGUAGE_ADR,
  RESPONSE_LANGUAGE_DECISION,
  SOLE_NLU,
  responseLanguageHonestySnapshot,
} from "@/platform/language/responseLanguageLivePolicy";

describe("NEXT-08 response language live parity honesty", () => {
  it("declares scaffold parity without rewrite or production approval", () => {
    const snap = responseLanguageHonestySnapshot();
    expect(snap.authority).toBe(RESPONSE_LANGUAGE_ADR);
    expect(snap.authority).toBe("ADR_0082");
    expect(snap.decision).toBe(RESPONSE_LANGUAGE_DECISION);
    expect(snap.appliedResponseRewrite).toBe(false);
    expect(APPLIED_RESPONSE_REWRITE).toBe(false);
    expect(snap.literaryNepaliClaimed).toBe(false);
    expect(LITERARY_NEPALI_CLAIMED).toBe(false);
    expect(snap.soleNlu).toBe(false);
    expect(SOLE_NLU).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(snap.claimLevel).toBe("STABLE_USEFUL_PARITY");
  });
});
