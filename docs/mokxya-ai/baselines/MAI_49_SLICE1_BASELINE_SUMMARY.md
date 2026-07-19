# MAI-49 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-49.0.1-slice1`  
**Authority:** ADR_0066  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Cue → COMPLETE | `POLICY_DECLARED` (or `SCOPE_PARTIAL`) |
| Pilot scope | `PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY` |
| `production_approved` | false |
| Capability released / cutover authorized | false |
| GAP-P2-008 | remains OPEN |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai49_slice1.py`
- `production_capability_release_service.py`
- `evals/mai49/manifests/MAI_49_SLICE1.manifest.json`
