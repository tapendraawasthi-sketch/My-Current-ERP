# MAI-15 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-15.0.2-slice2`  
**Authority:** ADR_0032 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Amount apply | `CORRECT_ACTIVE_DRAFT` + parseable AMOUNT only |
| Receipt | `AppliedCorrectionReceipt` after save |
| Candidate `applied` | remains false |
| CONFIRMATION | never apply / never post |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai15_slice2.py`
- `select_amount_correction_overlay` + mode_aware field_overrides
- `evals/mai15/manifests/MAI_15_SLICE2.manifest.json`
