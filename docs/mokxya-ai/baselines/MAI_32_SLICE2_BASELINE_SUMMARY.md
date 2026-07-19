# MAI-32 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-32.0.2-slice2`  
**Authority:** ADR_0049 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` DraftAggregate candidate |
| Live `save_*` | not invoked (`allow_durable_write=false`) |
| Aggregate written | false |
| Production store authority | false |
| Incomplete / pending | `BLOCKED` |
| GAP-P0-001 | unchanged (no new writer) |
| CR-32-01 / CR-32-02 | respected (no khata/Dexie edits) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai32_slice2.py`
- `durable_versioned_draft_consume_service.py`
- `evals/mai32/manifests/MAI_32_SLICE2.manifest.json`
