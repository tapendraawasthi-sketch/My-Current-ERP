# MAI-45 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-45.0.1-slice1`  
**Authority:** ADR_0062  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Analysis | COMPLETE → `POLICY_DECLARED` on perf cues |
| Pilot scope | `LOAD_LATENCY_FAILOVER_CANDIDATE_ONLY` |
| Pilot SLOs met / capacity proven | false |
| Safety bypass under timeout | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai45_slice1.py`
- `load_latency_failover_service.py`
- `evals/mai45/manifests/MAI_45_SLICE1.manifest.json`
