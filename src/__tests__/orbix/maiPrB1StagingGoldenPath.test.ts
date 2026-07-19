import { describe, expect, it } from "vitest";
import {
  BLOCKS_PR_C,
  ENGINEERING_PACK_READY,
  PRODUCTION_APPROVED,
  STAGING_ATTESTATION_COMPLETE,
  STAGING_GOLDEN_ADR,
  stagingGoldenPathHonestySnapshot,
} from "@/platform/launch/stagingGoldenPathPolicy";

describe("PR-B1 staging golden path honesty", () => {
  it("records engineering pack without false staging attestation or production", () => {
    const snap = stagingGoldenPathHonestySnapshot();
    expect(snap.authority).toBe(STAGING_GOLDEN_ADR);
    expect(snap.authority).toBe("ADR_0084");
    expect(snap.engineeringPackReady).toBe(true);
    expect(ENGINEERING_PACK_READY).toBe(true);
    expect(snap.stagingAttestationComplete).toBe(false);
    expect(STAGING_ATTESTATION_COMPLETE).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(snap.blocksPrC).toBe(true);
    expect(BLOCKS_PR_C).toBe(true);
  });
});
