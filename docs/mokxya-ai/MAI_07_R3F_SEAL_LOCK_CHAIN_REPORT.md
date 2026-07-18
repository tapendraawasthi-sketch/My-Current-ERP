# MAI-07R3F-SEAL-LOCK-CHAIN — Append-Only RC Lock Chain Report

## 1. Verdict and flags

| Item | Value |
| --- | --- |
| **MAI-07R3F-SEAL-LOCK-CHAIN** | **PASSED_RECOVERED_LOCK_CHAIN** |
| Branch A | Recovered immutable lock body `f4c07e24…` + saved-holdout chain (RC_001) |
| Branch B | Append-only RC_002 fresh holdout chain also verified (supplementary) |
| AUTOMATED_ENGINEERING_GATES_PASSED | **true** (lock-chain integrity) |
| QUALITY_GATES_PASSED | **false** |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| MAI-07 | NEEDS_CORRECTIVE_WORK |
| MAI-08 | NOT_STARTED |
| Next | **MAI-07R3G-REAUTHORIZED-002** |

## 2. Hash-contract interpretation

Under `mai-07-artifact-seal-contract.2.0.0`:

- **`rc_manifest_semantic_sha256` / `manifest_sha256` (lock):** SHA-256 of pretty JSON (`indent=2`, `sort_keys=True`, LF) of RC object **excluding** `manifest_sha256`, `rc_manifest_raw_sha256`, `rc_manifest_semantic_sha256`.
- **`rc_manifest_raw_sha256`:** SHA-256 of pretty JSON of object **including** semantic hash fields but **excluding** the raw field value itself (contract symmetric hash).
- **`predictions_jsonl_raw_sha256`:** raw JSONL file bytes.
- **`predictions_canonical_list_sha256`:** canonical JSON of sorted prediction list (not raw JSONL).

## 3. Branch A — recovery

- **Search:** no pre-existing dedicated `.LOCKED_NOT_RUN.json` before remediation.
- **Deterministic reconstruction:** `build_mai07r3f_seal_new_rc.build_rc(..., write=False)` reproduces semantic **`f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff`**.
- **Provenance:** `RECONSTRUCTED_FROM_PREEXISTING_HASH_COMMITMENT` (prior narrative commitments in holdout attempt/score report).
- **Immutable artifact:** `evals/mai07_r3f_seal_new/MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json`
- **Post-holdout manifest restored separately:** semantic **`530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c`**

## 4. Branch B — append-only RC_002 (supplementary)

- **RC:** `MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002`
- **Lock semantic:** `63a900a6fcb45be4e45dc059715050fa0b73b381b4f6fd3c9484a2de670ca70e`
- **Fresh holdout:** 1469 cases, all strict gates passed (one-shot)
- **Predictions raw/canonical:** `6483be8d…` / `36e99cce…`

## 5. Validation

| Suite | Result |
| --- | --- |
| `tests/oip/language_runtime/` | **341 passed, 6 skipped, 0 failed** |
| Pre-edit baseline | 314 passed, 6 skipped |
| Delta | +27 lock-chain / updated R3G tests; 6 historical R1/R2 skips unchanged |

## 6. Confirmations

- Frozen V2 **did not run**
- MAI-08 **NOT_STARTED**
- GAP-P1-014 **CLOSED**
- GAP-P1-013 remains **CLOSED**
- GAP-P1-011, GAP-P1-012, GAP-P0-001 remain **OPEN**
