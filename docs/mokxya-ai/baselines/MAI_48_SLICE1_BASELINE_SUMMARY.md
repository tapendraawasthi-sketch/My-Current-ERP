# MAI-48 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-48.0.1-slice1`  
**Authority:** ADR_0065  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Cue → COMPLETE | `POLICY_DECLARED` (or `SCOPE_PARTIAL`) |
| Pilot scope | `GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY` |
| Improvement applied / fine-tuning executed | false |
| Production model swapped | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai48_slice1.py`
- `governed_improvement_fine_tuning_service.py`
- `evals/mai48/manifests/MAI_48_SLICE1.manifest.json`
