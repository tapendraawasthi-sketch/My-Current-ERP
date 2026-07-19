# MAI-46 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-46.0.2-slice2`  
**Authority:** ADR_0063 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` backup/restore/DR/lifecycle candidate |
| Live DR drill / purge apply | not invoked (`allow_*=false`) |
| Backup/restore/DR/retention/purge plans | null |
| DR proven / silent purge | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai46_slice2.py`
- `backup_restore_disaster_lifecycle_consume_service.py`
- `evals/mai46/manifests/MAI_46_SLICE2.manifest.json`
