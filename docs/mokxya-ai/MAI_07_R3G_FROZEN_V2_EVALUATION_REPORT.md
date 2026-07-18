# MAI-07R3G — Frozen V2 Evaluation of Sealed R3F RC

**Verdict:** `BLOCKED_PRECONDITION_FAILED`  
**Frozen V2 opened:** **no**  
**One-shot executed:** **no**  
**Quality verdict:** **none** (protocol/integrity stop)

## Flags

| Flag | Value |
| --- | --- |
| MAI-07R3G | **BLOCKED_PRECONDITION_FAILED** |
| QUALITY_GATES_PASSED | **false** (unchanged; no frozen run) |
| AUTOMATED_ENGINEERING_GATES_PASSED | **false** for this attempt |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| MAI-07 overall | **NEEDS_CORRECTIVE_WORK** |
| MAI-08 | **NOT_STARTED** |
| Overlay | disabled |

## Blocking evidence (exact)

### 1. Active resource pack ≠ sealed R3F resource hash

| Field | Value |
| --- | --- |
| Sealed (RC / docs) | `e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a` |
| Active `compute_pack_content_hash()` | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |
| LF-normalized pack hash | `61d709fb2bb422d58751a6e012a9208de97e84f3ac59b7c65afcbf346d042745` |

LF normalization recovers the sealed **guard config** digest (`9240a7be…`) but **does not** recover the sealed pack digest. Pack drift is therefore not CRLF-only.

### 2. Holdout prediction file ≠ score-report prediction hash

| Field | Value |
| --- | --- |
| Report `predictions_sha256` | `b5cdb56f966a84fd77c2c2727f7dd5269bc16cf90406eb386899fa1d7b5e5a6d` |
| On-disk HOLDOUT predictions | `ce4152a05a0384b17e39d9b8edba5806ccb2b71a4ca53c3ca87fd17fa90858d1` |

Holdout metric tables still claim all_pass with English 752/752 and false-Dev 0/752, but prediction integrity against the sealed report fails. R3G will not accept summary-only pass statements.

## What remained sealed / OK

| Artifact | Status |
| --- | --- |
| R3F RC content hash `37e551f2…` | OK |
| R3F DEVELOPMENT / HOLDOUT / SAFETY / COUNTERFACTUAL dataset hashes | OK |
| R3F holdout threshold hash `e4684ed4…` | OK |
| Frozen V1 / V2 / pop / threshold | OK |
| R3E attempt `833233e4…` + predictions `89ee4789…` | preserved |
| Canonical/audit scorers (LF-normalized) | match R3E sealed digests |
| Runtime claim `mai-07.1.2-r3f`, overlay false, guard version `mai-07-r3f.1.0.0` | OK |

## Post-SEAL-RESTORE clarification

Holdout prediction field `b5cdb56f…` is the producer **canonical JSON list** hash and **reproduces** from on-disk JSONL (`ce4152a0…` is raw file serialization only). Resource pack `e94cc8c…` remains unrestorable. See `docs/mokxya-ai/MAI_07_R3F_SEAL_RESTORE_REPORT.md`.

## Preflight artifact

`evals/mai07/r3g/reports/MAI_07R3G_PREFLIGHT_REPORT.json`

## Recommended next governed phase

**MAI-07R3F-SEAL-RESTORE** (or equivalent non-frozen integrity phase): restore byte-identical sealed R3F resource pack to `e94cc8c…`, re-bind holdout predictions to the report hash (or re-seal a new RC under fresh authorization), then re-authorize R3G. Not MAI-08. Not frozen retune.
