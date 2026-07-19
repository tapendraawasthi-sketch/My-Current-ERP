# MAI-14 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-14.0.1-slice1`  
**Authority:** ADR_0031  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Turn relation | typed `TurnRelationV1` on request |
| Merge gating | **not yet** (slice 2) |
| Uses MAI-13 resolutions | yes (annotation signals) |
| `is_execution_authority` | always false |
| GAP-P1-004 / GAP-P1-008 | reduced signals; not closed |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai14_slice1.py`
- `erp_bot/src/oip/modules/conversation/application/turn_relation_service.py`
- `evals/mai14/manifests/MAI_14_SLICE1.manifest.json`
