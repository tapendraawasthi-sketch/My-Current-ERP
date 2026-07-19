# MAI-47 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-47.0.2-slice2`  
**Authority:** ADR_0064 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` human review / pilot ops candidate |
| Live reviewer sign-off / go-live | not invoked (`allow_*=false`) |
| Review / pilot / gold / runbook / go-live packets | null |
| Human review complete / go-live authorized | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai47_slice2.py`
- `human_review_pilot_operations_consume_service.py`
- `evals/mai47/manifests/MAI_47_SLICE2.manifest.json`
