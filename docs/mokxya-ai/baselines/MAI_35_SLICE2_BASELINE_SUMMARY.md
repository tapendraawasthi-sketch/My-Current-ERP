# MAI-35 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-35.0.2-slice2`  
**Authority:** ADR_0052 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` offline/sync candidate |
| Live sync / queue / resolve / reverse | not invoked (`allow_*=false`) |
| Sync / conflict / reversal envelopes | null |
| Queued labeled synced | false |
| GAP-P1-002 / GAP-P0-001 | remain OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai35_slice2.py`
- `offline_sync_conflict_reversal_consume_service.py`
- `evals/mai35/manifests/MAI_35_SLICE2.manifest.json`
