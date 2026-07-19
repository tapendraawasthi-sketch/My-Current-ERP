# MAI-40 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-40.0.1-slice1`  
**Authority:** ADR_0057  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Financial close / adjustment assistance policy annotation |
| Scope | FINANCIAL_CLOSE_ADJUSTMENT_ONLY |
| Adjustment | CANDIDATE_ASSISTANCE_ONLY |
| Close / adjustments posted | false |
| Books locked / period closed | false |
| Specialist sign-off | NOT_SIGNED |
| Legal effective dates proven | false |
| GAP-P2-008 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai40_slice1.py`
- `financial_close_adjustment_assistance_service` + ingress stage
- `evals/mai40/manifests/MAI_40_SLICE1.manifest.json`
