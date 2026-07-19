# MAI-11 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-11.0.2-slice2`  
**Authority:** ADR_0028  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Prompt directive | **wired** into provider system prompt |
| Canonical metadata | `response_register` emitted |
| Orchestrator forward | `policy_decisions.response_register` |
| SSE / model rewrite | **false** (`applied_response_rewrite=false`) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai11_slice2.py`
- `evals/mai11/frozen/response_register_prompt_v1.jsonl`
- `prompt_directive.py` + `HttpProviderAdapter._system_prompt`
