# MAI-18 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-18.0.1-slice1`  
**Authority:** ADR_0035  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Annotation only |
| EventFrame fill | none |
| Execution authority | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai18_slice1.py`
- `event_spec_registry_service` + ingress `EVENT_SPEC_REGISTRY_*`
- `evals/mai18/manifests/MAI_18_SLICE1.manifest.json`
