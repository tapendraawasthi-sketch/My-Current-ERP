# ADR_0025 — Code-Mix and Typo Robustness Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-08-CODE-MIX-AND-TYPO-ROBUSTNESS (slice 1)
- **Extends:** ADR_0006, ADR_0007, ADR_0008, ADR_0024

## Context

MAI-07 R3S cutover made romanized-Nepali candidate transliteration the active
default. Shop utterances still mix English / Romanized Nepali / Devanagari and
carry mobile typing noise. Fuzzy party/item enrichment can silently bind
high-risk master IDs at low score floors.

## Decision

1. MAI-08 owns **typo / abbreviation / code-mix features** as annotations and
   **candidate-only** transforms on `LanguageFrame` via `TypoCodeMixBundleV1`.
2. Candidates never mutate `raw_text`. `silent_applications` must remain `0`.
3. MAI-05 remains span/code-mix detection authority; MAI-06 remains lossless
   normalization; MAI-07 remains transliteration. MAI-08 does not start MAI-09
   number roles or MAI-10 lexicon.
4. High-risk master data (`partyId`, `itemId`) requires abstention or clarify
   when fuzzy is weak or a close second exists. Slice-1 floors:
   - party score ≥ **0.75** and gap to #2 ≥ **0.12**
   - item score ≥ **0.78** and gap to #2 ≥ **0.12**
5. Legacy `nlu/text_normalize.py` and shop spelling maps remain isolated
   adapters until an explicit migration ADR.
6. Slice 1 is engineering-gated only: `production_approved=false`,
   `LINGUIST_APPROVED` unchanged for MAI-08.

## Rejected

| Alternative | Why |
|-------------|-----|
| Auto-apply typo corrections into intent text | Silent mutation / provenance break |
| Keep EntityEnricher 0.62/0.65 floors | Silent high-risk master bind |
| Expand into number-role parsing in MAI-08 | Owned by MAI-09 |

## Consequences

- Language pipeline may attach `typo_code_mix_bundle` after MAI-06/07 bundles.
- Product fuzzy enrichers must clarify/abstain on close-name adversarial pairs.
- GAP-P1-009 remains OPEN/REDUCED until broader product multilingual quality closes.

## Related

- `docs/mokxya-ai/MAI_08_CODE_MIX_AND_TYPO_ROBUSTNESS.md`
- `erp_bot/src/oip/modules/language_runtime/typo_robustness/`
- `src/ai/rag/EntityEnricher.ts`
