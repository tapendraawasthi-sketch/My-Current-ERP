# MAI-36 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-36.0.1-slice1`  
**Authority:** ADR_0053  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Legal question / research-mode policy annotation |
| Semantic input | MAI-30 LEGAL_TAX claim cues |
| Missing jurisdiction/time | CLARIFY_REQUIRED |
| Mutation tools | false |
| Current law definitive | false |
| Legal effective dates proven | false |
| GAP-P2-008 | OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai36_slice1.py`
- `legal_question_research_service` + ingress stage
- `evals/mai36/manifests/MAI_36_SLICE1.manifest.json`
