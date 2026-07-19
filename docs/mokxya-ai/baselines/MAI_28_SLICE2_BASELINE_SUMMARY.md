# MAI-28 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-28.0.2-slice2`  
**Authority:** ADR_0045 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default mode | `LEXICAL_AUTHORITATIVE` (semantic forced off) |
| Optional mode | `LEXICAL_PLUS_NON_PROD_SEMANTIC` (dual env flags) |
| Production eligible | false |
| Lexical authoritative | true |
| Citations verified | false |
| GAP-P2-001 / GAP-P2-008 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai28_slice2.py`
- `evals/mai28/manifests/MAI_28_SLICE2.manifest.json`
