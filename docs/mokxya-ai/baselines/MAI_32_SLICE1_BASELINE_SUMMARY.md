# MAI-32 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-32.0.1-slice1`  
**Authority:** ADR_0049  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Durability / version policy + store readiness annotation |
| Version policy | MONOTONIC_INT_BUMP |
| Concurrency | OPTIMISTIC_EXPECTED_VERSION |
| Durability | EPHEMERAL_LOCAL_JSON (not production authority) |
| Draft aggregate ready | false |
| Save / load / start_or_merge | false |
| Draft mutations | 0 |
| GAP-P0-001 | unchanged |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai32_slice1.py`
- `durable_versioned_draft_service` + ingress stage
- `evals/mai32/manifests/MAI_32_SLICE1.manifest.json`
