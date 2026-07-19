# MAI-18 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-18.0.2-slice2`  
**Authority:** ADR_0035 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| EventFrame | skeleton only (missing fields) |
| Value extraction | none (MAI-19) |
| `authorizes_posting` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai18_slice2.py`
- `build_event_frame_skeleton` + `metadata.event_frame`
- `evals/mai18/manifests/MAI_18_SLICE2.manifest.json`
