# MAI-24 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-24.0.1-slice1`  
**Authority:** ADR_0041  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | KnowledgeSourceGovernance annotation from COMPLETE non-OOD router |
| Documents retrieved | none |
| Evaluation corpus | never allowed |
| `is_execution_authority` | false |
| GAP-P2-008 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai24_slice1.py`
- `knowledge_source_governance_service` + ingress stage
- `evals/mai24/manifests/MAI_24_SLICE1.manifest.json`
