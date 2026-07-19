# MAI-37 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-37.0.2-slice2`  
**Authority:** ADR_0054 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` tax-pilot candidate |
| Live rate lookup / tax calculator | not invoked (`allow_*=false`) |
| Rate table refs / computed amount | null |
| Specialist sign-off / gold | NOT_SIGNED / NOT_RELEASED |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai37_slice2.py`
- `core_nepal_tax_knowledge_pilot_consume_service.py`
- `evals/mai37/manifests/MAI_37_SLICE2.manifest.json`
