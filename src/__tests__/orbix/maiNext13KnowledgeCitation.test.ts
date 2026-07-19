import { describe, expect, it } from "vitest";
import {
  CLAIMS_VERIFIED,
  CITATIONS_VERIFIED,
  FAKE_CITATION_ALLOWED,
  GAP_P2_008_REGISTER_STATUS,
  KNOWLEDGE_CITATION_ADR,
  KNOWLEDGE_RELEASE_STATUS,
  LEGAL_EFFECTIVE_DATES_PROVEN,
  knowledgeCitationHonestySnapshot,
} from "@/platform/knowledge/knowledgeCitationHonestyPolicy";

describe("NEXT-13 knowledge citation honesty", () => {
  it("declares force-abstain honesty and REDUCED gap", () => {
    const snap = knowledgeCitationHonestySnapshot();
    expect(snap.authority).toBe(KNOWLEDGE_CITATION_ADR);
    expect(snap.authority).toBe("ADR_0080");
    expect(snap.fakeCiteFails).toBe(true);
    expect(snap.missingEvidenceNoAnswer).toBe(true);
    expect(snap.taxCurrentWithoutReleaseAbstains).toBe(true);
    expect(snap.allowWithCandidatesIsNotVerified).toBe(true);
    expect(snap.fakeCitationAllowed).toBe(false);
    expect(FAKE_CITATION_ALLOWED).toBe(false);
    expect(snap.claimsVerified).toBe(false);
    expect(CLAIMS_VERIFIED).toBe(false);
    expect(snap.citationsVerified).toBe(false);
    expect(CITATIONS_VERIFIED).toBe(false);
    expect(snap.legalEffectiveDatesProven).toBe(false);
    expect(LEGAL_EFFECTIVE_DATES_PROVEN).toBe(false);
    expect(snap.knowledgeReleaseStatus).toBe("NOT_RELEASED");
    expect(KNOWLEDGE_RELEASE_STATUS).toBe("NOT_RELEASED");
    expect(snap.gapP2008RegisterStatus).toBe("REDUCED");
    expect(GAP_P2_008_REGISTER_STATUS).toBe("REDUCED");
    expect(snap.gapP2008Closed).toBe(false);
    expect(snap.productionApproved).toBe(false);
  });
});
