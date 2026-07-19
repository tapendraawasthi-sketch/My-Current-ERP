# MAI-44 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-44.0.2-slice2`  
**Authority:** ADR_0061 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` security red-team candidate |
| Live pen review / zero-critical claim | not invoked (`allow_*=false`) |
| Threat model / suite / finding / remediation refs | null |
| Pen review passed / isolation proven | false |
| GAP-P0-001 / GAP-P2-008 | remain OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai44_slice2.py`
- `security_tenant_red_team_consume_service.py`
- `evals/mai44/manifests/MAI_44_SLICE2.manifest.json`
