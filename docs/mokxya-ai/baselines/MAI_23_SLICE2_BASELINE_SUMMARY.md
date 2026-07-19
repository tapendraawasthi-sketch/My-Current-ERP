# MAI-23 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-23.0.2-slice2`  
**Authority:** ADR_0040 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume path | `HttpProviderAdapter._system_prompt` → `append_prompt_registry_to_system_prompt` |
| Forward path | `module_stages` → `policy_decisions.prompt_registry` → `ExecutionContextStage` |
| Bundle `model_invocations` | 0 |
| `is_execution_authority` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai23_slice2.py`
- `evals/mai23/manifests/MAI_23_SLICE2.manifest.json`
