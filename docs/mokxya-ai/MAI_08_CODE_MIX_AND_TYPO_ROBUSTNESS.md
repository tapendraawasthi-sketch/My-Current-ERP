# MAI-08 — Code-Mix and Typo Robustness

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0025](decisions/ADR_0025_CODE_MIX_AND_TYPO_ROBUSTNESS_AUTHORITY.md)  
**Runtime:** `mai-08.0.1-slice1` (engineering; not production-approved)

## 1. Objective

Understand natural three-way mixing and mobile typing noise so meaning/slots
remain stable across approved variants, while fuzzy matching cannot silently
select high-risk master data and OOD behavior stays measurable.

## 2. Pre-edit inventory

| Path | Behavior | MAI-08? |
|------|----------|--------|
| `language_analyzer.py` CodeMixPattern | Detection only | Upstream (MAI-05) |
| MAI-06 abbr/rep candidates | Candidate-only, never applied | Upstream |
| MAI-07 transliteration | Candidate Devanagari/identity | Upstream |
| `nlu/text_normalize.py` | Mutating spelling adapter | Legacy only |
| `EntityEnricher.ts` fuzzy bind | Silent party/item IDs | **Hardened in slice 1** |
| `postSalesTransaction` substring pick | Deferred | Out of slice 1 |
| SpellingCorrector autoCorrect | Deferred | Out of slice 1 |

## 3. Selected authority

`erp_bot/src/oip/modules/language_runtime/typo_robustness/` — attaches
`TypoCodeMixBundleV1` (candidate-only). Contract:
`erp_bot/src/oip/contracts/typo_code_mix.py`.

## 4. Slice 1 scope

**Shop obligation slot stability + master-data abstention**

1. Candidate-only typo / abbreviation / code-mix features on LanguageFrame.
2. Metamorphic evals under `evals/mai08/` for slot-stable code-mix and typo/abbr,
   fuzzy high-risk abstain, and OOD unknown party.
3. EntityEnricher floors: party **0.75**, item **0.78**, min gap **0.12**;
   `partyAmbiguous` / `itemAmbiguous` when close seconds exist.

## 5. Gates (slice 1)

| Metric | Threshold |
|--------|-----------|
| `slot_stability_pass_rate` | ≥ 0.95 |
| `silent_high_risk_master_bind_rate` | = 0 |
| `ood_abstain_or_clarify_rate` | ≥ 0.90 |
| `silent_applications` on TypoCodeMixBundle | = 0 |

## 6. Non-goals

- Applied typo correction into retrieval/intent text
- MAI-09 number/date/money roles
- MAI-10 domain ontology
- Linguist / production approval of MAI-08
- Re-opening MAI-07 pack cutover

## 7. Evidence

- ADR_0025
- `evals/mai08/`
- `docs/mokxya-ai/baselines/MAI_08_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/tests/oip/language_runtime/test_mai08_slice1.py`
- `src/__tests__/orbix/mai08EntityEnricher.test.ts`
