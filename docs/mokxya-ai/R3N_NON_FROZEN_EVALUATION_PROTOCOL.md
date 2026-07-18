# R3N Non-Frozen Evaluation Protocol

Phase: **MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE**

## Scope

Measure **policy-conformance** of the R3N candidate runtime against authored behavioral expectations. Not target-accuracy, not frozen V2 quality gates, not independent human IRR.

## Dataset location

`evals/mai07_r3n_policy_conformance/`

Builder: `erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n_dataset_builder.py`

## Splits

| File | Seed family | Use |
|------|-------------|-----|
| `development.jsonl` | 20260718 | Iterative guard work + authorized R3M regression |
| `holdout_validation.jsonl` | 20260719 | Locked holdout (open once after RC lock) |
| `safety_challenge.jsonl` | 20260719 | Protected / mutation probes |
| `context_counterfactual.jsonl` | 20260719 | Paired English vs Nepali context |
| `oov_challenge.jsonl` | 20260719 | Out-of-vocabulary generalization |
| `monotonic_regression.jsonl` | 20260719 | Parent vs candidate monotonic checks |

## Case contract

Each case carries: `case_id`, `split`, `population_ids`, `input_text`, `highlighted_span`, `expected_behavior`, `template_family`, `prohibited_for_training=true`.

Expected behaviors: `IDENTITY_TOP1`, `IDENTITY_RETAINED`, `ACRONYM_IDENTITY_TOP1`, `ROMANIZED_SCRIPT_AT_5`, `SHARED_CONSERVATIVE`, `PROTECTED_IDENTITY`, `NO_RAW_MUTATION`, `CAP_OK`.

## Integrity rules

- **DEVELOPMENT ∩ HOLDOUT** empty on case IDs and exact sentences.
- **Template families** disjoint across development vs holdout-family splits.
- Synthetic sentences must not overlap R3L `BEHAVIOR_EXPECTATIONS` inputs.
- R3M private case text loaded from artifacts only — never hardcoded in builder source.

## Split-aware required gates

Scorer contract (`r3n_scoring_contracts.py`):

- **No** `max(1, denominator)`. Empty required population on a split that requires that gate → `INVALID_REQUIRED_POPULATION`.
- Empty **optional** populations → `NOT_APPLICABLE` (not fail).
- Core policy gates are required on `DEVELOPMENT` and `HOLDOUT_VALIDATION` when populated.
- `AUTHORIZED_CODE_CORRECTIVE` is **DEVELOPMENT-only**. On holdout-family splits an empty `AUTHORIZED_CODE_CORRECTIVE` population is `NOT_APPLICABLE`, not a holdout failure.

## Write authorization

```bash
set MAI07_AUTHORIZE_EVAL_WRITE=1
python -m src.oip.modules.language_runtime.transliteration.application.mai07_r3n_dataset_builder --write
```

Dry-run (no write): omit `--write`.

## Artifacts

- `MANIFEST.json` — counts, seeds, per-split SHA-256
- `LEAKAGE_AND_SPLIT_INTEGRITY.json` — overlap proof and population denominators
