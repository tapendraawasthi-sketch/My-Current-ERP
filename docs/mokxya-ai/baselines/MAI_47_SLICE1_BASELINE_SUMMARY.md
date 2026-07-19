# MAI-47 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-47.0.1-slice1`  
**Authority:** ADR_0064  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Cue → COMPLETE | `POLICY_DECLARED` (or `SCOPE_PARTIAL`) |
| Pilot scope | `HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY` |
| Human review complete / pilot approved | false |
| Production pilot / go-live authorized | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai47_slice1.py`
- `human_review_pilot_operations_service.py`
- `evals/mai47/manifests/MAI_47_SLICE1.manifest.json`
