# MAI-14 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-14.0.2-slice2`  
**Authority:** ADR_0031 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Merge gate | `allows_pending_merge` before classify / `start_or_merge_*` |
| Clears pending on | `NEW_TOPIC`, `UNKNOWN`, `CONFIRMATION_INTENT`, `CANCEL_*`, `FAILED` |
| Allows pending on | `CONTINUE_*`, `ANSWER_CLARIFICATION`, `CORRECT_ACTIVE_DRAFT` |
| Legacy `turn_relation=None` | unchanged (compat) |
| GAP-P1-004 / GAP-P1-008 | **REDUCED** (not closed) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai14_slice2.py`
- `erp_bot/src/oip/integration/mode_aware_erp.py`
- `evals/mai14/manifests/MAI_14_SLICE2.manifest.json`
