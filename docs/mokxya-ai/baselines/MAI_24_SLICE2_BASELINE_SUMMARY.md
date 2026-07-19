# MAI-24 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-24.0.2-slice2`  
**Authority:** ADR_0041 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | `module_stages` → `build_prompt_grounding` → `enrich_nlu_context` |
| COMPLETE | filter by `allowed_retrieval_collections` |
| SKIP | `GOVERNANCE_SKIP` (no NP KB retrieval) |
| Evaluation corpus | never allowed / never joined |
| Annotation `documents_retrieved` | 0 |
| `is_execution_authority` | false |
| GAP-P2-008 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai24_slice2.py`
- `evals/mai24/manifests/MAI_24_SLICE2.manifest.json`
