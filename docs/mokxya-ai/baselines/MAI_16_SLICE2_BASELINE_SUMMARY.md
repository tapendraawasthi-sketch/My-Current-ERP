# MAI-16 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-16.0.2-slice2`  
**Authority:** ADR_0033 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Provider consume | `policy_decisions` + DATA-ONLY system prompt |
| RO recall | optional; soft-fail; `memory_writes=0` |
| Memory content writes | gated SKIP when `write_allowed=false` |
| Draft mutations | none |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai16_slice2.py`
- `ExecutionStageAdapter` + `HttpProviderAdapter._system_prompt`
- `evals/mai16/manifests/MAI_16_SLICE2.manifest.json`
