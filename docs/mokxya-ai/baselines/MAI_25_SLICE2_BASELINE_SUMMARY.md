# MAI-25 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-25.0.2-slice2`  
**Authority:** ADR_0042 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | segments → `ExtractionOcrPlanBundleV1` → `policy_decisions` |
| Text input | `SKIP_OCR` |
| Image cue | `OCR_CANDIDATE` plan only |
| `ocr_execution_authorized` | false |
| OCR / tool executions | 0 |
| `is_execution_authority` | false |
| GAP-P2-008 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai25_slice2.py`
- `evals/mai25/manifests/MAI_25_SLICE2.manifest.json`
