# NEXT-07 — Gated Language Candidate Consume into Primary NLU

**Date:** 2026-07-19  
**Step:** NEXT-07  
**ADR:** ADR_0076  

## Decision

Forward `language_nlu_candidates` from LanguageFrame into
`handle_mode_aware_erp` and refine weak classifications via MAI-10
`map_concepts_to_intent`. Prefer MAI-09 money roles over duration/ID.

| Gate | Result |
|------|--------|
| Concept consume (weak general → report/sales/purchase) | **enabled** |
| Number-role money preference | **enabled** |
| Transliteration/typo apply to raw_text | **forbidden** |
| Silent party/item bind | **forbidden** (MAI-08 floors unchanged) |
| Silent draft write from consume | **forbidden** |
| Ambiguous sales+purchase concepts | **abstain** (no override) |
| GAP-P1-009 | remains **OPEN** (NEXT-09) |

## Before / after (frozen-style cases)

| Case | Before (classifier only) | After (with concept consume) |
|------|--------------------------|------------------------------|
| Weak general + CONCEPT_REPORT+SALES | GENERAL_QUESTION | REPORT_REQUEST / report_generation |
| CONCEPT_SALES + CONCEPT_PURCHASE | (unchanged) | no override |
| Confirm "yes" + CONCEPT_SALES | CONFIRMATION | CONFIRMATION (locked) |
| Number roles `[duration, amount]` | first surface may confuse | first money = amount |

## Evidence

- `docs/mokxya-ai/decisions/ADR_0076_GATED_LANGUAGE_CANDIDATE_NLU_CONSUME.md`
- `docs/mokxya-ai/MAI_NLU_LANGUAGE_CONSUME_REGISTRY.json`
- `erp_bot/.../language_nlu_consume.py`
- `erp_bot/tests/oip/language_runtime/test_mai_next07_nlu_consume.py`

## Explicit non-claims

- Not production_approved.
- Does not close GAP-P1-009.
- Does not apply transliteration/typo rewrites.
