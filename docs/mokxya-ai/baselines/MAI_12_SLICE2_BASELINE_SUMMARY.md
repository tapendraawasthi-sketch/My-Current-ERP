# MAI-12 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-12.0.2-slice2`  
**Authority:** ADR_0029  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Rebuild assessment | wired (`KbRebuildabilityReportV1`) |
| Recipe | discover → parse → `build_retrieval_indexes` |
| This checkout (typical) | `FULL_REBUILD_READY` when zips present |
| Auto-rebuild on chat | **no** |
| GAP-P2-005 | REDUCED (not closed) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai12_slice2.py`
- `docs/mokxya-ai/MAI_12_KB_SOURCE_TO_INDEX_REBUILD_PATH.md`
- `rebuildability_service.py`
