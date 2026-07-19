# MAI-22 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-22.0.2-slice2`  
**Authority:** ADR_0039 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | ExecutionStageAdapter → apply_provider_cascade_to_route |
| Cascade overlay | primary + fallback before start_execution |
| Bundle `model_invocations` | 0 (runtime invokes separately) |
| `is_execution_authority` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai22_slice2.py`
- `evals/mai22/manifests/MAI_22_SLICE2.manifest.json`
