import { describe, expect, it } from "vitest";
import {
  DUAL_SILENT_WRITER_ON_LAUNCH_PATH,
  GAP_P0_001_CLOSED,
  LAUNCH_MUTATION_ADR,
  OEC_IS_SOLE_MUTATION_AUTHORITY,
  PRODUCT_MUTATION_PATH,
  PRODUCTION_APPROVED,
  launchMutationResidualHonestySnapshot,
} from "@/platform/launch/launchMutationResidualPolicy";

describe("PR-B2 launch mutation residual honesty", () => {
  it("keeps Model B product path and honest non-sole OEC", () => {
    const snap = launchMutationResidualHonestySnapshot();
    expect(snap.authority).toBe(LAUNCH_MUTATION_ADR);
    expect(snap.authority).toBe("ADR_0085");
    expect(snap.productMutationPath).toBe(PRODUCT_MUTATION_PATH);
    expect(snap.oecIsSoleMutationAuthority).toBe(false);
    expect(OEC_IS_SOLE_MUTATION_AUTHORITY).toBe(false);
    expect(snap.dualSilentWriterOnLaunchPath).toBe(false);
    expect(DUAL_SILENT_WRITER_ON_LAUNCH_PATH).toBe(false);
    expect(snap.gapP0001Closed).toBe(false);
    expect(GAP_P0_001_CLOSED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });
});
