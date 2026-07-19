/**
 * NEXT-13 / ADR_0080 — knowledge citation honesty constants (launch Ask).
 * Does not retrieve or verify citations.
 */

export const KNOWLEDGE_CITATION_ADR = "ADR_0080" as const;
export const KNOWLEDGE_CITATION_DECISION =
  "LAUNCH_ASK_KNOWLEDGE_CITATION_HONESTY_GATE" as const;
export const FAKE_CITATION_ALLOWED = false as const;
export const CLAIMS_VERIFIED = false as const;
export const CITATIONS_VERIFIED = false as const;
export const LEGAL_EFFECTIVE_DATES_PROVEN = false as const;
export const KNOWLEDGE_RELEASE_STATUS = "NOT_RELEASED" as const;
export const GAP_P2_008_REGISTER_STATUS = "REDUCED" as const;

export function knowledgeCitationHonestySnapshot() {
  return {
    authority: KNOWLEDGE_CITATION_ADR,
    decision: KNOWLEDGE_CITATION_DECISION,
    fakeCiteFails: true,
    missingEvidenceNoAnswer: true,
    taxCurrentWithoutReleaseAbstains: true,
    allowWithCandidatesIsNotVerified: true,
    fakeCitationAllowed: FAKE_CITATION_ALLOWED,
    claimsVerified: CLAIMS_VERIFIED,
    citationsVerified: CITATIONS_VERIFIED,
    legalEffectiveDatesProven: LEGAL_EFFECTIVE_DATES_PROVEN,
    knowledgeReleaseStatus: KNOWLEDGE_RELEASE_STATUS,
    gapP2008RegisterStatus: GAP_P2_008_REGISTER_STATUS,
    gapP2008Closed: false,
    productionApproved: false,
    isExecutionAuthority: false,
  };
}
