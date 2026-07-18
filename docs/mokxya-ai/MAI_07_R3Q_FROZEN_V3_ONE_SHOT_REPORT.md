# MAI-07R3Q Frozen V3 One-Shot Report

**Date:** 2026-07-18  
**Phase:** `MAI-07R3Q-PROTECTED-SPAN-ALIGNMENT-FROZEN-V3-ONE-SHOT`  
**Attempt:** `MAI_07R3Q_FROZEN_V3_ATTEMPT_001`  
**Verdict:** `PASSED_QUALITY`

## Authorization

Explicit user authorization (`go`) after R3P-2 `FAILED_QUALITY` on `protected_mutations`.

## Root cause (R3P-2)

The 40 `protected_mutations` failures were **false positives from span extract fallback**, not true mutations:

| Pattern | Count | What happened |
|---|---|---|
| Split EMAIL/URL/PAN (`…-R0xx`) | 13 | Gold span split across tokens; extract fell back to first word (`Do`) |
| Bracketed unicode challenges (`[café]`) | 27 | Gold inner surface nested in `[…]`; extract fell back to first word (`alignment`) |

Overlapping identity spans already preserved the highlighted characters. R3Q scores the **highlighted character range** (identity slice), not the first token.

## Candidate under test (not promoted)

| Field | Value |
|---|---|
| Runtime | `mai-07.1.12-r3q-protspan` |
| Pack bytes | Reuses R3N6 (`8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106`) |
| Correction scope | `PROTECTED_SPAN_HIGHLIGHT_ALIGNMENT` |
| Active default after run | `mai-07.1.3-r3f-sealnew` (unchanged) |

## Dataset

| Field | Value |
|---|---|
| Dataset | `MAI_07_ROMANIZED_TRANSLITERATION_V3` |
| Hash | `6ad2a824a6fe0cb1248d7640692f8c45635b4290ee33647d5cbe4b82af2bdde8` |
| Pool scored | **FROZEN_EVALUATION only** — 583 cases |
| Gold policy | Option A preferred-surface match (including Latin) |

## Gate results

All applicable gates **PASS** (including `protected_mutations` = 0 / 155).

## Flags after closeout

- `QUALITY_GATES_PASSED` = **true** (attempt / V3 release candidate)
- `PRODUCTION_APPROVED` = **false**
- `candidate_promoted` = **false**
- `LINGUIST_APPROVED` = **true** (unchanged)
- MAI-08 = **NOT_STARTED**
- Active runtime = **unchanged** (`mai-07.1.3-r3f-sealnew`)

## Artifacts

- `evals/mai07/r3q_frozen_v3/MAI_07R3Q_FROZEN_V3_ATTEMPT_001.*`
- `evals/mai07/r3q_frozen_v3/reports/MAI_07R3Q_V3_CANONICAL_SCORE_REPORT.json`
- `erp_bot/.../application/r3q_protected_span_align.py`
- `erp_bot/.../application/mai07_r3q_candidate_runtime.py`
- `erp_bot/.../application/eval_mai07_r3q_frozen_v3.py`

## Governance

One-shot attempt is **consumed**. Candidate is **not** promoted. Production approval and runtime promotion require separate explicit authorization.
