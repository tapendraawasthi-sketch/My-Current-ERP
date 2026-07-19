# MAI-49 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-49.0.2-slice2`  
**Authority:** ADR_0066 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` production capability release candidate |
| Live cutover / traffic | not invoked (`allow_*=false`) |
| Checklist / risk / signoff / cutover / rollback / gate plans | null |
| Production approved / cutover authorized / traffic enabled | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai49_slice2.py`
- `production_capability_release_consume_service.py`
- `evals/mai49/manifests/MAI_49_SLICE2.manifest.json`
