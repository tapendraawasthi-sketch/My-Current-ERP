# ADR_0016 — R3N2 invalidated parent lineage and fresh holdout requirement

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE
- **Extends:** ADR_0015, MAI-07R3N-INTEGRITY-CLOSURE

## Context

MAI-07R3N RC_002 was invalidated for holdout contamination (`INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`). A fresh corrective must not reuse R3N holdout case IDs, texts, or template families, must bind scorer/population/threshold hashes before holdout, and must ship under a new candidate version while keeping the active default (`mai-07.1.3-r3f-sealnew`) immutable.

R3N2 executed under this protocol with candidate `mai-07.1.7-r3n2-freshholdout` and consumed one holdout attempt.

## Decision

1. R3N2 **must** declare explicit invalidation lineage from `mai-07.1.6-r3n-policyconf` (pack hash `4bbd3e97c99bf769e58924fc6a8d8a7de943db63700d2bdabf02b31236dd0d8c`) and preserve R3N integrity closure semantic `fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae`.
2. Fresh holdout firewall: zero case-ID/text/family overlap with R3N holdout splits; honest vocabulary overlap declaration permitted.
3. Sealed pack content may differ from active parent **only** by identity-disposition policy file (`r3n2_fresh_holdout_policy.json` → `r3f_english_identity_guard.json` in pack). No lexicon additions.
4. Physical `LOCKED_NOT_RUN` required before holdout; one attempt only; no RC_002 after failure.
5. R3N2 Attempt 001 verdict is **`FAILED_HOLDOUT_QUALITY`** (identity_retention 148/150; identity_invariant_analogue 98/100). This is **not** `PASSED_CORRECTIVE_RC` or `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC`.
6. R3N2 must **not** be repaired in-place. Next governed phase: `MAI-07R3N3-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE`.

## Consequences

- Active runtime and overlay remain unchanged; `candidate_promoted=false`.
- `MAI-07=NEEDS_CORRECTIVE_WORK`; `MAI-08=NOT_STARTED`.
- Independent V3 review / freeze remains blocked until a valid fresh-holdout corrective RC passes all holdout gates.
- Governance tests in `test_mai07_r3n2_fresh_holdout.py` assert failure verdict and immutability without regenerating predictions.

## Related

- `docs/mokxya-ai/MAI_07_R3N2_FRESH_HOLDOUT_CORRECTIVE_REPORT.md`
- `docs/mokxya-ai/R3N2_FRESH_HOLDOUT_PROTOCOL.md`
- `docs/mokxya-ai/R3N2_MINIMUM_POPULATION_POLICY.md`
- `docs/mokxya-ai/MAI_07_R3N_INTEGRITY_CLOSURE_REPORT.md`
- `docs/mokxya-ai/decisions/ADR_0015_ISOLATED_CANDIDATE_CORRECTIVE_NON_PROMOTION.md`
