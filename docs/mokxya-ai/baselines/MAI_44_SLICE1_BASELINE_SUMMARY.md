# MAI-44 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-44.0.1-slice1`  
**Authority:** ADR_0061  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Analysis | COMPLETE → `POLICY_DECLARED` on security cues |
| Pilot scope | `SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY` |
| Isolation proven / zero critical claimed | false |
| Pen review passed / production security approved | false |
| GAP-P0-001 / GAP-P2-008 | remain OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai44_slice1.py`
- `security_tenant_red_team_service.py`
- `evals/mai44/manifests/MAI_44_SLICE1.manifest.json`
