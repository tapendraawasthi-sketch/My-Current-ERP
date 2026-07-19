# MAI-20 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-20.0.2-slice2`  
**Authority:** ADR_0037 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | mode_aware gate |
| ASK → user question | yes; skip_llm |
| Draft mutations on ASK | none |
| `is_execution_authority` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai20_slice2.py`
- `evals/mai20/manifests/MAI_20_SLICE2.manifest.json`
