# MAI-41 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-41.0.2-slice2`  
**Authority:** ADR_0058 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` domain-release candidate |
| Live domain release / production eligible | not invoked (`allow_*=false`) |
| Domain refs / release package | null |
| Release / gold | NOT_RELEASED |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai41_slice2.py`
- `broader_nepal_business_law_domain_release_consume_service.py`
- `evals/mai41/manifests/MAI_41_SLICE2.manifest.json`
