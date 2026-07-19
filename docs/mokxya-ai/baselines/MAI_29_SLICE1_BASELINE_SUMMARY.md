# MAI-29 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-29.0.1-slice1`  
**Authority:** ADR_0046  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Hybrid fusion policy annotation |
| Fusion executed | false |
| Rerank authorized | false |
| Evidence assembled | false |
| Hybrid production eligible | false |
| Claims / citations verified | false |
| Lexical authoritative | true |
| GAP-P2-001 / GAP-P2-008 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai29_slice1.py`
- `hybrid_fusion_service` + ingress stage
- `evals/mai29/manifests/MAI_29_SLICE1.manifest.json`
