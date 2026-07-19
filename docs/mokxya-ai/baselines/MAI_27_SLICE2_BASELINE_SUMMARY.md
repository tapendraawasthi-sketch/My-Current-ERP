# MAI-27 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-27.0.2-slice2`  
**Authority:** ADR_0044 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | `should_prefer_lexical_retrieval` → NP KB / grounding |
| Retrieval mode | `LEXICAL_ONLY` when COMPLETE + `fts_ready` |
| Semantic / Ollama | forced off when preferred |
| Not ready | `LEXICAL_INDEX_NOT_READY` (fail-closed) |
| Citations verified | false |
| `is_execution_authority` | false |
| GAP-P2-001 / GAP-P2-008 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai27_slice2.py`
- `evals/mai27/manifests/MAI_27_SLICE2.manifest.json`
