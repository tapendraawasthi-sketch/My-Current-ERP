# MAI-17 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-17.0.1-slice1`  
**Authority:** ADR_0034  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Annotation only |
| Hierarchy | domain → intent_family → OOD |
| Execution authority | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai17_slice1.py`
- `hierarchical_router_service` + ingress `ROUTING_*`
- `evals/mai17/manifests/MAI_17_SLICE1.manifest.json`
