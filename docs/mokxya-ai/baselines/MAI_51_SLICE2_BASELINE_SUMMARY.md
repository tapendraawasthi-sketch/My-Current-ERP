# MAI-51 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-51.0.2-slice2`  
**Authority:** ADR_0068 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` private user-document intelligence candidate |
| Live ingest / QA | not invoked (`allow_*=false`) |
| Upload / ingest / index / QA / summary / extraction / retention / access plans | null |
| Document ingested / QA live / isolation proven | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai51_slice2.py`
- `private_user_document_intelligence_consume_service.py`
- `evals/mai51/manifests/MAI_51_SLICE2.manifest.json`
