# ADR_0006 — Language-Form and Protected-Span Authority

## Status

Accepted (MAI-05)

## Decision

1. Canonical module: `oip.modules.language_runtime`.
2. Script ≠ language-form; separate fields on span annotations.
3. Offset unit: UNICODE_CODE_POINT (documented optional on `SourceSpanV1` / spans).
4. Protected spans detected first with deterministic priority.
5. Romanized classification is lexicon-conservative with explicit ambiguous abstention.
6. Model-free runtime; resources compact and cached.
7. MAI-06/07 own normalization and transliteration — not started here.
8. `LanguageFrameV1` attached on `CanonicalAIRequestV1.language_frame` without changing intent routing.

## Rejected

| Alternative | Why |
|-------------|-----|
| Use text_normalize as analyzer | Mutates text; MAI-06 |
| Whole-message language label only | Hides code-mix |
| Force all Latin → Romanized/English | False confidence |
| Load full NP KB per request | Cost/latency |

## Rollback

Remove language_runtime + MAI-05 datasets/docs; revert ingress LanguageFrame attach and optional schema fields via export.
