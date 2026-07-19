# MAI-34 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-34.0.2-slice2`  
**Authority:** ADR_0051 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` confirm/OEC candidate |
| Live token mint / Dexie / OEC | not invoked (`allow_*=false`) |
| Confirm token | null / NOT_ISSUED |
| OEC envelope | null |
| ERP / Dexie post | false |
| GAP-P0-001 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai34_slice2.py`
- `explicit_confirmation_oec_dispatch_consume_service.py`
- `evals/mai34/manifests/MAI_34_SLICE2.manifest.json`
