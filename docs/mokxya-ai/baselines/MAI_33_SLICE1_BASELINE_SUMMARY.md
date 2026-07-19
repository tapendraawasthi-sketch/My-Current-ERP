# MAI-33 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-33.0.1-slice1`  
**Authority:** ADR_0050  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Preview / edit-loop policy annotation |
| Preview readiness | POLICY_DECLARED (when durable ready) |
| Edit loop | INVALIDATE_PREVIEW_ON_EDIT |
| Stale preview on confirm | REJECT (policy; not enforced yet) |
| Calc on confirm | DEXIE_DOMAIN_ENGINE |
| Preview / card generated | false |
| Journal calculated | false |
| GAP-P2-002 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai33_slice1.py`
- `deterministic_preview_edit_loop_service` + ingress stage
- `evals/mai33/manifests/MAI_33_SLICE1.manifest.json`
