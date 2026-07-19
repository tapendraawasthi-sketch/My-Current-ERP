# MAI-28 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-28.0.1-slice1`  
**Authority:** ADR_0045  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Vector index readiness annotation from COMPLETE governance |
| Vector backend | CHROMA_OLLAMA |
| Ollama required | true |
| Production eligible | false |
| Embed / query executions | 0 |
| Citations verified | false |
| `is_execution_authority` | false |
| GAP-P2-001 / GAP-P2-008 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai28_slice1.py`
- `vector_index_service` + ingress stage
- `evals/mai28/manifests/MAI_28_SLICE1.manifest.json`
