# MAI-15 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-15.0.1-slice1`  
**Authority:** ADR_0032  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Bundle | `ReferenceCoreferenceBundleV1` (annotation only) |
| Corrections applied | **never** |
| Slot fill / NLU consume | slice 2 |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai15_slice1.py`
- `erp_bot/src/oip/modules/conversation/application/reference_coreference_service.py`
- `evals/mai15/manifests/MAI_15_SLICE1.manifest.json`
