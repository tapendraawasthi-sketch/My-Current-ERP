# MAI-10 — Domain Lexicon and Concept Ontology

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0027](decisions/ADR_0027_DOMAIN_LEXICON_AND_CONCEPT_ONTOLOGY_AUTHORITY.md)  
**Runtime:** `mai-10.0.2-slice2` (engineering; not production-approved)

## Objective

Map shop synonym surfaces (EN / Romanized / Devanagari) to stable accounting
concept IDs so downstream routing and NLU share one ontology — without silent
draft writes.

## Slice 1

1. `DomainLexiconBundleV1` candidate parser (`domain_lexicon` package)
2. Seed concepts: sales, purchase, credit, payment/cash, expense, balance, VAT,
   discount, invoice, report, rent, interest, customer, supplier, stock
3. Longest-surface match; skip protected spans; `silent_applications=0`
4. Wire attach after MAI-09 in `oip_chat_ingress`
5. `evals/mai10` synonym→concept fixtures + baseline

## Slice 2

1. `concept_intent_bridge` — map unambiguous concepts → planner intent
2. Register bridge ahead of keyword classifiers (Devanagari parity)
3. Abstain on education/approval cues, sales+purchase conflict, credit-alone
4. Report dominates when co-present with sales; metadata records `intent_source`
5. Never posts drafts from lexicon

## Gates

| Case | Expect |
|------|--------|
| `बिक्री` / `bikri` | `sales_entry` via concept bridge |
| `today sales report` | `report_generation` (report wins) |
| `what is bikri` | `accounting_education` (bridge abstains) |
| `bikri ra kharid` | bridge abstains; keyword `sales_entry` |
| Bundle | `silent_applications=0`; raw unchanged |

## Non-goals

- Silent draft / OEC mutation from lexicon
- Linguist / production approval
- MAI-11 response register policy
- Mutating MAI-07 sealed transliteration packs
