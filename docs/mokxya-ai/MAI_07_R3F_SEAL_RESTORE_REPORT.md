# MAI-07R3F-SEAL-RESTORE — Forensic / Restoration Report

**Verdict:** `RESTORE_NOT_POSSIBLE_NEW_RC_REQUIRED`  
**Secondary finding:** Holdout `predictions_sha256` was a **validator contract mismatch** (not content drift).

## Flags

| Flag | Value |
| --- | --- |
| MAI-07R3F-SEAL-RESTORE | **RESTORE_NOT_POSSIBLE_NEW_RC_REQUIRED** |
| Original R3F RC | **INVALIDATED_BY_SEAL_DRIFT** (resource pack) |
| QUALITY_GATES_PASSED | **false** |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| Frozen V2 opened | **no** |
| Holdout regenerated | **no** |
| MAI-08 | **NOT_STARTED** |
| Next | **MAI-07R3F-SEAL-NEW** |

## Resource restoration

| Item | Result |
| --- | --- |
| Target | `e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a` |
| Current raw pack | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |
| LF-normalized pack | `61d709fb2bb422d58751a6e012a9208de97e84f3ac59b7c65afcbf346d042745` |
| Exact trusted copy found | **no** |
| Restored | **no** |

Drift is not CRLF-only. No committed archive, ZIP, or fixture reproduces `e94cc8c…`.

## Prediction restoration

| Item | Result |
| --- | --- |
| Sealed report field | `b5cdb56f…` = canonical JSON **list** hash (producer) |
| On-disk JSONL raw | `ce4152a0…` (different serialization; same objects) |
| Producer contract match | **yes** |
| Metrics reproduced without runtime | **yes** (exact metric equality + audit agree + gates all_pass) |
| Runtime re-run | **not performed** |

## Tooling root cause

1. `seal_manifest_hash()` + `--check-twice` + `test_resource_check_twice_ok` **mutated** canonical `manifest.json` claims.
2. Resource JSON files on disk are CRLF; pack hash uses raw bytes.
3. R3G preflight compared raw prediction **file** hash to a field that means canonical **list** hash.

## Tooling hardening (this phase)

- `validate_resources`: read-only; reports `expected`/`actual`; never seals.
- `--check-twice` → `check_twice_isolated()` (temp dirs only).
- `seal_manifest_hash` refuses canonical paths unless authorized env + flag.
- Tests updated; new `test_mai07_r3f_seal_restore.py`.
- R3G holdout check corrected to producer contract.

Hardening touches `resource_repository.py` (not in R3F `code_semantic_hash` file set). Resource claim still unrestorable → RC remains invalidated for R3G purposes.

## Artifacts

- `evals/mai07_r3f_seal_restore/forensics/`
- `docs/mokxya-ai/MAI_07R3F_SEAL_HASH_CONTRACT.md`
- `docs/mokxya-ai/MAI_07R3F_SEAL_DRIFT_CHRONOLOGY.md`
