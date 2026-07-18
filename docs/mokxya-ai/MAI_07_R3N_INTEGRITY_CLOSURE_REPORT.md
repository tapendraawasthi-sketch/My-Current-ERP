# MAI-07R3N Integrity Closure Report

**Phase:** `MAI-07R3N-INTEGRITY-CLOSURE`  
**Date:** 2026-07-18  
**Primary verdict:** `INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`  
**`PASSED_CORRECTIVE_RC` remains valid:** `false` (do not restore)

## Non-claims

This phase is forensic and read-only. No holdout predictions were regenerated. Lock bodies, attempt bodies, and prediction files were not rewritten. Active runtime remains `mai-07.1.3-r3f-sealnew`. MAI-08 remains `NOT_STARTED`. R3O was not started. R3N2 is specified only — not implemented.

## Summary

RC_002’s green Attempt-002 metrics do **not** constitute an independently evaluated corrective RC. After Attempt 001 failed, runtime coalescing, scorer empty-population requiredness, and the holdout romanized sentence were changed; Attempt 002 then reused the same case-ID set, template-family set, and holdout seed family (7/8 exact texts; 8/8 families). Candidate version string `mai-07.1.6-r3n-policyconf` was reused after semantic runtime change. `authorized_code_corrective` transitioned `INVALID_REQUIRED_POPULATION` → `NOT_APPLICABLE` after observation.

**`PASSED_CORRECTIVE_RC` for RC_002 is withdrawn for release authority.** Historical bytes are retained; append-only invalidation sidecar recorded.

## 0. Semantic lock integrity (resolved)

| Flag | Value |
|------|--------|
| `lock_chain_semantic_integrity` | `true` |
| `lock_body_post_closeout_mutation` | `false` |
| `raw_file_hash_is_lock_authority` | `false` |

- RC_001 / RC_002 semantic lock hashes match attempt parents under `compute_rc_semantic_body_sha256` (pretty semantic body; self-hash keys excluded).
- Generic raw-file hashing is **not** the RC lock semantic contract.
- `lock*_raw_ok=false` is the known self-referential raw-field quirk, not post-closeout mutation.
- Evidence: `evals/mai07_r3n_integrity_closure/LOCK_CHAIN_SEMANTIC_INTEGRITY.json`, `LOCK_HASH_BINDING_NOTE.json`.

| RC | Lock-chain semantic | Matches attempt parent |
|----|---------------------|------------------------|
| RC_001 | `98822fcf9175de1f048f6e47026e568438bcd34cce588da620d97f68c1d3374b` | yes |
| RC_002 | `539ea32caa270060c9de28b35e989cb7bd6a1ade9670264b8e143977b0d3b24a` | yes |

## Secondary reasons

1. `HOLDOUT_CONTAMINATED`
2. `POST_OBSERVATION_GATE_SEMANTICS_CHANGE` (`POST_OBSERVATION_GATE_SEMANTICS_CHANGE=true`)
3. `CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE` (`CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE=true`)
4. `MINIMUM_DENOMINATOR_POLICY_MISSING` (`MINIMUM_DENOMINATOR_POLICY_MISSING=true`)
5. `CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT` (`CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT=true`)

## 1. Holdout reuse

### Attempt 001 hashes

| Surface | SHA-256 |
|---------|---------|
| raw | `c5a472c48836fdfeec7aac2dcaa36dffbf72616ad05195b12b0a35d12f83371b` |
| canonical semantic | `569cda92153ba75151e83367b5b4dddf99396728f62d951fb4105fab47b6c3a6` |
| case-ID set | `0a7f3bf3e6b4988e36ccdaab815230f2fa47ba78103261dd690f0ebfd4bc5ebb` |
| normalized-text set | `23bad91c869a004b6cede27ed067ebff19f78ae0c32489b233d64d6d8a68a5b8` |
| template-family set | `15b2118d812f246b2b12f3325acb750709f786f423f5979bcf45138b0045bdd9` |

### Attempt 002 hashes

| Surface | SHA-256 |
|---------|---------|
| raw | `192dd0812a919e17ab3654f600ced33be9b5dc6e0ab9112da60089c75744b4d7` |
| canonical semantic | `7e34140fe4f9d0f1822f8b7ec530f1fe74e1e5b7bf89c2d131fd1afdb08ac951` |
| case-ID set | `0a7f3bf3e6b4988e36ccdaab815230f2fa47ba78103261dd690f0ebfd4bc5ebb` |
| normalized-text set | `ee53cd2fab86a0c27cfefff91b3dcc42d1c72d1d9150f0f04f838e9dcdcb0c4e` |
| template-family set | `15b2118d812f246b2b12f3325acb750709f786f423f5979bcf45138b0045bdd9` |

### Shared / overlap

- **Shared case IDs (8):** `R3N-HLD-0001-528f7edc`, `R3N-HLD-0002-75481ef5`, `R3N-HLD-0003-e21ac004`, `R3N-HLD-0004-60255ad2`, `R3N-HLD-0005-767ec55a`, `R3N-HLD-0006-44f35934`, `R3N-HLD-0007-6a40f195`, `R3N-HLD-0008-9625ec9f`
- **Shared normalized texts:** 7 of 8 (one romanized body changed sulka→garna)
- **Shared template families (8):** `r3n_hld_acronym`, `r3n_hld_cap_pressure`, `r3n_hld_english_identity`, `r3n_hld_identifier`, `r3n_hld_identity_retention`, `r3n_hld_protected`, `r3n_hld_romanized_nepali`, `r3n_hld_shared_ambiguous`
- **Attempt 002 executed the same eight holdout case IDs:** yes
- **Reused cases already had Attempt 001 predictions:** yes
- Seed family unchanged: `HOLDOUT_FAMILY=20260719`

## 2. Post-Attempt-001 runtime changes

Material semantic runtime change between RC_001 and RC_002 under the **same** candidate version string `mai-07.1.6-r3n-policyconf`:

| Lane | Changed after Attempt 001? | Motivated by Attempt 001? |
|------|----------------------------|---------------------------|
| Coalescing (`coalesce_structural_identifiers`) | yes | yes (“missing coalesce” / identifier span_found=false) |
| English-guard | no (post-001) | — |
| Identity-invariant | no (post-001) | — |
| Acronym/identifier | yes (coalesce path) | yes |
| Configuration / scorer contracts | yes | yes (empty required pop) |
| Candidate pack content hash | unchanged pack id under reused version string | — |
| Holdout romanized body | yes (sulka→garna) | yes (weak romanized) |

`CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE=true`. History not rewritten.

## 3. Scorer and population changes

| Surface | Finding |
|---------|---------|
| Scorer version string | unchanged label `mai-07-r3n.scorer.1.0.0` |
| Scorer / audit scorer / scoring-contract source | changed after Attempt 001 (empty-pop → NOT_APPLICABLE) |
| Threshold JSON hash | stable; does **not** override scorer/population semantics |
| Population manifest hash | none existed (requiredness in scorer/contracts only) |

**Did `authorized_code_corrective` change from required empty failure to `0/0 NOT_APPLICABLE` after Attempt 001?**  
**Yes.** → `POST_OBSERVATION_GATE_SEMANTICS_CHANGE=true`

| Attempt | applicability | N/D |
|---------|---------------|-----|
| 001 | `INVALID_REQUIRED_POPULATION` | 0/0 |
| 002 | `NOT_APPLICABLE` | 0/0 |

## 4. Candidate version authority

RC_001 and RC_002 used different runtime semantics (coalesce) but the same version string `mai-07.1.6-r3n-policyconf` → `CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE=true`.

## 5. Denominator adequacy

Reported denominators include English/Romanized/acronym/identifier/protected at 1 and `authorized_code_corrective` at 0.

| Question | Answer |
|----------|--------|
| Exact minimums explicitly accepted before execution? | **no** → `MINIMUM_DENOMINATOR_POLICY_MISSING=true` |
| All three 5/3/1 corrective lanes had independent holdout analogues? | **no** (1-case analogues; authorized 0/0) |
| Was `0/0 NOT_APPLICABLE` authorized before Attempt 001? | **no** |
| Holdout satisfies “sufficient non-empty denominators”? | **no** → `CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT=true` |

## 6. Final validity rule

All PASSED_CORRECTIVE_RC preconditions fail (holdout not fresh; material overlap; post-observation gate change; version reuse; denominators not predeclared/satisfied).

**Primary:** `INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`  
**`passed_corrective_rc_remains_valid`:** `false`

## 7. Preservation

- Both attempts and lock bodies preserved byte-for-byte
- Semantic lock-chain validation preserved / resolved true
- No predictions generated; no holdout rerun; no runtime/resource mutation
- Append-only invalidation sidecars updated
- Active R3F runtime unchanged; MAI-07=`NEEDS_CORRECTIVE_WORK`; MAI-08=`NOT_STARTED`

## Authorities (unchanged)

| Item | Value |
|------|--------|
| R3M closure | `f39432c6e085c89964e2551fe27921d32c79235061fea218262f6d3093e00afd` |
| Active runtime | `mai-07.1.3-r3f-sealnew` |
| Active resource | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |
| RC_001 lock semantic | `98822fcf9175de1f048f6e47026e568438bcd34cce588da620d97f68c1d3374b` |
| RC_002 lock semantic | `539ea32caa270060c9de28b35e989cb7bd6a1ade9670264b8e143977b0d3b24a` |

## Invalidation

- Sidecar: `evals/mai07_r3n_policy_conformance/MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002.HISTORICAL_INVALIDATION_SIDECAR.json`
- Evidence tree: `evals/mai07_r3n_integrity_closure/`
- `candidate_promoted=false`
- `candidate_not_eligible_for_frozen_v3=true`

## Next governed phase (not executed)

`MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE`  
Protocol: `evals/mai07_r3n_integrity_closure/R3N2_FRESH_HOLDOUT_PROTOCOL.json`

## Governance

| Flag | Value |
|------|--------|
| QUALITY_GATES_PASSED | false |
| LINGUIST_APPROVED | false |
| PRODUCTION_APPROVED | false |
| MAI-07 | NEEDS_CORRECTIVE_WORK |
| MAI-08 | NOT_STARTED |
