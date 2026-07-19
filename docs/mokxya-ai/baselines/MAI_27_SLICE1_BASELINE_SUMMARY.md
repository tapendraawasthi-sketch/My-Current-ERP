# MAI-27 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-27.0.1-slice1`  
**Authority:** ADR_0044  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Lexical index readiness annotation from COMPLETE governance |
| Lexical backend | SQLITE_FTS |
| Ollama required | false |
| Vector backend required | false |
| Citations verified | false |
| Query executions | 0 |
| `is_execution_authority` | false |
| GAP-P2-001 / GAP-P2-008 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai27_slice1.py`
- `lexical_index_service` + ingress stage
- `evals/mai27/manifests/MAI_27_SLICE1.manifest.json`
