# ADR_0014 — Diagnostic mismatch versus actionable defect

- **Status:** Accepted (2026-07-17)
- **Phase:** MAI-07R3M-AI-ASSISTED-POLICY-MISMATCH-TRIAGE
- **Extends:** ADR_0012, ADR_0013

## Context

R3L residual queues mix (a) actual policy-conformance failures, (b) span/data failures, and (c) risk-only passes retained for heuristic/ambiguity/confidence. Treating all 829 residuals as actionable defects would overstate runtime fault and understate evidence limits.

Separately, R3L `CRITICAL_DIAGNOSTIC_FINDING` tracks **safety invariants**, while `TIER_1_CRITICAL` tracks **policy-conformance criticals**.

## Decision

1. Every residual gets exactly one primary observation class, root-cause stage, and action disposition.
2. Risk-only PASS cases are `NO_CORRECTIVE_ACTION_RISK_ONLY` and are not runtime defects.
3. Safety-critical vs policy-critical fields are explicit and separate; R3L history is not rewritten.
4. HEURISTIC_V1 cannot authorize lexicon/target/resource production edits.
5. No exact Devanagari targets may be invented for triage or corrective candidacy.
6. Maximum verdict: `PASSED_ENGINEERING_TRIAGE` — not quality/linguist/production approval.

## Consequences

- Corrective work may proceed only from supported code/test queues under a later authorized phase.
- Independent human/linguist gaps remain open (GAP-P1-016 / GAP-P1-012).

## Closure note (MAI-07R3M-CLOSURE, 2026-07-18)

Tier-1 reason aggregates in the original R3M report mixed **occurrence counts** with unique-case language. Classification: **REPORT_ONLY**. Machine memberships and queues were already correct. Primary partition of the eight Tier-1 cases is FALSE_FORCED_DEVANAGARI_TOP1×5 + ABSTAIN_FORCE_TRANSLITERATED×3. R3M semantic hash `bd9a9608…002b09` preserved. See `MAI_07_R3M_TIER1_AND_CORRECTIVE_AUTHORITY_CLOSURE_REPORT.md`. Future reason tables must declare `unique_case_count` / `primary_reason_case_count` / `secondary_reason_occurrence_count` / `overlap_count` / `union_case_count`.

## Related

- `docs/mokxya-ai/MAI_07_R3M_AI_ASSISTED_POLICY_MISMATCH_TRIAGE_REPORT.md`
- `docs/mokxya-ai/MAI_07_R3M_TIER1_AND_CORRECTIVE_AUTHORITY_CLOSURE_REPORT.md`
- `docs/mokxya-ai/R3M_CORRECTIVE_ELIGIBILITY_POLICY.md`
