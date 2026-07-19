# MAI-13 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-13.0.2-slice2`  
**Authority:** ADR_0030 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Store resolution | read-only (`ObjectReferenceResolutionV1`) |
| Draft stores | JSON peek across 6 khata store files |
| Conversation | sync RO peek of `oip_conversations` |
| Merge / post / writers | **never** |
| GAP-P1-004 / GAP-P1-008 | not closed (MAI-14) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai13_slice2.py`
- `erp_bot/src/oip/modules/conversation/application/object_reference_resolution_service.py`
- `evals/mai13/manifests/MAI_13_SLICE2.manifest.json`
