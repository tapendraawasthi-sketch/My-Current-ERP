# MAI-42 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-42.0.2-slice2`  
**Authority:** ADR_0059 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` judicial-decision candidate |
| Live case retrieve / judicial authority | not invoked (`allow_*=false`) |
| Case refs / holdings / citator / anchors | null |
| Release / gold | NOT_RELEASED |
| Headnote as binding rule | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai42_slice2.py`
- `judicial_decision_intelligence_consume_service.py`
- `evals/mai42/manifests/MAI_42_SLICE2.manifest.json`
