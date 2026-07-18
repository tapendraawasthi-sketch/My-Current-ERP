# MAI-07R3H Baseline Summary

- Phase: `MAI-07R3H-ENGLISH-IDENTITY-CORRECTIVE`
- Verdict: `FAILED_HOLDOUT_QUALITY`
- Frozen V2 opened: **no**
- MAI-08 touched: **no**

## Pre-edit baseline

- `language_runtime`: 370 passed, 6 skipped, 0 failed
- Historical skips unchanged:
  - `HISTORICAL_R2_OVERLAY_EXPECTATION` for `english kar module`
  - 3 superseded R1 overlay/ranker expectations
  - 2 historical R2 overlay expectations

## Post-edit baseline

- `language_runtime`: 381 passed, 6 skipped, 0 failed
- Delta: +11 passing R3H focused tests, historical skips unchanged

## R3H holdout summary

Authoritative HOLDOUT_VALIDATION (qualification/chain):

- English identity top-1: **356/356 PASS**
- False Devanagari on clear English: **0/356 PASS**
- Clear Romanized top-1 / recall@5: **229/229 / 229/229 PASS**
- Unresolved shared identity-review: **0/19 FAIL**
- Target missing-from-top5: **43/229 FAIL**
- Counterfactual pairs (CONTEXT_COUNTERFACTUAL): **0/29 FAIL**
- Protected/raw mutation gates: PASS

RC status: locked then **rejected** (`FAILED_HOLDOUT_QUALITY`). Not a passed corrective RC.

## Locked artifacts

- Dataset manifest: `evals/mai07_r3h_english_identity/MAI_07R3H_DATASET_MANIFEST.json`
- Thresholds: `evals/mai07_r3h_english_identity/MAI_07R3H_THRESHOLDS.json`
- RC lock: `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json`
- Chain: `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json`
