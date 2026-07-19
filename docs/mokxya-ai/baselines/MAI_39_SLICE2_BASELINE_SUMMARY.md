# MAI-39 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-39.0.2-slice2`  
**Authority:** ADR_0056 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` NFRS/NAS candidate |
| Live mapping / disclosure file | not invoked (`allow_*=false`) |
| Mapping refs / disclosure draft | null |
| Specialist sign-off | NOT_SIGNED |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai39_slice2.py`
- `nfrs_nas_policy_disclosure_pilot_consume_service.py`
- `evals/mai39/manifests/MAI_39_SLICE2.manifest.json`
