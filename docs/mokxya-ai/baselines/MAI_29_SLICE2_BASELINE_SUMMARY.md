# MAI-29 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-29.0.2-slice2`  
**Authority:** ADR_0046 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `LEXICAL_ONLY` evidence candidates |
| Optional consume | `RRF_APPLIED` when RRF_CANDIDATE + non-prod allow |
| Annotation fusion_executed | false |
| Rerank authorized | false |
| Claims / citations verified | false |
| Hybrid production eligible | false |
| GAP-P2-001 / GAP-P2-008 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai29_slice2.py`
- `evals/mai29/manifests/MAI_29_SLICE2.manifest.json`
