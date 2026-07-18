# R3M Root-Cause Taxonomy

Primary stages assigned from **saved R3L observations only**:

| Stage | Typical evidence |
|-------|------------------|
| SPAN_RESOLUTION | SPAN_FAILURE / SPAN_AMBIGUOUS |
| ELIGIBILITY | IDENTITY_ONLY / ABSTAIN / skipped eligibility with missing Devanagari |
| IDENTITY_CANDIDATE_INVARIANT | Identity absent or not retained |
| DEVANAGARI_GENERATOR_COVERAGE | GENERATE with no Devanagari non-identity candidate |
| CANDIDATE_DEDUPLICATION_OR_CAP | (reserved; requires pre-cap evidence) |
| RANKING | Identity present but not top-1; Devanagari present not top-1 (non-gold) |
| ENGLISH_IDENTITY_GUARD | Identity present + Devanagari top-1 under ENGLISH_IDENTITY |
| ACRONYM_OR_IDENTIFIER_PROTECTION | Acronym/protected identity corruption |
| OPTIONAL_POLICY | Optional identity missing |
| CONTEXT_REVIEW_SIGNAL | Context diversity/review signal missing |
| EVIDENCE_OR_POLICY_REFERENCE | Risk-only PASS residuals |
| INSUFFICIENT_OBSERVATION_EVIDENCE / UNKNOWN | Fail closed |

Never assign linguistic correctness of Devanagari spellings.
