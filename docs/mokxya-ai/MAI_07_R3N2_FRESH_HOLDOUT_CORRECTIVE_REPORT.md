# MAI-07R3N2 Fresh-Holdout Policy-Conformance Corrective Report

**Engineering verdict:** `FAILED_HOLDOUT_QUALITY`  
**Date:** 2026-07-18  
**Phase:** `MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE`  
**RC:** `MAI_07R3N2_FRESH_HOLDOUT_RELEASE_CANDIDATE_001`  
**Attempt:** `MAI_07R3N2_HOLDOUT_ATTEMPT_001`  
**Lock semantic sha256:** `25f9eac74b8c9331a474c54ef2bb723157789aba00cab7bb8194dbb6b999c710`

> **Do not repair R3N2 in-place.** This RC consumed its one holdout attempt and failed identity gates. Next governed phase: `MAI-07R3N3-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE` (new candidate version + fresh holdout).

## Non-claims

Engineering holdout qualification only. Does **not** grant linguist approval, product quality gates, production approval, frozen V2/V3 execution, Round B, or MAI-08 start. `FAILED_HOLDOUT_QUALITY` is **not** pack promotion. Private R3M/R3L case source texts are not reproduced here.

## Candidate and active boundary

| Role | Pack / policy | Status |
|------|---------------|--------|
| R3N2 candidate | `mai-07.1.7-r3n2-freshholdout` / policy `mai-07-r3n2.1.0.0` | Explicit activation only; **not promoted** |
| Invalidated parent | `mai-07.1.6-r3n-policyconf` / pack hash `4bbd3e97c99bf769e58924fc6a8d8a7de943db63700d2bdabf02b31236dd0d8c` | Invalidated by R3N integrity closure |
| Active parent | `mai-07.1.3-r3f-sealnew` | Immutable default |
| Candidate pack content sha256 | `170610284993061dd93efc3150f09f03ac2f1e3d69052c964cbe7c3aab61c1f3` | Sealed; differs from active parent only by policy file |
| Promotion overlay | disabled | Non-authoritative |

Default runtime construction continues to load R3F sealnew. R3N2 is reached only via `mai07_r3n2_candidate_runtime.py` (explicit candidate factory). No lexicon / target / resource spelling edits landed in R3N2.

## Authority chain (preserved)

| Authority | Full SHA-256 |
|-----------|--------------|
| R3M closure semantic | `f39432c6e085c89964e2551fe27921d32c79235061fea218262f6d3093e00afd` |
| R3N integrity closure semantic | `fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae` |

R3N invalidation sidecar retained. Historical R3N RC_002 bytes preserved but not eligible for release authority.

## Freshness firewall

- New holdout seed family `20260721`; development seed `20260720`.
- Zero case-ID, normalized-text, skeleton, and template-family overlap with R3N holdout splits.
- Nine authorized corrective cases may reuse R3L/R3M source texts in DEVELOPMENT only; none appear in R3N2 holdout.
- Vocabulary token overlap honestly declared (123 shared tokens); not claimed zero.

## Holdout gate results (Attempt 001)

| Gate / population | Result | Threshold |
|-------------------|--------|-----------|
| `identity_retention` | **148 / 150** | == 1.0 **FAIL** |
| `identity_invariant_analogue` | **98 / 100** | == 1.0 **FAIL** |
| `english_identity_top1` | 275 / 275 | >= 0.98 PASS |
| `romanized_script_at_5` | 200 / 200 | >= 0.95 PASS |
| `acronym_identity_top1` | 100 / 100 | == 1.0 PASS |
| `identifier_identity_top1` | 100 / 100 | == 1.0 PASS |
| `protected_identity` | 100 / 100 | == 1.0 PASS |
| `acronym_identifier_analogue` | 75 / 75 | == 1.0 PASS |
| `english_guard_analogue` | 100 / 100 | >= 0.98 PASS |
| `caps_ok` | 100 / 100 | == 1.0 PASS |

Supporting splits (`CONTEXT_COUNTERFACTUAL`, `OOV_CHALLENGE`, `MONOTONIC_REGRESSION`, `SAFETY_CHALLENGE`, `DEVELOPMENT`) passed. Canonical/audit agreement held on DEVELOPMENT.

## Root cause (engineering)

Identity retention and identity-invariant-analogue gates failed under cap-pressure holdout analogues: two identity-retention cases and two invariant-analogue cases lost top-1 identity when candidate-cap pressure forced non-identity transliteration targets. English, romanized, acronym, identifier, and protected lanes passed at full strength.

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

`MAI-07R3N3-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE` — new candidate runtime version, fresh holdout seed/families, physical lock-before-holdout, one attempt only. Do **not** implement R3N3 in this closeout. Do **not** create RC_002 for R3N2.

## Related artifacts

- `evals/mai07_r3n2_fresh_holdout/`
- `docs/mokxya-ai/R3N2_FRESH_HOLDOUT_PROTOCOL.md`
- `docs/mokxya-ai/R3N2_MINIMUM_POPULATION_POLICY.md`
- `docs/mokxya-ai/baselines/MAI_07R3N2_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/decisions/ADR_0016_R3N2_INVALIDATED_PARENT_AND_FRESH_HOLDOUT.md`
- `erp_bot/tests/oip/language_runtime/test_mai07_r3n2_fresh_holdout.py`
