# MAI-38 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-38.0.2-slice2`  
**Authority:** ADR_0055 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` calculator/rule candidate |
| Live rule-table load / calculation | not invoked (`allow_*=false`) |
| Rule table refs / computed amount | null |
| Production eligible | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai38_slice2.py`
- `tax_calculator_rule_integration_consume_service.py`
- `evals/mai38/manifests/MAI_38_SLICE2.manifest.json`
