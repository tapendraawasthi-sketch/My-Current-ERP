# MAI-53 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-53.0.2-slice2`  
**Authority:** ADR_0070 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` compliance obligation / calendar candidate |
| Live arm automation / submit filing | not invoked (`allow_*=false`) |
| Obligation / deadline / calendar / reminder / tracking / alert plans | null |
| Automation armed / filing submitted | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai53_slice2.py`
- `compliance_obligation_calendar_consume_service.py`
- `evals/mai53/manifests/MAI_53_SLICE2.manifest.json`
