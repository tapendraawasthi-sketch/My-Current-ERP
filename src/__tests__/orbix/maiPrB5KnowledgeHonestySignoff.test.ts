import { describe, expect, it } from "vitest";
import {
  CLAIMS_VERIFIED,
  ENGINEERING_GATE_STATUS,
  GAP_P2_008_CLOSED,
  KNOWLEDGE_HONESTY_SIGNOFF_ADR,
  LAUNCH_ASK_SIGN_STATUS,
  LEGAL_EFFECTIVE_DATES_PROVEN,
  PRODUCTION_APPROVED,
  STAGING_PROFESSIONAL_ATTESTED,
  knowledgeHonestySignoffSnapshot,
} from "@/platform/knowledge/knowledgeHonestySignoffPolicy";
import {
  FAKE_CITATION_ALLOWED,
  knowledgeCitationHonestySnapshot,
} from "@/platform/knowledge/knowledgeCitationHonestyPolicy";

describe("PR-B5 knowledge honesty sign-off", () => {
  it("declares engineering PASS and honest residual", () => {
    const snap = knowledgeHonestySignoffSnapshot();
    expect(snap.authority).toBe(KNOWLEDGE_HONESTY_SIGNOFF_ADR);
    expect(snap.authority).toBe("ADR_0088");
    expect(snap.step).toBe("PR-B5");
    expect(snap.engineeringGateStatus).toBe(ENGINEERING_GATE_STATUS);
    expect(snap.engineeringGateStatus).toBe("PASS");
    expect(snap.launchAskSignStatus).toBe(LAUNCH_ASK_SIGN_STATUS);
    expect(snap.launchAskSignStatus).toBe("ENGINEERING_PASS");
    expect(snap.stagingProfessionalAttested).toBe(false);
    expect(STAGING_PROFESSIONAL_ATTESTED).toBe(false);
    expect(snap.gapP2008RegisterStatus).toBe("REDUCED");
    expect(snap.gapP2008Closed).toBe(false);
    expect(GAP_P2_008_CLOSED).toBe(false);
    expect(snap.claimsVerified).toBe(false);
    expect(CLAIMS_VERIFIED).toBe(false);
    expect(snap.legalEffectiveDatesProven).toBe(false);
    expect(LEGAL_EFFECTIVE_DATES_PROVEN).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("keeps ADR_0080 force-abstain honesty intact", () => {
    const base = knowledgeCitationHonestySnapshot();
    expect(base.fakeCitationAllowed).toBe(false);
    expect(FAKE_CITATION_ALLOWED).toBe(false);
    expect(base.gapP2008Closed).toBe(false);
    expect(base.knowledgeReleaseStatus).toBe("NOT_RELEASED");
  });
});
