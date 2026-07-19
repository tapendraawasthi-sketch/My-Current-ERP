# MAI-37 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-37.0.1-slice1`  
**Authority:** ADR_0054  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Core Nepal tax pilot scope annotation |
| Scope | INCOME_TAX_VAT_TDS_ONLY |
| Rate tables | CANDIDATE_REFS_ONLY |
| Gold questions | NOT_RELEASED |
| Specialist sign-off | NOT_SIGNED |
| Tax calculator | false |
| Legal effective dates proven | false |
| GAP-P2-008 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai37_slice1.py`
- `core_nepal_tax_knowledge_pilot_service` + ingress stage
- `evals/mai37/manifests/MAI_37_SLICE1.manifest.json`
