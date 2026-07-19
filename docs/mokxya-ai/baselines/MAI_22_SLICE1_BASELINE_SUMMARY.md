# MAI-22 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-22.0.1-slice1`  
**Authority:** ADR_0039  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | ProviderCascade annotation from COMPLETE typed plan |
| Model invocations | none |
| `is_execution_authority` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai22_slice1.py`
- `provider_cascade_service` + ingress stage
- `evals/mai22/manifests/MAI_22_SLICE1.manifest.json`
