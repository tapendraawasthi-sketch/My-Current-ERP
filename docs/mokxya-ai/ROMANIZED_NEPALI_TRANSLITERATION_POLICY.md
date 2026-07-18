# ROMANIZED_NEPALI_TRANSLITERATION_POLICY

## Candidate-only

Transliteration yields ranked alternatives. It does not correct, rewrite, or authorize accounting meaning.

## Eligibility

| Form | Behavior |
|------|----------|
| ROMANIZED_NEPALI | Identity + bounded Devanagari |
| NEPALI_DEVANAGARI | Identity only |
| ENGLISH / TECHNICAL_ACCOUNTING_ENGLISH | Identity default; lexical variants only if curated evidence; english_identity prefers Latin top-1 |
| SHARED_OR_AMBIGUOUS_LATIN | Identity; generate only with lexical/name evidence; else abstain |
| NAMED_ENTITY / name-like | Identity preferred; Dev optional + requires_review |
| PROTECTED / IDENTIFIER / NUMERIC | Identity / skip |

## Ranking (MAI-07R2)

1. **Base:** pre-R1 `DeterministicCandidateRanker` (hardcoded uncalibrated deltas; no R1 disposition rewrite).
2. **Overlay:** `TargetPromotionOverlay` + `promotion_overlay_config.json` (`mai-07-r2.1.0`).

Overlay may only:

- `KEEP_BASE_ORDER` / `ABSTAIN_FROM_PROMOTION` / `PROMOTE_EXISTING_TARGET`
- Swap identity with the highest-ranked eligible existing non-identity candidate
- Never demote a base non-identity rank-1
- Never mutate surfaces, IDs, alignments, or caps

Blockers include: english_identity, name-like, protected, acronym, identifier, weak grapheme-only, security.

Scores remain `CalibrationStatus.UNCALIBRATED` — not probabilities.

## Alignment

Exact Unicode code-point ranges only. No float/proportional interpolation.

## Corrective development firewall

- Historical R1: `evals/mai07_ranker_dev/`
- Active R2: `evals/mai07_ranker_r2/`
- Runtime must not import frozen `evals/mai07` for ranking features.

## Prohibited in this phase

Auto-apply, UI render, prompt/RAG/NLU feed, draft/posting, network providers, training on frozen eval labels.
