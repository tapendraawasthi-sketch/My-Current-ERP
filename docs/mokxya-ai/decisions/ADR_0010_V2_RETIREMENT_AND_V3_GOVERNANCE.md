# ADR_0010 — Retire V2 from model selection; authorize independent V3 review

- **Status:** Accepted (2026-07-16)
- **Phase:** MAI-07R3J-A-INDEPENDENT-V3-GOVERNANCE-AND-REVIEW-PACKET
- **Deciders:** Product engineering governance (implementation packet); human professional review pending

## Context

Frozen V2 has been used for multiple authorized one-shot evaluations (R3C baseline, R3E, blocked R3G attempts, R3G-REAUTHORIZED-002, R3I). Aggregate metrics and failure modes are now extensively exposed. R3I of sealed R3H2 returned `FAILED_QUALITY` (TOP1/UNAMBIGUOUS/ENGLISH/FALSE_DEV/PROTECTED). Further candidate selection on V2 would enable implicit overfitting to a repeatedly observed benchmark.

## Decision

Mark MAI-07 V2 as:

**`HISTORICAL_BENCHMARK_EXHAUSTED_FOR_MODEL_SELECTION`**

Meaning:

1. V2 artifacts remain immutable historical evidence.
2. V2 must not be used for another candidate-selection / release-gate run.
3. V2 per-case failures, inputs, candidates, and acceptable-target sets must not be mined for corrective development.
4. Historical aggregate metrics may still be cited.
5. No V2 threshold, label, or population may be changed.
6. V2 must not be deleted or falsely called invalid.
7. Next quality gate requires an independently sourced, blindly reviewed, professionally adjudicated **V3** benchmark.

## Consequences

- R3J-A produces a review packet only (`REVIEW_PACKET_READY` / `BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW`).
- No runtime/resource changes in R3J-A.
- No MAI-08 work.
- `QUALITY_GATES_PASSED`, `LINGUIST_APPROVED`, and `PRODUCTION_APPROVED` remain false until later governed phases with real human evidence.
- Next phase: `MAI-07R3J-B-ADJUDICATION-AND-V3-FREEZE` after Round A/B/adjudication evidence exists.

## Related

- ADR_0008 / ADR_0009
- `docs/mokxya-ai/reviews/mai07_v3/`
- R3I report: `MAI_07_R3I_FROZEN_REAUTHORIZED_REPORT.md`
