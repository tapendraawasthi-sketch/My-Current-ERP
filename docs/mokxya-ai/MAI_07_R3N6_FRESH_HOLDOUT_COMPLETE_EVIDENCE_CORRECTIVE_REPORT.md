# MAI-07R3N6 Fresh-Holdout Complete-Evidence Corrective Report

**Engineering verdict:** `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC`  
**Date:** 2026-07-18  
**RC:** `MAI_07R3N6_FRESH_HOLDOUT_RELEASE_CANDIDATE_004`  
**Attempt:** `MAI_07R3N6_HOLDOUT_ATTEMPT_004` (consumed exactly once; chain bound)

## Scope and non-claims

R3N6 is an evidence-authority correction under ADR_0020. It preserves R3N5
target-span behavior while requiring independent canonical/audit scoring of
every metric (including `split_expected_pass`) and attempt-time hash binding of
all 15 verdict-bearing outputs. It does not add lexicon entries, change
accounting behavior, promote a runtime, grant linguist approval, pass the parent
MAI-07 gate, authorize production, or start MAI-08.

## Verdict and governance

| Field | Value |
|---|---|
| Engineering verdict | `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC` |
| Engineering authority | Final verified complete chain only |
| Candidate runtime | `mai-07.1.11-r3n6-chaincomplete` |
| Candidate policy | `mai-07-r3n6.1.0.0` |
| Candidate promoted | false |
| Active runtime | `mai-07.1.3-r3f-sealnew` (unchanged) |
| Overlay | false |
| `QUALITY_GATES_PASSED` | false |
| `LINGUIST_APPROVED` | false |
| `PRODUCTION_APPROVED` | false |
| MAI-07 | `NEEDS_CORRECTIVE_WORK` |
| MAI-08 | `NOT_STARTED` |
| Next governed phase | `MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE` |

## Parent invalidation

R3N5 release authority remains withdrawn:

- Verdict: `INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED`
- Artifact: `evals/mai07_r3n5_fresh_holdout/MAI_07R3N5_INTEGRITY_INVALIDATION.json`
- Raw SHA-256: `8d7b26bbcd813c79d8a4568acf096dfe7455ef1e1b1df3ab7367c811a293a1e2`
- Semantic SHA-256: `204665a84c076c5193038b11ae058b746b66101c2fb33332d32716d7dc2d5353`

R3N6 authenticates that artifact by fixed hashes before lock and holdout.
R3N5 was not repaired or rerun in place.

Note: after invalidation, `mai07_r3n5_candidate_runtime.py` drifted from its
R3N5 lock hash (`58135526…` → `dce2ba28…`). Live invalidation recomputation no
longer equals the stored append-only artifact, but the invalidation JSON itself
remains byte-authentic under the fixed hashes above.

## RC lineage (harness-only; no threshold/runtime retune)

| RC / Attempt | Disposition |
|---|---|
| RC_001 / ATTEMPT_001 | Crashed pre-score (`_load_attested_attempt_inputs` 5-tuple unpack) |
| RC_002 | Locked then never attempted (lock-record parent/provenance mismatch) |
| RC_003 / ATTEMPT_003 | Scored all splits; chain binding failed (`expected_cases_by_split` + `NOT_APPLICABLE` gate outcome) |
| RC_004 / ATTEMPT_004 | Passed with complete verified chain |

Shared ATTEMPT_003 report/prediction files were archived under
`evals/mai07_r3n6_fresh_holdout/archive/attempt_003/` before ATTEMPT_004.

## Evidence identity (RC_004)

| Artifact | Hash |
|---|---|
| Lock semantic | `cdae150ce30a120a18f53c6be418fd8ed1be48d0ebb152800a087ca909ca044a` |
| Lock raw | `604e32daaf4aa3ebe12dc2bd07d704e5471ad4b4cb6ffec87bfd2248b13ea5d6` |
| Chain raw | `b1c7c8f4137e7f3a88d02ca59e7e09a2a657ec5e9463d7328fa86e81243ba11c` |
| Candidate pack content | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` |

## Critical holdout metrics (canonical)

| Metric | Result |
|---|---|
| identity_retention | 850/850 |
| exact_raw_identity | 850/850 |
| exactly_one_identity | 850/850 |
| identity_invariant_analogue | 350/350 |
| cap_pressure_identity_retention | 350/350 |
| finalizer_idempotence | 2475/2475 |
| path_finalization_coverage | 2475/2475 |
| anchor_validity | 850/850 |
| split_expected_pass | 2475/2475 |

All six holdout splits passed (`HOLDOUT_VALIDATION`, `SAFETY_CHALLENGE`,
`CONTEXT_COUNTERFACTUAL`, `OOV_CHALLENGE`, `MONOTONIC_REGRESSION`,
`IDENTITY_ANCHOR_CHALLENGE`). Output binding count = 15. Chain verification
`ok=true`.

## What remains open

1. Genuine independent human / professional-linguist V3 Round A/B review into
   the official inbox (R3O). AI-assisted packets do not close that gate.
2. Parent MAI-07 remains `NEEDS_CORRECTIVE_WORK`.
3. MAI-08–25 remain `NOT_STARTED`. No MAI-25→MAI-26 handoff exists.

## Explicit non-claims

- Not a production approval.
- Not a linguist approval.
- Not a quality-gates pass for parent MAI-07.
- Not a runtime promotion (`ENABLE_PROMOTION_OVERLAY` remains false).
- Not authorization to implement MAI-26–53 planning packets.
