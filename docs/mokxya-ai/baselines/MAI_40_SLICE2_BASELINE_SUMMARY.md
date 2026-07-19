# MAI-40 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-40.0.2-slice2`  
**Authority:** ADR_0057 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` close-assist candidate |
| Live close / adjustment post | not invoked (`allow_*=false`) |
| Checklist refs / adjustment drafts | null |
| Books locked / period closed | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai40_slice2.py`
- `financial_close_adjustment_assistance_consume_service.py`
- `evals/mai40/manifests/MAI_40_SLICE2.manifest.json`
