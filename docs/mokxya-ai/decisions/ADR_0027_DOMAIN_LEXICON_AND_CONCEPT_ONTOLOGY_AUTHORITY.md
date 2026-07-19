# ADR_0027 — Domain Lexicon and Concept Ontology Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-10-DOMAIN-LEXICON-AND-CONCEPT-ONTOLOGY (slice 1)
- **Extends:** ADR_0006 (protected spans), ADR_0025, ADR_0026

## Context

Shop utterances use English / Romanized Nepali / Devanagari synonyms for the
same accounting concepts (`bikri` / `sales` / `बिक्री`). Planner intent
classifiers and FE regexes hardcode fragmented keyword lists. MAI-07
`domain_terms.json` only maps romanized→Devanagari for transliteration — it is
not a concept ontology.

## Decision

1. MAI-10 owns **domain concept candidates** on `LanguageFrame` via
   `DomainLexiconBundleV1` — annotation / candidates only; never mutates raw.
2. Each candidate binds a surface span to a stable `concept_id` (e.g.
   `CONCEPT_SALES`) with language-form evidence; never auto-routes intent or
   posts drafts from lexicon alone.
3. Matching skips MAI-05 protected spans (names, PAN, phone, invoice refs).
4. Slice 1 ships a curated seed ontology (sales/purchase/credit/payment/VAT/…)
   with EN + romanized + Devanagari surfaces; does **not** replace planner
   keyword registries yet.
5. MAI-07 transliteration `domain_terms` remains a separate resource; MAI-10
   may reuse surfaces but owns concept IDs.
6. Slice 1 is engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Expand MAI-07 domain_terms into ontology | Wrong authority; pack seals must stay frozen |
| Silent intent rewrite from lexicon | Silent mutation / planner bypass |
| Full NP KB dump as runtime truth | Unreviewed; not versioned for shop ERP |

## Related

- `docs/mokxya-ai/MAI_10_DOMAIN_LEXICON_AND_CONCEPT_ONTOLOGY.md`
- `erp_bot/src/oip/modules/language_runtime/domain_lexicon/`
