# MAI-52 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-52.0.2-slice2`  
**Authority:** ADR_0069 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` CA-firm engagement / workpaper candidate |
| Live open engagement / post workpaper | not invoked (`allow_*=false`) |
| Engagement / letter / workspace / review / binder / staff / notes plans | null |
| Engagement opened / workpaper posted | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai52_slice2.py`
- `ca_firm_engagement_workpaper_consume_service.py`
- `evals/mai52/manifests/MAI_52_SLICE2.manifest.json`
