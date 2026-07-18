# ADR_0008 — Romanized Nepali Transliteration Authority

## Status

Accepted (MAI-07)

## Decision

1. Sole MAI transliteration authority: `oip.modules.language_runtime.transliteration`.
2. Output is candidate-only; never replaces raw or normalization views.
3. Eligibility is driven by MAI-05 language-form and protected spans.
4. Ranking scores are deterministic features, not calibrated probabilities.
5. Legacy `xa→cha` and frontend transliterators remain non-authoritative adapters.
6. No network/provider calls; no NLU/RAG/prompt/UI/draft consumption in this phase.
7. MAI-08 owns broader code-mix/typo robustness beyond candidate transliteration.

## Rejected

| Alternative | Why |
|-------------|-----|
| Promote text_normalize as MAI-07 | Mutating, irreversible, not candidate-preserving |
| Auto-select top-1 Devanagari | Becomes false truth; harms accounting safety |
| Per-token LLM transliteration | Non-deterministic, networked, out of phase |

## Consequences

LanguageFrame gains optional `transliteration_bundle`. Ingress emits TRANSLITERATION_* stages with safe counts only.

## Evaluation note (through MAI-07R3G)

Active corrective runtime claim `mai-07.1.2-r3f` remains candidate-only. R3E frozen-V2 one-shot **FAILED_QUALITY**. R3F sealed a non-frozen English Identity Guard RC. R3G frozen-V2 evaluation was **BLOCKED_PRECONDITION_FAILED** (resource pack / holdout prediction integrity); frozen V2 not opened. `LINGUIST_APPROVED=false`, `PRODUCTION_APPROVED=false`.

## Evaluation note (MAI-07C / C2 / R1 / R2)

- **`mai-07.1.0`**: C2 baseline; target top-1 261/316; semantic `b28e8240…`.
- **`mai-07.2.0`**: R1 broad disposition rewrite — **FAILED** (239/316); evidence retained.
- **`mai-07.3.0`**: R2 restores pre-R1 base + monotonic `TargetPromotionOverlay` (`mai-07-r2.1.0`). Holdout failed; frozen one-shot not run. Safe promotion cannot cover the 49 behind-identity required cases without English/name safety conflict. Do not start MAI-08.

## R3H2 addendum (2026-07-16)

MAI-07R3H2 sealed pack `mai-07.1.5-r3h2-shared` / policy `mai-07-r3h2.1.0.0` remains **candidate-only** authority under this ADR. Shared-collision surfaces may `GENERATE` candidates; disposition + span review metadata decide interpretation; auto-select of Devanagari is still prohibited. Active default pack remains `mai-07.1.3-r3f-sealnew` (R3H2 not promoted). `LINGUIST_APPROVED=false`, `PRODUCTION_APPROVED=false`. Do not start MAI-08.

## R3I addendum (2026-07-16)

MAI-07R3I-FROZEN-REAUTHORIZED executed exactly one frozen-V2 evaluation of the sealed R3H2 RC and returned `FAILED_QUALITY`. Candidate pack was loaded explicitly for the frozen runner; active default remains `mai-07.1.3-r3f-sealnew`. R3H2 is **not** promoted. Failure must not be used to retune from frozen V2 cases. Prefer governance for V3 / professional adjudication. MAI-08 NOT_STARTED.

## R3J-A addendum (2026-07-16)

See **ADR_0010**. V2 retired from model selection. Independent V3 review packet issued; no linguist/production approval inferred.
