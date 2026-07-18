# MAI-07R3N3 Fresh-Holdout Identity-Invariant Corrective Report

**Engineering verdict:** `FAILED_HOLDOUT_QUALITY`  
**Date:** 2026-07-18  
**Phase:** `MAI-07R3N3-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE`  
**RC:** `MAI_07R3N3_FRESH_HOLDOUT_RELEASE_CANDIDATE_001`  
**Attempt:** `MAI_07R3N3_HOLDOUT_ATTEMPT_001`  
**Lock semantic sha256:** `0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b`

> **Do not repair R3N3 in-place.** This RC consumed its one holdout attempt and failed identity / finalizer gates. Next governed phase: `MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE` (new candidate version + fresh holdout). Do **not** implement R3N4 in this closeout.

## Non-claims

Engineering holdout qualification only. Does **not** grant linguist approval, product quality gates, production approval, frozen V2/V3 execution, Round B, or MAI-08 start. `FAILED_HOLDOUT_QUALITY` is **not** pack promotion. Private R3M/R3N2 case source texts are not reproduced here. R3N2/R3N3 prediction JSONL case surfaces were not read for dataset construction (aggregate-only proof on file).

## Candidate and active boundary

| Role | Pack / policy | Status |
|------|---------------|--------|
| R3N3 candidate | `mai-07.1.8-r3n3-identityinv` / policy `mai-07-r3n3.1.0.0` | Explicit activation only; **not promoted** |
| Parent (failed R3N2) | `mai-07.1.7-r3n2-freshholdout` / pack hash `170610284993061dd93efc3150f09f03ac2f1e3d69052c964cbe7c3aab61c1f3` | Consumed; guided implementation only — not release evidence |
| Active parent | `mai-07.1.3-r3f-sealnew` | Immutable default |
| Candidate pack content sha256 | `1268527c5c5d99e036628dc104340dafe297afadf9938a310a099a38f825c0e7` | Sealed; differs from active parent only by policy file |
| Finalizer | `mai-07-r3n3.finalizer.1.0.0` | R3N3-only reserved-identity path |
| Promotion overlay | disabled | Non-authoritative |

Default runtime construction continues to load R3F sealnew. R3N3 is reached only via `mai07_r3n3_candidate_runtime.py` (explicit candidate factory). No lexicon / target / resource spelling edits landed in R3N3.

## Authority chain (preserved)

| Authority | Full SHA-256 |
|-----------|--------------|
| R3N integrity closure semantic | `fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae` |
| Parent R3N2 lock semantic | `25f9eac74b8c9331a474c54ef2bb723157789aba00cab7bb8194dbb6b999c710` |
| R3N3 lock semantic | `0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b` |

R3N invalidation sidecar retained. R3N2 Attempt 001 consumed with `FAILED_HOLDOUT_QUALITY`. Dataset builder used aggregate-only inputs (`R3N3_AGGREGATE_ONLY_INPUT_PROOF.json`: `prediction_jsonl_opened=false`, `r3n2_reports_opened=false`).

## Freshness firewall

- New holdout seed family `20260723`; development seed `20260722`.
- Zero case-ID / normalized-text-hash / skeleton / template-family overlap with R3N and R3N2 holdout splits (`proof_passed=true`).
- Nine authorized corrective cases may reuse R3L/R3M source texts in DEVELOPMENT only; none appear in R3N3 holdout.

## Root cause (engineering)

The legacy finalize path could backfill identity at the end of the cap window and then evict it when reserving a Devanagari target slot. R3N3 introduced reserved-identity finalization (`finalize_candidates_r3n3`) that reserves exact raw identity first, then target Devanagari, then fills remaining slots by stable rank. Holdout still failed residual exact-identity gaps under multi-token cap-pressure and finalizer idempotence (1188/1200 on holdout; monotonic split failed only `finalizer_idempotence`).

## Holdout gate results (Attempt 001)

| Gate / population | Result | Threshold |
|-------------------|--------|-----------|
| `identity_retention` | **288 / 300** | == 1.0 **FAIL** |
| `exact_raw_identity` | **288 / 300** | == 1.0 **FAIL** |
| `exactly_one_identity` | **288 / 300** | == 1.0 **FAIL** |
| `identity_invariant_analogue` | **238 / 250** | == 1.0 **FAIL** |
| `cap_pressure_identity_retention` | **238 / 250** | == 1.0 **FAIL** |
| `finalizer_idempotence` | **1188 / 1200** | == 1.0 **FAIL** |
| `english_identity_top1` | 325 / 325 | >= 0.98 PASS |
| `false_devanagari_on_english` | 0 / 325 | <= 0.02 PASS |
| `romanized_script_at_5` | 200 / 200 | >= 0.95 PASS |
| `acronym_identity_top1` | 100 / 100 | == 1.0 PASS |
| `identifier_identity_top1` | 100 / 100 | == 1.0 PASS |
| `protected_identity` | 100 / 100 | == 1.0 PASS |
| `caps_ok` | 250 / 250 | == 1.0 PASS |

Supporting splits (`CONTEXT_COUNTERFACTUAL`, `OOV_CHALLENGE`, `SAFETY_CHALLENGE`, `IDENTITY_CAP_PRESSURE_CHALLENGE`, `DEVELOPMENT`) passed. Canonical/audit agreement held on DEVELOPMENT. Monotonic regression failed **only** `finalizer_idempotence`.

## Governance flags

| Flag | Value |
|------|-------|
| `engineering_verdict` | `FAILED_HOLDOUT_QUALITY` |
| `PASSED_CORRECTIVE_RC` | **not earned** |
| `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC` | **not earned** |
| `candidate_promoted` | false |
| `MAI-07` | `NEEDS_CORRECTIVE_WORK` |
| `MAI-08` | `NOT_STARTED` |
| `QUALITY_GATES_PASSED` | false |
| `LINGUIST_APPROVED` | false |
| `PRODUCTION_APPROVED` | false |

## Next phase

`MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE` — new candidate runtime version, fresh holdout seed/families, physical lock-before-holdout, one attempt only. Do **not** implement R3N4 in this closeout. Do **not** create RC_002 for R3N3.

## Related artifacts

- `evals/mai07_r3n3_fresh_holdout/`
- `docs/mokxya-ai/R3N3_IDENTITY_CANDIDATE_INVARIANT.md`
- `docs/mokxya-ai/R3N3_CANDIDATE_FINALIZATION_POLICY.md`
- `docs/mokxya-ai/baselines/MAI_07R3N3_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/decisions/ADR_0017_R3N3_RESERVED_IDENTITY_AND_FAILED_PARENT.md`
- `erp_bot/tests/oip/language_runtime/test_mai07_r3n3_fresh_holdout.py`
