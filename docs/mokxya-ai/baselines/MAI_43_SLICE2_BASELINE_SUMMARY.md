# MAI-43 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-43.0.2-slice2`  
**Authority:** ADR_0060 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` continuous-change candidate |
| Live change apply / cache invalidate | not invoked (`allow_*=false`) |
| Change refs / impact / queue / rollback | null |
| Unreviewed as production truth | false |
| Legal effective dates proven | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai43_slice2.py`
- `continuous_change_intelligence_consume_service.py`
- `evals/mai43/manifests/MAI_43_SLICE2.manifest.json`
