# MAI-10 — Domain Lexicon and Concept Ontology

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0027](decisions/ADR_0027_DOMAIN_LEXICON_AND_CONCEPT_ONTOLOGY_AUTHORITY.md)  
**Runtime:** `mai-10.0.1-slice1` (engineering; not production-approved)

## Objective

Map shop synonym surfaces (EN / Romanized / Devanagari) to stable accounting
concept IDs so downstream routing and NLU share one ontology — without silent
intent mutation or draft writes.

## Slice 1

1. `DomainLexiconBundleV1` candidate parser (`domain_lexicon` package)
2. Seed concepts: sales, purchase, credit, payment/cash, expense, balance, VAT,
   discount, invoice, report, rent, interest, customer, supplier, stock
3. Longest-surface match; skip protected spans; `silent_applications=0`
4. Wire attach after MAI-09 in `oip_chat_ingress`
5. `evals/mai10` synonym→concept fixtures + baseline

## Gates (slice 1)

| Case | Expect |
|------|--------|
| `bikri` / `sales` / `बिक्री` | same `CONCEPT_SALES` |
| `udhaar` / `credit` / `उधारो` | same `CONCEPT_CREDIT` |
| Protected party name span | no concept bind overlapping name |
| Bundle | `silent_applications=0`; raw unchanged |

## Non-goals

- Replacing planner `IntentClassifierRegistry` keywords
- Linguist / production approval
- MAI-11 response register policy
- Mutating MAI-07 sealed transliteration packs
