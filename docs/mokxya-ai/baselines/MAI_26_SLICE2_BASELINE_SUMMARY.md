# MAI-26 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-26.0.2-slice2`  
**Authority:** ADR_0043 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | `resolve_retrieval_as_of` → `KnowledgeStageAdapter.retrieve` |
| as_of | candidate hint only; end-of-day UTC normalize |
| Amendment | `CUES_ONLY`; never applied |
| Legal effective dates proven | false |
| `is_execution_authority` | false |
| GAP-P2-008 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai26_slice2.py`
- `evals/mai26/manifests/MAI_26_SLICE2.manifest.json`
