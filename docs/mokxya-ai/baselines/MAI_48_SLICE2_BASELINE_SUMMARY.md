# MAI-48 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-48.0.2-slice2`  
**Authority:** ADR_0065 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` governed improvement / fine-tuning candidate |
| Live fine-tune / model swap | not invoked (`allow_*=false`) |
| Improvement / fine-tune / eval / swap plans | null |
| Improvement applied / fine-tuning executed | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai48_slice2.py`
- `governed_improvement_fine_tuning_consume_service.py`
- `evals/mai48/manifests/MAI_48_SLICE2.manifest.json`
