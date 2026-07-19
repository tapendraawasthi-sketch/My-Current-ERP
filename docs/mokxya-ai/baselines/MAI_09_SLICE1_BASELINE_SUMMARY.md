# MAI-09 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-09.0.1-slice1`  
**Authority:** ADR_0026  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| MAI-09 status | `IN_PROGRESS` |
| `5 maina ko` | **duration** (not amount) |
| `invoice 9001 … 400` | 9001=`invoice_number`, 400=`amount` |
| Bare uncued digits | **unknown** (not amount) |
| Live ingress | NUMBER_ROLES after MAI-08 |
| MAI-08 | **PASSED_ENGINEERING** |
| MAI-10 | NOT_STARTED |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai09_slice1.py`
- `src/__tests__/orbix/mai09EntityExtractorDuration.test.ts`
- `evals/mai09/manifests/MAI_09_SLICE1.manifest.json`
