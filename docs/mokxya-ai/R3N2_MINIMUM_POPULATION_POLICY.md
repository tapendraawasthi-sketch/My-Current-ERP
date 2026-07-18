# R3N2 Minimum Population Policy

Phase: **MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE**  
Contract: `mai-07-r3n2.contract.1.0.0`  
Scorer: `mai-07-r3n2.scorer.1.0.0`

## Purpose

Lock minimum unique-case denominators **before** holdout execution so required populations cannot silently shrink or become `NOT_APPLICABLE` after observation. Below-minimum counts block holdout with `BLOCKED_INSUFFICIENT_POPULATION`.

## Locked minimum denominators (HOLDOUT_VALIDATION)

| Population ID | Minimum |
|---------------|--------:|
| `ENGLISH_IDENTITY_REQUIRED` | 200 |
| `ROMANIZED_NEPALI_REQUIRED` | 200 |
| `IDENTITY_RETENTION_REQUIRED` | 150 |
| `ACRONYM_IDENTITY_REQUIRED` | 100 |
| `IDENTIFIER_PROTECTION_REQUIRED` | 100 |
| `PROTECTED_IDENTITY_REQUIRED` | 100 |
| `SHARED_OR_AMBIGUOUS` | 150 |
| `ENGLISH_GUARD_ANALOGUE` | 100 |
| `IDENTITY_INVARIANT_ANALOGUE` | 100 |
| `ACRONYM_IDENTIFIER_ANALOGUE` | 75 |

Supporting-split minima:

| Split | Minimum cases |
|-------|--------------:|
| `CONTEXT_COUNTERFACTUAL` | 300 |
| `OOV_CHALLENGE` | 100 |
| `MONOTONIC_REGRESSION` | 300 (`MONOTONIC_PARENT_CORRECT`) |

Split size minima:

| Split | Minimum |
|-------|--------:|
| `DEVELOPMENT` | 500 |
| `HOLDOUT_VALIDATION` | 1000 |
| `SAFETY_CHALLENGE` | 400 |

## R3N2 observed counts (Attempt 001)

All minima satisfied (`POPULATION_DENOMINATORS.json` → `minima_check.ok: true`). Observed holdout-relevant counts exceeded minima (e.g. `ENGLISH_IDENTITY_REQUIRED` 566, `ROMANIZED_NEPALI_REQUIRED` 391).

## Requiredness rules

- `AUTHORIZED_CODE_CORRECTIVE`: required on `DEVELOPMENT` when populated; **not** required on holdout-family splits.
- Core policy gates: required on `DEVELOPMENT` and `HOLDOUT_VALIDATION` when the population is non-empty.
- Empty optional population → `NOT_APPLICABLE`.
- Empty required population on a split that requires the gate → `INVALID_REQUIRED_POPULATION`.

## Hash binding

Minimum denominators are bound into the RC lock via `population_definition_hash` and `threshold_manifest.minimum_denominators`. These hashes cannot change after `LOCKED_NOT_RUN` without sealing a new RC version.

## Failure note (R3N2)

Minimum population policy was satisfied; holdout failure was **quality** (identity retention under cap pressure), not insufficient population.
