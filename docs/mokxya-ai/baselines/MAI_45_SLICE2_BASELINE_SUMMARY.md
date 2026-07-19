# MAI-45 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-45.0.2-slice2`  
**Authority:** ADR_0062 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` load/latency/failover candidate |
| Live load test / SLO claim | not invoked (`allow_*=false`) |
| Stage profiles / benchmarks / capacity plan | null |
| Pilot SLOs met / safety bypass under timeout | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai45_slice2.py`
- `load_latency_failover_consume_service.py`
- `evals/mai45/manifests/MAI_45_SLICE2.manifest.json`
