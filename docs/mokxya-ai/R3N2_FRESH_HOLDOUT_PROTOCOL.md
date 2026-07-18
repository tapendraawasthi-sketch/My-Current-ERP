# R3N2 Fresh-Holdout Protocol

Phase: **MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE**

## Scope

Measure **policy-conformance** of the R3N2 candidate runtime (`mai-07.1.7-r3n2-freshholdout`) against authored behavioral expectations on a **fresh** holdout that does not overlap R3N holdout case IDs, texts, or template families. Not target-accuracy, not frozen V2 quality gates, not independent human IRR.

## Dataset location

`evals/mai07_r3n2_fresh_holdout/`

Builder: `erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n2_dataset_builder.py`

## Parent invalidation lineage

R3N RC_002 (`mai-07.1.6-r3n-policyconf`) is **invalidated** (`INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`). R3N2 must:

- Use a **new** candidate runtime version string.
- Use a **new** holdout seed family and template families.
- Declare zero overlap with R3N holdout splits (see `FRESHNESS_FIREWALL.json`).
- Preserve R3N integrity closure semantic `fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae`.

## Splits

| File | Seed | Use |
|------|------|-----|
| `development.jsonl` | 20260720 | Iterative guard work + authorized R3M regression (9 cases) |
| `holdout_validation.jsonl` | 20260721 | Locked holdout (open once after RC lock) |
| `safety_challenge.jsonl` | 20260721 | Protected / mutation probes |
| `context_counterfactual.jsonl` | 20260721 | Paired English vs Nepali context |
| `oov_challenge.jsonl` | 20260721 | Out-of-vocabulary generalization |
| `monotonic_regression.jsonl` | 20260721 | Parent vs candidate monotonic checks |

## Integrity rules

- **R3N2 holdout ∩ R3N holdout** empty on case IDs, normalized texts, skeletons, and template families.
- **DEVELOPMENT ∩ HOLDOUT** empty on case IDs and exact sentences within R3N2.
- Nine authorized corrective cases reuse R3M private texts in DEVELOPMENT only — never in holdout-family splits.
- Vocabulary token overlap may exist; must be honestly declared in `FRESHNESS_FIREWALL.json`.

## Lock-before-holdout

1. Build sealed pack `mai-07.1.7-r3n2-freshholdout` (policy-only delta from active parent).
2. Bind scorer, population definition, threshold manifest, runtime/pack hashes into `LOCKED_NOT_RUN.json`.
3. Status must be `LOCKED_NOT_RUN` with semantic hash fixed before any holdout prediction run.
4. One holdout attempt only; chain manifest marks `consumed: true`.
5. No post-observation scorer, gate, or threshold edits.

## Split-aware required gates

Scorer contract (`r3n2_scoring_contracts.py`):

- **No** `max(1, denominator)`. Below-minimum required population → `BLOCKED_INSUFFICIENT_POPULATION` (pre-holdout).
- Empty **optional** populations → `NOT_APPLICABLE` (not fail).
- Core policy gates required on `DEVELOPMENT` and `HOLDOUT_VALIDATION` when populated.
- `AUTHORIZED_CODE_CORRECTIVE` is **DEVELOPMENT-only**; empty on holdout → `NOT_APPLICABLE`.

## Write authorization

```bash
set MAI07_AUTHORIZE_EVAL_WRITE=1
python -m src.oip.modules.language_runtime.transliteration.application.mai07_r3n2_dataset_builder --write
python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n2 --lock
python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n2 --one-shot
```

Dry-run scoring (no write): omit `--write`; tests use `score_split(..., write=False)`.

## Artifacts

- `MANIFEST.json` — counts, seeds, per-split SHA-256
- `FRESHNESS_FIREWALL.json` — zero-overlap proofs vs R3N holdout
- `POPULATION_DENOMINATORS.json` — locked minima and observed counts
- `LEAKAGE_AND_SPLIT_INTEGRITY.json` — dev/holdout disjointness within R3N2
- `MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json` — immutable lock body
- `MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001.QUALIFICATION_RESULT.json` — separate qualification record

## R3N2 Attempt 001 outcome

**Verdict:** `FAILED_HOLDOUT_QUALITY` — identity_retention 148/150 and identity_invariant_analogue 98/100. Do not repair in-place. Next: R3N3 fresh-holdout corrective.
