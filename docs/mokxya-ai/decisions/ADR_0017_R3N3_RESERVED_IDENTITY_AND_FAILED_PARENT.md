# ADR_0017 — R3N3 reserved identity finalizer and failed R3N2 parent lineage

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3N3-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE
- **Extends:** ADR_0016, MAI-07R3N2

## Context

R3N2 Attempt 001 failed `identity_retention` and `identity_invariant_analogue` under cap pressure (`FAILED_HOLDOUT_QUALITY`). Engineering analysis identified that the legacy finalizer could drop backfilled identity when reserving Devanagari. R3N3 must ship a new candidate version with reserved-identity finalization, a fresh holdout firewall (zero R3N/R3N2 holdout overlap), aggregate-only use of prior failure surfaces (no prediction JSONL reads), and physical lock-before-holdout with one attempt only.

## Decision

1. R3N3 candidate **`mai-07.1.8-r3n3-identityinv`** / policy **`mai-07-r3n3.1.0.0`** / pack hash **`1268527c5c5d99e036628dc104340dafe297afadf9938a310a099a38f825c0e7`** declares failed R3N2 parent lineage (`mai-07.1.7-r3n2-freshholdout`, consumed, not release evidence).
2. **`finalize_candidates_r3n3`** is authoritative for R3N3 only; active R3F finalize unchanged.
3. Dataset builder must record **`R3N3_AGGREGATE_ONLY_INPUT_PROOF.json`** with `prediction_jsonl_opened=false`.
4. Physical `LOCKED_NOT_RUN` (semantic **`0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b`**) required before holdout; one attempt only; no RC_002 after failure.
5. R3N3 Attempt 001 verdict is **`FAILED_HOLDOUT_QUALITY`**: identity_retention 288/300; exact_raw/exactly_one 288/300; identity_invariant 238/250; cap_pressure 238/250; finalizer_idempotence 1188/1200. English/romanized/acronym/identifier/protected/caps passed. Monotonic failed only finalizer_idempotence.
6. R3N3 must **not** be repaired in-place. Next governed phase: **`MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE`**.

## Consequences

- Active runtime and overlay remain unchanged; `candidate_promoted=false`.
- `MAI-07=NEEDS_CORRECTIVE_WORK`; `MAI-08=NOT_STARTED`.
- Residual exact-identity gaps under multi-token cap-pressure recorded as GAP-P2-029.
- Governance tests in `test_mai07_r3n3_fresh_holdout.py` assert failure verdict and immutability without regenerating predictions.

## Related

- `docs/mokxya-ai/MAI_07_R3N3_FRESH_HOLDOUT_IDENTITY_CORRECTIVE_REPORT.md`
- `docs/mokxya-ai/R3N3_IDENTITY_CANDIDATE_INVARIANT.md`
- `docs/mokxya-ai/R3N3_CANDIDATE_FINALIZATION_POLICY.md`
- `docs/mokxya-ai/decisions/ADR_0016_R3N2_INVALIDATED_PARENT_AND_FRESH_HOLDOUT.md`
