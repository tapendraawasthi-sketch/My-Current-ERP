# MAI-13 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-13.0.1-slice1`  
**Authority:** ADR_0030  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Object references | candidate-only (`ObjectReferenceBundleV1`) |
| Sources | `conversation_id`, `active_draft_reference`, UI context keys |
| Draft merge / post | **never** |
| `silent_applications` / `draft_mutations` | always 0 |
| GAP-P1-004 / GAP-P1-008 | not closed (MAI-14) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai13_slice1.py`
- `erp_bot/src/oip/modules/conversation/application/object_reference_service.py`
- `evals/mai13/manifests/MAI_13_SLICE1.manifest.json`
- `docs/mokxya-ai/MAI_13_CONVERSATION_AND_OBJECT_REFERENCE_STORE.md`
