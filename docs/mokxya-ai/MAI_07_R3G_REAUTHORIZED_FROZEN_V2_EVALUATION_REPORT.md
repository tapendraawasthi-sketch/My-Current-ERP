# MAI-07R3G-REAUTHORIZED — Frozen V2 Evaluation Report

## Verdict

**MAI-07R3G-REAUTHORIZED = BLOCKED_PRECONDITION_FAILED**

| Flag | Value |
| --- | --- |
| Frozen V2 opened | **no** |
| Attempt locked | **no** |
| One-shot executed | **no** |
| QUALITY_GATES_PASSED | **false** |
| AUTOMATED_ENGINEERING_GATES_PASSED | true (SEAL-NEW non-frozen only; unchanged) |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| MAI-07 overall | **NEEDS_CORRECTIVE_WORK** |
| MAI-08 | **NOT_STARTED** |
| Next | **MAI-07R3F-SEAL-LOCK-CHAIN** |

## Blocking reason (sole preflight error)

**Lock-before-holdout chain incomplete.**

Required either:

- **A.** A preserved immutable RC snapshot whose body hashes to  
  `f4c07e24cb78550496720881fbc2b6019650006f8bd39eedd716fd046b6107ff`, or  
- **B.** An append-only lock record containing the **complete** locked RC body plus that hash.

Found **only narrative references** (hash strings without the locked body):

- `evals/mai07_r3f_seal_new/reports/MAI_07R3F_SEAL_NEW_HOLDOUT_ATTEMPT.json` → `rc_manifest_sha256_locked_before_holdout`
- `evals/mai07_r3f_seal_new/reports/MAI_07R3F_SEAL_NEW_HOLDOUT_VALIDATION_SCORE_REPORT.json` → `rc_manifest_sha256`

The current RC file is the **post-holdout** `PASSED_NEW_RC` object  
(`manifest_sha256` = `530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c`;  
file raw = `01700e0128d839abb6e2a2ee8bed10f949e26e5c5ba05d8fdc9706b0c13b4507`).  
That is not the lock-before-holdout body.

Per phase rules, narrative/mtime is insufficient → **do not open frozen V2**.

## Lineage that passed

| Check | Result |
| --- | --- |
| Active runtime `mai-07.1.3-r3f-sealnew` | ok |
| Active pack path `sealed_packs/mai-07.1.3-r3f-sealnew/` | ok |
| Resource content `16174253…` claim==compute | ok |
| Overlay disabled | ok |
| Historical claim `e94cc8c…` + invalidation sidecar | ok |
| Parent RC `37e551f2…` INVALIDATED_BY_SEAL_DRIFT | ok |
| Fresh holdout preds raw/canonical | ok |
| Holdout gates / canon↔audit | ok |
| V1/V2/pop/threshold/scorers | unchanged |
| R3E attempt/preds preserved | ok |
| Blocked historical R3G not overwritten | ok |

## Forensic snapshot discrepancy (documented, non-blocking)

| Citation | Hash |
| --- | --- |
| Previously cited | `c568464d691a7edd5797469d7209e2a6d0b92fdd1c6fd38e73ae43c3295243b5` |
| Current on-disk raw | `094d2d00f044abc03013f9aea7ae6ed202c9ec1fe36b93a358aadb68f464a782` |

Preserved as historical forensic evidence; not an input to the replacement RC.

## What was not done

- No attempt manifest created under `evals/mai07/r3g_reauthorized/`
- No frozen V2 case consumption
- No predictions / scoring / quality verdict
- No rewrite of `evals/mai07/r3g/` blocked preflight

## Preflight artifact

`evals/mai07/r3g_reauthorized/reports/MAI_07R3G_REAUTHORIZED_PREFLIGHT_REPORT.json`

## Recommended next governed phase

**MAI-07R3F-SEAL-LOCK-CHAIN** — produce an immutable `LOCKED_NOT_RUN` RC body snapshot (or append-only lock record with full body) proving `f4c07e24…`, without tuning runtime, then re-authorize frozen V2.

Do not fabricate a lock body after-the-fact solely to unblock without governed repair authorization.
