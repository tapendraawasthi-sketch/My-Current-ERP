# MAI-34 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-34.0.1-slice1`  
**Authority:** ADR_0051  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Explicit confirm / OEC dispatch policy annotation |
| Confirm readiness | POLICY_DECLARED (when preview ready) |
| Confirm policy | EXPLICIT_UI_CONFIRM_REQUIRED |
| NL assent posts | false |
| Stale preview on confirm | REJECT |
| OEC dispatch readiness | POLICY_DECLARED (not product path) |
| Product mutation path | DEXIE_EXECUTE_ORBIX_CONFIRM |
| Token minted / OEC / ERP post | false |
| GAP-P0-001 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai34_slice1.py`
- `explicit_confirmation_oec_dispatch_service` + ingress stage
- `evals/mai34/manifests/MAI_34_SLICE1.manifest.json`
