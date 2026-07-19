# MAI-10 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-10.0.1-slice1`  
**Ontology:** `mai-10.seed.v1`  
**Authority:** ADR_0027  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| MAI-10 status | `IN_PROGRESS` |
| MAI-09 | **PASSED_ENGINEERING** |
| Synonym→concept (sales/credit) | EN / romanized / Devanagari aligned |
| Protected-span skip | yes |
| `silent_applications` | **0** |
| Planner keyword replacement | **not done** (slice 1 non-goal) |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai10_slice1.py` (8 passed)
- `evals/mai10/frozen/domain_concepts_critical_v1.jsonl` (8 cases)
- `docs/mokxya-ai/baselines/MAI_09_ENGINEERING_CLOSURE.md`
