# MAI-38 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-38.0.1-slice1`  
**Authority:** ADR_0055  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Tax calculator / rule integration policy annotation |
| Rule integration | POLICY_ONLY |
| Calculation executed | false |
| Amount computed / rate applied | false |
| Rule table loaded | false |
| Production eligible | false |
| Legal effective dates proven | false |
| GAP-P2-008 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai38_slice1.py`
- `tax_calculator_rule_integration_service` + ingress stage
- `evals/mai38/manifests/MAI_38_SLICE1.manifest.json`
