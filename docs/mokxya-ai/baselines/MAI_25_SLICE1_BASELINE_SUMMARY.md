# MAI-25 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-25.0.1-slice1`  
**Authority:** ADR_0042  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | StructuralSegmentation annotation from COMPLETE governance |
| OCR invocations | none |
| `ocr_recommended` | false |
| `is_execution_authority` | false |
| GAP-P2-008 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai25_slice1.py`
- `structural_segmentation_service` + ingress stage
- `evals/mai25/manifests/MAI_25_SLICE1.manifest.json`
