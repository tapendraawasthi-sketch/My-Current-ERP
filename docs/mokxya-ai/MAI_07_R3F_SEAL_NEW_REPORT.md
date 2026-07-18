# MAI-07R3F-SEAL-NEW — New Versioned Resource Seal Report

## Verdict

**MAI-07R3F-SEAL-NEW = PASSED_NEW_RC**

| Flag | Value |
| --- | --- |
| AUTOMATED_ENGINEERING_GATES_PASSED | true (new non-frozen RC) |
| QUALITY_GATES_PASSED | false |
| LINGUIST_APPROVED | false |
| PRODUCTION_APPROVED | false |
| MAI-07 overall | NEEDS_CORRECTIVE_WORK (frozen V2 still required) |
| MAI-08 | NOT_STARTED |
| Frozen V2 run | none |
| Next | MAI-07R3G-REAUTHORIZED |

## Historical evidence preserved

| Artifact | Status |
| --- | --- |
| Original R3F RC `37e551f2…` | INVALIDATED_BY_SEAL_DRIFT (sidecar; RC bytes unchanged) |
| Historical claim `e94cc8c…` | Unchanged in `transliteration/resources/manifest.json` |
| Old holdout predictions `b5cdb56f…` | Preserved; not used as new RC evidence |
| Forensic snapshot | Preserved under `evals/mai07_r3f_seal_restore/forensics/` |

## New pack

| Field | Value |
| --- | --- |
| Path | `erp_bot/.../sealed_packs/mai-07.1.3-r3f-sealnew/` |
| Version | `mai-07.1.3-r3f-sealnew` |
| `resource_content_sha256` | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |
| Dual-build identical | true |
| SEALED_READ_ONLY | true |
| Seal contract | `mai-07-artifact-seal-contract.2.0.0` |

Honest note: content hash equals the previously observed unrestorable compute (`16174253…`); it is **not** a restoration of `e94cc8c…`.

## Fresh holdout (one-shot)

| Field | Value |
| --- | --- |
| Attempt | `mai07-r3f-sealnew-holdout-1f60a1a4bcd1` |
| Cases | 1475 |
| English identity | 1003/1003 |
| False Devanagari | 0/1003 |
| Romanized top-1 | 448/448 |
| Recall@5 | 448/448 |
| All harms | 0 |
| Gates | all_pass |
| Predictions raw | `0f1c72f8ee38e457c7d132dc03553f4299d59f80fa956752e97660cab9a7c09c` |
| Predictions canonical list | `ba64b365718018c213c0a6955bcfb4c8b8f9c6f465e328113e662e161d26f2c4` |
| RC lock-before-holdout | `f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff` |

Context-counterfactual supporting split: 211/211 pairs.

## Tests

`language_runtime`: **308 passed / 6 skipped / 0 failed**.

## Rollback

1. Point `RESOURCES_DIR` back only if reverting the phase (not recommended).
2. Do not delete historical `resources/` or invalidated RC.
3. Do not reuse old R3F holdout as release evidence.
4. Do not open frozen V2 without MAI-07R3G-REAUTHORIZED authorization.
