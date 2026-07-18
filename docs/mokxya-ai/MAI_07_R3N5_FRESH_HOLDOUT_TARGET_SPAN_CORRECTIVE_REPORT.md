# MAI-07R3N5 Fresh-Holdout Target-Span Corrective Report

**Engineering verdict:** `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC`  
**Date:** 2026-07-18  
**RC:** `MAI_07R3N5_FRESH_HOLDOUT_RELEASE_CANDIDATE_001`  
**Attempt:** `MAI_07R3N5_HOLDOUT_ATTEMPT_001` (consumed exactly once)

## Scope and non-claims

R3N5 corrects the coupled R3N4 evaluation failure by binding every evaluated
target to an immutable raw Unicode code-point interval. It does not add lexicon
entries, change accounting behavior, promote a runtime, grant linguist approval,
pass the parent MAI-07 gate, authorize production, or start MAI-08.

## Verdict and governance

| Field | Value |
|---|---|
| Engineering verdict | `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC` |
| Candidate runtime | `mai-07.1.10-r3n5-targetspan` |
| Candidate policy | `mai-07-r3n5.1.0.0` |
| Candidate promoted | false |
| Active runtime | `mai-07.1.3-r3f-sealnew` (unchanged) |
| `QUALITY_GATES_PASSED` | false |
| `LINGUIST_APPROVED` | false |
| `PRODUCTION_APPROVED` | false |
| MAI-07 | `NEEDS_CORRECTIVE_WORK` |
| MAI-08 | `NOT_STARTED` |
| Next governed phase | `MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE` |

## Failure diagnosis and correction

R3N4 passed its 500-case identity-anchor challenge but missed eight holdout gates
by the same 23 cases. R3N5 treated that coupled signature as target-selection and
evaluation-path authority drift, not lexicon evidence. R3N4 prediction case
surfaces were not opened for corrective design.

`TargetSpanV1` now binds:

- raw start/end in Unicode code points;
- exact raw surface;
- source-text and surface SHA-256 digests;
- explicit schema and offset unit.

Both canonical and independently implemented audit scorers fail closed on stale,
missing, coercive, duplicated, or wrong-runtime target evidence. Agreement is
required per case and across full metric/gate semantics.

## Dataset and freshness

| Split | Cases |
|---|---:|
| Development | 900 |
| Holdout validation | 2,475 |
| Safety challenge | 400 |
| Context counterfactual | 300 |
| OOV challenge | 100 |
| Monotonic regression | 400 |
| Identity-anchor challenge | 500 |
| **Total** | **5,075** |

All 5,075 target contracts validate and map to exactly one analyzer span.
R3N4 input splits were used only for one-way freshness hashes. Prior prediction
JSONL was not opened. All cases are `prohibited_for_training=true`.

## Development gate

- 900 cases scored before lock.
- Canonical scorer passed.
- Independent audit scorer passed.
- Per-case agreement passed.
- Aggregate metric/gate semantic agreement passed.
- Deterministic repeat observations passed.

## Lock and attempt chain

| Artifact | SHA-256 |
|---|---|
| LOCKED_NOT_RUN semantic | `80bb914f01cc365582177592516ec2bb9e519f4f17a3456b1a2bd48d053af907` |
| Physical lock file | `743c34b9f7235c6fb6e32990ee413be89f76c4ee6508df1f220d9e94773dcb07` |
| Candidate resource content | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` |

The lock was dual-built in a temporary directory, verified, and only then
written to the immutable final path. Attempt and chain bind the physical lock
hash, while semantic lineage binds the semantic hash. A second one-shot is
refused with `attempt_already_consumed`.

## One-shot results

All six governed holdout/support splits passed, including explicit
`split_expected_pass` enforcement.

| Critical gate | Result |
|---|---:|
| Identity retention | 850/850 |
| Exact raw identity | 850/850 |
| Exactly one identity | 850/850 |
| Identity-invariant analogue | 350/350 |
| Cap-pressure identity retention | 350/350 |
| Finalizer idempotence | 2,475/2,475 |
| Path-finalization coverage | 2,475/2,475 |
| Anchor validity | 850/850 |
| Romanized Devanagari candidate at 5 | 200/200 |
| English identity top-1 | 200/200 |

## Verification

- R3N5 post-holdout suite: **36 passed**.
- Complete language-runtime suite: **779 passed, 6 skipped**.
- Append-only chain verification: passed.
- Duplicate attempt refusal: passed.
- Active runtime/resource and overlay state: unchanged.

## Next phase and blocker

The corrective engineering RC is earned. The next phase is
`MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE`.

R3O requires genuinely independent human review and professional-linguist
evidence where the governance contract requires it. AI-assisted/user-accepted
artifacts cannot be relabeled as independent evidence. Therefore MAI-07 remains
`NEEDS_CORRECTIVE_WORK`, and MAI-08 remains dependency-blocked.
