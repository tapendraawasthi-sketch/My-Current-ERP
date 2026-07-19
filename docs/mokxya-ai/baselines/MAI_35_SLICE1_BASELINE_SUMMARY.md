# MAI-35 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-35.0.1-slice1`  
**Authority:** ADR_0052  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Offline / sync / conflict / reversal policy annotation |
| Sync policy readiness | POLICY_DECLARED (when confirm ready) |
| Conflict policy | REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT |
| Reversal policy | GOVERNED_CORRECTION_ONLY |
| Queued labeled synced | forbidden (flag true) |
| Sync workers / queue / resolve | false |
| Dual sync / GAP-P1-002 | OPEN |
| GAP-P0-001 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai35_slice1.py`
- `offline_sync_conflict_reversal_service` + ingress stage
- `evals/mai35/manifests/MAI_35_SLICE1.manifest.json`
