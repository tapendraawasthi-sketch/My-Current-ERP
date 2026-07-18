# MAI-07R3P-2 Frozen V3 One-Shot Report

**Date:** 2026-07-18  
**Phase:** `MAI-07R3P-2-AUTHORIZED-FROZEN-V3-ONE-SHOT`  
**Attempt:** `MAI_07R3P_FROZEN_V3_ATTEMPT_001`  
**Verdict:** `FAILED_QUALITY`

## Authorization

Explicit user authorization (`ok`) after R3P-1 dataset freeze.

## Candidate under test (not promoted)

| Field | Value |
|---|---|
| Runtime | `mai-07.1.11-r3n6-chaincomplete` |
| Content hash | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` |
| Active default after run | `mai-07.1.3-r3f-sealnew` (unchanged) |

## Dataset

| Field | Value |
|---|---|
| Dataset | `MAI_07_ROMANIZED_TRANSLITERATION_V3` |
| Hash | `6ad2a824a6fe0cb1248d7640692f8c45635b4290ee33647d5cbe4b82af2bdde8` |
| Pool scored | **FROZEN_EVALUATION only** — 583 cases |
| Gold policy | Option A preferred-surface match (including Latin) |

## Gate results

| Gate | Result |
|---|---|
| target top1 / recall@5 / MRR | **PASS** (1.0) |
| core recall@5 | **PASS** (1.0) |
| unambiguous top1 | **PASS** (1.0) |
| english identity top1 | **PASS** (1.0) |
| false Devanagari on English | **PASS** (0.0) |
| protected_mutations | **FAIL** (40 / 155; require 0) |
| raw_view_mutations | **PASS** |
| deterministic / caps | **PASS** |
| unresolved_review_accuracy | **NOT_APPLICABLE** |

## Flags after closeout

- `QUALITY_GATES_PASSED` = **false**
- `PRODUCTION_APPROVED` = **false**
- `candidate_promoted` = **false**
- `LINGUIST_APPROVED` = **true** (unchanged from R3O)
- MAI-08 = **NOT_STARTED**

## Artifacts

- `evals/mai07/r3p_frozen_v3/MAI_07R3P_FROZEN_V3_ATTEMPT_001.LOCKED_NOT_RUN.json`
- `evals/mai07/r3p_frozen_v3/MAI_07R3P_FROZEN_V3_ATTEMPT_001.EXECUTION_RESULT.json`
- `evals/mai07/r3p_frozen_v3/MAI_07R3P_FROZEN_V3_ATTEMPT_001.QUALITY_RESULT.json`
- `evals/mai07/r3p_frozen_v3/MAI_07R3P_FROZEN_V3_ATTEMPT_001.CLOSEOUT.json`
- `evals/mai07/r3p_frozen_v3/reports/MAI_07R3P_V3_CANONICAL_SCORE_REPORT.json`

## Governance

One-shot attempt is **consumed**. No automatic rerun. Any corrective work requires a new candidate identity + new authorized attempt (do not retune from this frozen V3 attempt in place).
