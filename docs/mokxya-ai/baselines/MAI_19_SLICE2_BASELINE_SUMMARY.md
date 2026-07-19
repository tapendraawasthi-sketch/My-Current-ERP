# MAI-19 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-19.0.2-slice2`  
**Authority:** ADR_0036 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Optional fields | payment_mode / item / date |
| Qty ambiguity | UnknownNumberFieldValueV1 |
| Silent money from qty | forbidden |
| `authorizes_posting` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai19_slice2.py`
- `evals/mai19/manifests/MAI_19_SLICE2.manifest.json`
