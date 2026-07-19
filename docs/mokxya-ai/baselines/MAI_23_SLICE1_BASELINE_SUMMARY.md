# MAI-23 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-23.0.1-slice1`  
**Authority:** ADR_0040  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | PromptRegistry annotation from COMPLETE typed plan |
| Model invocations | none |
| `is_execution_authority` | false |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai23_slice1.py`
- `prompt_registry_service` + ingress stage
- `evals/mai23/manifests/MAI_23_SLICE1.manifest.json`
