# ADR_0015 — Isolated candidate corrective is not promotion

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE
- **Extends:** ADR_0013, ADR_0014

## Context

R3M closure authorized a nine-case code-corrective queue against policy-conformance defects. Shipping those fixes into the default active runtime (`mai-07.1.3-r3f-sealnew`) would silently change production identity behavior, invalidate sealed resource hashes, and blur engineering holdout pass with linguist / quality / promotion gates.

R3N therefore needs a hard boundary: corrective code may land only behind an explicit, non-default candidate pack.

## Decision

1. R3N corrective ships **only** as an explicit non-default candidate (`mai-07.1.6-r3n-policyconf`, policy `mai-07-r3n.1.0.0`), activated via a dedicated candidate factory — never as the default pack.
2. Active parent `mai-07.1.3-r3f-sealnew` (resource content sha256 `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930`) remains **immutable** for this phase; promotion overlay stays disabled.
3. `PASSED_CORRECTIVE_RC` means engineering holdout qualification only. It does **not** imply pack promotion, linguist approval, product quality gates, production approval, frozen V2/V3 readiness, or MAI-08 start.
4. R3N must not perform resource lexicon / exact-target / spelling edits. Resource corrective queue stays empty (0); code lanes only.
5. Historical R3L / R3M / closure semantic hashes remain authority and are not rewritten by R3N.

## Consequences

- Evaluators and operators must pass an explicit candidate path to observe R3N behavior.
- Independent V3 review / freeze remains blocked until a valid non-frozen corrective RC exists.
- Governance flags stay: `QUALITY_GATES_PASSED=false`, `LINGUIST_APPROVED=false`, `PRODUCTION_APPROVED=false`, `candidate_promoted=false`, `MAI-07=NEEDS_CORRECTIVE_WORK`, `MAI-08=NOT_STARTED`.

## Integrity closeout note (MAI-07R3N-INTEGRITY-CLOSURE, 2026-07-18)

RC_002 Attempt 002 is **`INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`**. Post-Attempt-001 runtime coalescing, scorer empty-population requiredness (`INVALID_REQUIRED_POPULATION`→`NOT_APPLICABLE`), and a one-sentence holdout edit were applied, then the same case-ID/template-family/seed holdout was rerun under the same candidate version string `mai-07.1.6-r3n-policyconf`. Historical lock/attempt/prediction bytes are retained; append-only invalidation sidecar recorded. `PASSED_CORRECTIVE_RC` is withdrawn for release / frozen-V3 eligibility. Next governed phase: `MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE` (not executed in the integrity phase). See `MAI_07_R3N_INTEGRITY_CLOSURE_REPORT.md` and ADR hardening: locks must bind scorer/population/threshold hashes; required populations must never become `NOT_APPLICABLE` after observation; candidate semantic changes require a new version.

## Related

- `docs/mokxya-ai/MAI_07_R3N_NON_FROZEN_POLICY_CONFORMANCE_CORRECTIVE_REPORT.md`
- `docs/mokxya-ai/MAI_07_R3N_INTEGRITY_CLOSURE_REPORT.md`
- `docs/mokxya-ai/R3N_CORRECTIVE_POLICY.md`
- `docs/mokxya-ai/R3N_NON_FROZEN_EVALUATION_PROTOCOL.md`
- `docs/mokxya-ai/baselines/MAI_07R3N_BASELINE_SUMMARY.md`
