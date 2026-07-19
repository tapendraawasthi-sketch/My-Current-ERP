# MAI-10 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-10.0.2-slice2`  
**Ontology:** `mai-10.seed.v1`  
**Authority:** ADR_0027  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Concept→intent bridge | **wired** (planner priority 5) |
| Devanagari `बिक्री` | `sales_entry` via bridge |
| `sales report` | `report_generation` (report wins) |
| Education abstain | `what is bikri` → `accounting_education` |
| Draft / OEC write from lexicon | **none** |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai10_slice2.py`
- `evals/mai10/frozen/concept_intent_bridge_v1.jsonl`
- `concept_intent_bridge.py` + `intent_classification_stage.py`
