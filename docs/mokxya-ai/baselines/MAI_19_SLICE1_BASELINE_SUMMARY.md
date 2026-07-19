# MAI-19 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-19.0.1-slice1`  
**Authority:** ADR_0036  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Deterministic extraction into EventFrame |
| Draft mutations | none |
| `authorizes_posting` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai19_slice1.py`
- `event_frame_extraction_service` + ingress stage
- `evals/mai19/manifests/MAI_19_SLICE1.manifest.json`
