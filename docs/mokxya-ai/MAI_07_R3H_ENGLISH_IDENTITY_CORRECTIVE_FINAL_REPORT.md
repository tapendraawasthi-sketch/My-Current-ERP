# MAI-07R3H English Identity Corrective — Final Closeout Report

**Phase:** `MAI-07R3H-ENGLISH-IDENTITY-CORRECTIVE`  
**Report type:** Evidence collection / reporting only (`MAI-07R3H-CLOSEOUT-REPORT-ONLY`)  
**Report date:** 2026-07-16  
**Frozen V2 opened in this phase or this closeout:** **no**  
**MAI-08 implemented/touched:** **no**  
**MAI-07R3H2 implemented in this turn:** **no**

---

## Authoritative evidence sources

Consumed holdout quality numbers are taken from:

1. `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.QUALIFICATION_RESULT.json`
2. `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.CHAIN_MANIFEST.json`
3. `evals/mai07_r3h_english_identity/MAI_07R3H_HOLDOUT_ATTEMPT_001.json`
4. `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json`
5. `evals/mai07_r3h_english_identity/MAI_07R3H_THRESHOLDS.json`

**Important integrity note:** After RC lock / one-shot holdout, the R3H focused-test fixture can call `write_datasets()` and `run_split("HOLDOUT_VALIDATION")`, regenerating dataset JSONL bodies and on-disk score/prediction reports. Therefore:

- locked hashes inside `LOCKED_NOT_RUN.json` remain the lock-time claims;
- current on-disk `*.jsonl` / `reports/MAI_07R3H_HOLDOUT_VALIDATION_*` hashes may **not** equal the locked attempt;
- this report treats **CHAIN / QUALIFICATION / ATTEMPT** as the consumed one-shot authority and marks drifted on-disk score files as non-authoritative.

Verified at closeout:

| Artifact | Closeout SHA-256 | Notes |
|----------|------------------|-------|
| `MAI_07R3H_THRESHOLDS.json` | `76bcb3d9afacd60796f08b053b6ecc3bdc676971fd2d063fffaabfecfcb57f06` | Matches lock `threshold_manifest_sha256` |
| `LOCKED_NOT_RUN.json` (file bytes) | `de7eddc57e67a1c0631f6d144966e9b59430cf562bdeecd0f2465f5301bc0c1e` | Matches `LOCK_RECORD.rc_manifest_raw_sha256` |
| Lock semantic hash (body field / chain) | `7870e554f6b71d15d4bb93e1a1816993e441add2a00f281f44580708645ac725` | Stable across lock/attempt/chain/qualification |
| Body-embedded `rc_manifest_raw_sha256` | `44473ba9fbd64994fffbbe1a38fd0c25457f10e36f0c2f1349bba3ca17419690` | Used as `parent_lock_raw_sha256` by attempt/chain; differs from current file raw hash above |
| Current `holdout_validation.jsonl` | `b0c83b20cb299635712cdc958d9e9b983dd9f9139439f9e25e031e87364f0fda` | **≠** locked `8742afb262e0bedb05c09aa2c92644a3726069fc249b53509dfd8e0d8e2a4211` |
| Current holdout predictions JSONL | `5979adf25f677b4118bac6f6903b561dfa48fa4ab4a4753cb17beea505d63fff` | **≠** attempt `7f5540770d68a5e04522ffbe600504519f5c21b75c0ed3a97e51528c2665a27c` |
| Current dataset manifest file | `fd9401ba4951c96e83a269fe41424e72d68204c12bbb9fb3c5a6113ff2f08d09` | **≠** locked `f00fc55e506a4913a0c3f717d6047f30db6694c6256f27b2c40bf353660730d5` |

---

## 1. Verdict and approval flags

| Flag | Value |
|------|-------|
| Phase verdict | **`FAILED_HOLDOUT_QUALITY`** |
| `QUALITY_GATES_PASSED` | **false** |
| `AUTOMATED_ENGINEERING_GATES_PASSED` (MAI-07 overall) | **false** |
| `LINGUIST_APPROVED` | **false** |
| `PRODUCTION_APPROVED` | **false** |
| MAI-07 status | **`NEEDS_CORRECTIVE_WORK`** |
| MAI-08 status | **`NOT_STARTED`** |
| Frozen V2 rerun | **not performed** |
| RC engineering lock created | **yes** (`LOCKED_NOT_RUN`) |
| RC quality qualification | **rejected by holdout gates** |
| Recommended next phase | **`MAI-07R3H2-SHARED-COLLISION-CORRECTIVE`** |

---

## 2. Pre-edit / pre-phase discovery

Recorded pre-R3H baseline (from phase inputs / baseline summary):

- `language_runtime`: **370 passed, 6 skipped, 0 failed**
- Active runtime default: `mai-07.1.3-r3f-sealnew`
- Active resource content hash: `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930`
- Overlay disabled
- Seal contract: `mai-07-artifact-seal-contract.2.0.0`
- Latest frozen attempt: MAI-07R3G-REAUTHORIZED-002 = `FAILED_QUALITY` (English identity 98/102; false Devanagari 4/102); attempt consumed; rerun prohibited
- Aggregate-only frozen fact used: English identity numerators identical to R3E; **no frozen case bodies inspected**

AGENTS.md read: repository root `AGENTS.md` (Lovable history + Sutra ERP UI rules). Unrelated dirty/untracked work preserved; no destructive git operations.

---

## 3. Pre/post skip inventory

### Pre-R3H

- 370 passed / 6 skipped / 0 failed

### Post-R3H / closeout revalidation

- 381 passed / 6 skipped / 0 failed
- Delta: **+11 passing tests** from `test_mai07_r3h_corrective.py`
- Skips unchanged (historical only):

1. `test_mai07_r1_ranker.py:132` — `HISTORICAL_R2_OVERLAY_EXPECTATION` for `english kar module`
2. `test_mai07_r1_ranker.py:236` — R1 disposition superseded by R2
3. `test_mai07_r1_ranker.py:241` — R1 disposition superseded by R2
4. `test_mai07_r1_ranker.py:246` — R1 disposition superseded by R2
5. `test_mai07_r2_overlay.py:86` — `HISTORICAL_R2_OVERLAY_EXPECTATION` for `paisako`
6. `test_mai07_r2_overlay.py:146` — `HISTORICAL_R2_OVERLAY_EXPECTATION` lexicon promotion via failed R2 overlay

No new unexplained skips or failures in `language_runtime`.

---

## 4. Frozen-data firewall proof

Evidence:

- Root-cause report firewall statement: no frozen V2 bodies / R3E-R3G prediction rows / blind mapping / failed frozen surfaces used.
- Focused tests:
  - `test_firewall_tokens_absent` scans R3H strict files for forbidden path tokens (`evals/mai07/frozen_v2`, R3E/R3G prediction names, blind mapping, etc.).
  - `test_firewall_imports_absent` forbids importing `eval_mai07_r3c` / `eval_mai07_r3e` / `eval_mai07_r3g_reauthorized_002`.
- Dataset manifest flags: `frozen_v2_case_bodies_not_used=true`, `frozen_predictions_not_used=true`, `gold_labels_generated_from_runtime_predictions=false`, `prohibited_for_training=true`.
- Lock body: `no_frozen_v2_run=true`, `no_frozen_prediction_use=true`.
- Attempt: `frozen_v2_opened=false`, `prohibited_rerun=true`.

Byte-hashing of historical frozen **meta/prediction files** was performed for immutability only; case contents were not parsed.

---

## 5. Product / evaluator call-path audit

From `docs/mokxya-ai/MAI_07_R3H_ENGLISH_IDENTITY_ROOT_CAUSE_REPORT.md` (code inspection + non-frozen probes):

| Path | Entry | Transliteration authority |
|------|-------|---------------------------|
| A. Product ingress | `oip_chat_ingress.build_canonical_ai_request` → MAI-05/06 → `attach_transliteration_to_frame` | Same service |
| B. Canonical service | `transliteration_service.transliterate_frame` | Eligibility → generate → rank → identity disposition → finalize/cap |
| C. Direct/unit | direct `attach_transliteration_to_frame` | Same service |
| D. Non-frozen evaluator | R3F/R3H evaluators analyze text then attach transliteration | Same service |
| E. Frozen runner structure | orchestration-only inspection | Same attach path; **no frozen bodies read** |

Findings:

1. R3F/R3H guard is invoked on product, direct, and evaluator paths (not bypassed).
2. Reorder historically ran after ranking on a pre-capped list; R3H moved preference before final cap preservation.
3. No later serializer undid reorder.
4. Evaluator does not rebuild candidates through a second stack.
5. Policy/guard version metadata is present in R3H reports (`policy_version` / `guard_version`).
6–13. See root-cause report; primary defect is policy generalization + weak prior shared-collision holdout coverage, not path divergence.

Focused parity test `test_cross_path_parity_async` asserts ingress vs direct bundle equality for one non-frozen English sentence.

---

## 6. Evidence-based root cause

**Root cause class:** Policy generalization defect **plus** prior non-frozen dataset under-coverage of shared/borrowed collisions.

Not a path-integration bypass.

Supporting evidence:

- Call-path audit shows one transliteration service.
- Frozen aggregate fact (English 98/102; false-Dev 4/102 unchanged from R3E after R3F) indicates R3F holdout success did not transfer.
- R3H holdout then passes English/false-Dev safety but fails shared ambiguous-review and counterfactual pair gates — isolating remaining failure to shared-collision / review-metadata behavior.

Secondary evidenced issues (non-frozen only):

- `target_missing_from_top5_rate` numerator counts missing targets across **all** cases with gold Devanagari, while denominator is `len(clear_romanized_control)` only (`eval_mai07_r3h.aggregate`). This can fail even when clear-romanized recall@5 is perfect.
- `unresolved_shared_identity_review_accuracy` requires identity **and** `requires_review` metadata; observed **0** successes on holdout/safety/counterfactual ambiguous strata.
- Several architecture metrics in aggregate are hard-coded to 1.0 / harm hard-coded to 0 (see §28–29).

---

## 7. Corrective branch selected

**Selected:** Branch B — Policy Generalization Defect  

**Rejected:** Branch A — Path Integration Defect  

Reason: product/direct/evaluator paths already share the transliteration service; no bypass found.

Also rejected for this phase:

- frozen retune / frozen case mining
- stacking a second post-R3F guard
- MAI-08
- silent second holdout after failure

---

## 8. Canonical identity-policy architecture

Authority module: `english_identity_guard.py` (policy version `mai-07-r3h.1.0.0`)

Typed dispositions:

- `PROTECTED_IDENTITY_REQUIRED`
- `NAME_IDENTITY_REQUIRED`
- `ACRONYM_IDENTITY_REQUIRED`
- `ENGLISH_IDENTITY_REQUIRED`
- `ROMANIZED_TARGET_PREFERRED`
- `SHARED_CONTEXT_IDENTITY_PREFERRED`
- `SHARED_CONTEXT_TARGET_PREFERRED`
- `AMBIGUOUS_IDENTITY_FIRST_REVIEW`
- `KEEP_BASE_ORDER`
- `UNSUPPORTED`

Historical R3F enum aliases retained for backward-compatible tests.

Service integration (`transliteration_service.py`):

- over-generate ranks → apply identity disposition once → `_finalize_candidates` preserves identity and one Devanagari alternative within cap when available.

Resource policy file:

- source: `resources/r3h_english_identity_policy.json`
- sealed into pack as `r3f_english_identity_guard.json` under `sealed_packs/mai-07.1.4-r3h-englishid/`
- overlay remains disabled

Default module constants intentionally remain historical for compatibility:

- `RUNTIME_VERSION = mai-07.1.3-r3f-sealnew`
- `RESOURCE_PACK_VERSION = mai-07.1.3-r3f-sealnew`
- `ENGLISH_IDENTITY_GUARD_VERSION = mai-07-r3f.1.0.0` (module constant; R3H guard/policy versions are `mai-07-r3h.1.0.0` inside guard/pack)

---

## 9. Evidence precedence and reason codes

Precedence (fail-safe first): protected → acronym → name → English / shared-context lattice → Romanized preferred → ambiguous identity-first review → keep/unsupported.

Reason codes (reorder metadata):

- `R3H_PROTECTED_IDENTITY_REQUIRED`
- `R3H_ACRONYM_IDENTITY_REQUIRED`
- `R3H_NAME_IDENTITY_REQUIRED`
- `R3H_ENGLISH_IDENTITY_REQUIRED`
- `R3H_SHARED_CONTEXT_IDENTITY_PREFERRED`
- `R3H_SHARED_CONTEXT_TARGET_PREFERRED`
- `R3H_AMBIGUOUS_IDENTITY_FIRST_REVIEW`
- `R3H_KEEP_BASE_ORDER`
- `R3H_ROMANIZED_TARGET_PREFERRED`
- `R3H_UNSUPPORTED`

Policy rules of record (Option A):

- MAI-05 form alone is insufficient.
- Single lexicon hit alone is insufficient against contradictory strong context.
- Shared + English context → identity-first.
- Shared + Nepali context → eligible target-first.
- Shared + unresolved → identity-first + review metadata, retaining Devanagari in set/cap when available.

---

## 10. Cross-path parity results

| Evidence | Result |
|----------|--------|
| Focused test `test_cross_path_parity_async` | **PASS** (ingress bundle == direct service bundle) |
| Holdout aggregate field `cross_path_parity` | recorded **1/1** (hard-coded in `aggregate`) |
| Full multi-path harness across all sealed holdout rows comparing product/ingress/evaluator/RC runner fields | **NOT_EVIDENCED** as a separate sealed report beyond the focused test + hard-coded metric |

Engineering judgment for closeout: path integration is not the failing gate class; English/shared policy quality is.

---

## 11. Dataset splits, counts and hashes

### Coverage (current manifest counts; minimums_met=true)

| Stratum | Count | Minimum |
|---------|------:|--------:|
| English identity cases | 906 | 800 |
| Shared collisions | 319 | 300 |
| Clear Romanized | 688 | 300 |
| Counterfactual pairs | 290 | 250 |
| OOV | 260 | 200 |
| Technical English | 210 | 200 |
| Names/acronyms/identifiers | 472 | 200 |
| Protected spans | 440 | 200 |
| Ambiguous | 377 | 150 |
| Multi-token cases | 3223 | ratio ≥0.7 |

### Split totals (current manifest)

| Split | Cases | Current file SHA-256 | Locked fresh_* SHA-256 |
|-------|------:|----------------------|------------------------|
| DEVELOPMENT | 401 | `d5514295aafcd2847b3c196ee254a31c9d4d948256f9f99054d94758310d4ee4` | `a69fa49a8390577c3700d3fe9f0856cd6e409d2a791f08fa8848ac7d6315b7a8` |
| HOLDOUT_VALIDATION | 711 | `b0c83b20cb299635712cdc958d9e9b983dd9f9139439f9e25e031e87364f0fda` | `8742afb262e0bedb05c09aa2c92644a3726069fc249b53509dfd8e0d8e2a4211` |
| SAFETY_CHALLENGE | 885 | `adb7d3806489fc2dee284608491712fd2c0fa56c4cdf288c4492d8c9f6f734cd` | `f97997790effb74a4d79facc4d45bd1578e5cf9a48711cc082991ed1cb660561` |
| CONTEXT_COUNTERFACTUAL | 966 | `875c6ab3c049e2f40e6a27a5fcf1028b6263ffb13eab80ef6f4178a00a46be6a` | `cebb88a5b734dccd1042dcb1a62798f862d107fbf996f4a28e68aafea7422fd9` |
| OOV_GENERALIZATION | 260 | `fe30b98532100ba9da54020c68bcdabdec233fdfba4c899b0f1905fb3b716af4` | `e24e3e0947e605d6b7f2f6a445f72704d256f91765698184459d8c89a332610a` |

Locked dataset-manifest claim: `f00fc55e506a4913a0c3f717d6047f30db6694c6256f27b2c40bf353660730d5`  
Current manifest file hash: `fd9401ba4951c96e83a269fe41424e72d68204c12bbb9fb3c5a6113ff2f08d09` (**drift**)

Attempt prediction count for HOLDOUT_VALIDATION: **599** (not 711) — indicates the locked holdout evaluation used a filtered/sealed subset or then-current split size; authoritative attempt count is 599.

---

## 12. Leakage and structural-isolation results

| Claim | Evidence |
|-------|----------|
| `prohibited_for_training=true` | dataset manifest |
| Frozen bodies/predictions not used | manifest + firewall tests |
| Gold not from runtime predictions | manifest flag `false` |
| Dedicated machine-readable leakage report (sentence/lemma/template overlap matrix vs V1/R3D/R3F/R3H) | **NOT_EVIDENCED** as a standalone artifact |
| Structural isolation enforced in builder | asserted by builder/tests at minimums; full overlap matrix **NOT_EVIDENCED** |

---

## 13. Development results

| Item | Status |
|------|--------|
| DEVELOPMENT split exists (401 cases) | evidenced |
| Sealed DEVELOPMENT score report with full gate table | **NOT_EVIDENCED** |
| Development-only tuning log / metric dump | **NOT_EVIDENCED** |

Tuning was required to use DEVELOPMENT only before lock; no separate development score artifact was found under `evals/mai07_r3h_english_identity/reports/`.

---

## 14. Runtime / resource versions and hashes

### Default active path (module defaults; historical compatibility)

- Runtime: `mai-07.1.3-r3f-sealnew`
- Resource pack: `mai-07.1.3-r3f-sealnew`
- Content hash: `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930`
- Parent pack check `--check`: **ok**, dual-build identical

### R3H RC pack (used by locked holdout)

- Runtime/resource version claimed by lock/chain: `mai-07.1.4-r3h-englishid`
- Resource content SHA-256: `2a4599fe3fccb83257130407324321b4121e5c01fe6efcdc32406ebdcacded7e`
- Pack path: `erp_bot/src/oip/modules/language_runtime/transliteration/sealed_packs/mai-07.1.4-r3h-englishid/`
- Policy/guard version: `mai-07-r3h.1.0.0`
- Seal contract: `mai-07-artifact-seal-contract.2.0.0`
- Overlay: disabled
- `--check` / `--check-twice`: **ok**, dual-build identical, already sealed
- Manifest file SHA-256: `72e7115cc8d9c23d812b612c56839bc09e00e97462d17468112ce5a8e824ccb0`

**Conclusion:** R3H created and sealed a new pack version for the RC, but did **not** promote it to the default active module constants.

---

## 15. Property / metamorphic results

Focused test `test_property_cases_2000`:

- 2000 seeded cases
- Asserts candidate cap bound and deterministic re-run equality
- **PASS** (within focused suite)

Broader metamorphic properties 1–12 from the phase prompt are only partially covered by this 2000-case generator (English vs Romanized templates + determinism/caps). Full enumerated metamorphic matrix as a separate report: **partially evidenced in code/tests; not fully enumerated in a sealed metrics artifact**.

---

## 16. Threshold manifest and full hash

Path: `evals/mai07_r3h_english_identity/MAI_07R3H_THRESHOLDS.json`  
`threshold_id`: `MAI_07R3H_THRESHOLDS_V1`  
`locked_before_holdout_observation`: **true**  
SHA-256: **`76bcb3d9afacd60796f08b053b6ecc3bdc676971fd2d063fffaabfecfcb57f06`**

Key locked thresholds:

| Gate | Op | Threshold |
|------|----|----------:|
| overall_english_identity_top1 | >= | 0.99 |
| shared_collision_english_identity_top1 | >= | 0.98 |
| false_devanagari_on_clear_english | <= | 0.01 |
| technical_english_identity_top1 | >= | 0.98 |
| name_identity_top1 | == | 1.0 |
| acronym_identifier_identity_top1 | == | 1.0 |
| clear_romanized_target_top1 | >= | 0.95 |
| clear_romanized_target_recall_at_5 | >= | 0.98 |
| target_missing_from_top5_rate | <= | 0.02 |
| paired_counterfactual_accuracy | >= | 0.95 |
| unresolved_shared_identity_review_accuracy | >= | 0.98 |
| cross_path_parity | == | 1.0 |
| protected_span_mutations | == | 0 |
| raw_view_mutations | == | 0 |
| harm_count_clearly_romanized | == | 0 |

---

## 17. RC lock body and full hash

RC id: `MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001`  
Path: `.../MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json`  
Status: `LOCKED_NOT_RUN`  
`locked_before_holdout`: **true**

| Hash kind | Value |
|-----------|-------|
| Semantic | `7870e554f6b71d15d4bb93e1a1816993e441add2a00f281f44580708645ac725` |
| Body-embedded raw claim | `44473ba9fbd64994fffbbe1a38fd0c25457f10e36f0c2f1349bba3ca17419690` |
| Current file raw bytes | `de7eddc57e67a1c0631f6d144966e9b59430cf562bdeecd0f2465f5301bc0c1e` |

Lock record path: `...LOCK_RECORD.json`  
Locked at: `2026-07-16T09:09:21.212969+00:00`

---

## 18. Proof lock preceded holdout

| Event | Timestamp (UTC) |
|-------|-----------------|
| LOCK_RECORD `locked_at_utc` | `2026-07-16T09:09:21.212969+00:00` |
| HOLDOUT_ATTEMPT created | `2026-07-16T09:09:21.221491+00:00` |
| QUALIFICATION_RESULT created | `2026-07-16T09:09:27.273474+00:00` |

Attempt binds:

- `parent_lock_semantic_sha256 = 7870e554…`
- `parent_lock_raw_sha256 = 44473ba9…` (body-embedded claim)
- `prohibited_rerun = true`
- `status = COMPLETED`

Focused test `test_rc_lock_precedes_holdout` and `test_holdout_cannot_rerun` assert lock-before-run and no silent second holdout.

---

## 19. One-shot holdout attempt details

| Field | Value |
|-------|-------|
| Attempt id | `MAI_07R3H_HOLDOUT_ATTEMPT_001` |
| Command | `python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h --one-shot` |
| Split | `HOLDOUT_VALIDATION` |
| Prediction count | **599** |
| Predictions raw SHA-256 (attempt) | `7f5540770d68a5e04522ffbe600504519f5c21b75c0ed3a97e51528c2665a27c` |
| Predictions canonical SHA-256 (attempt) | `3dcd1c54bf1c449699e4135706285b18ce70e87ed35ab77159db19a843f7bea7` |
| Frozen opened | **false** |
| Consumed | **yes** (`prohibited_rerun=true`) |
| Qualification status | `FAILED_HOLDOUT_QUALITY` |

Companion sealed splits also scored under the same chain: SAFETY_CHALLENGE, CONTEXT_COUNTERFACTUAL, OOV_GENERALIZATION.

---

## 20. Complete holdout metrics (authoritative from QUALIFICATION / CHAIN)

Thresholds as locked. Values below are **HOLDOUT_VALIDATION** from qualification/chain (not the drifted on-disk score report).

| Gate | Numerator | Denominator | Value | Op | Threshold | Pass? |
|------|----------:|------------:|------:|----|----------:|:-----:|
| overall_english_identity_top1 | 356 | 356 | 1.0 | >= | 0.99 | **PASS** |
| shared_collision_english_identity_top1 | 10 | 10 | 1.0 | >= | 0.98 | **PASS** |
| false_devanagari_on_clear_english | 0 | 356 | 0.0 | <= | 0.01 | **PASS** |
| technical_english_identity_top1 | 70 | 70 | 1.0 | >= | 0.98 | **PASS** |
| name_identity_top1 | 6 | 6 | 1.0 | == | 1.0 | **PASS** |
| acronym_identifier_identity_top1 | 190 | 190 | 1.0 | == | 1.0 | **PASS** |
| clear_romanized_target_top1 | 229 | 229 | 1.0 | >= | 0.95 | **PASS** |
| clear_romanized_target_recall_at_5 | 229 | 229 | 1.0 | >= | 0.98 | **PASS** |
| target_missing_from_top5_rate | 43 | 229 | 0.18777292576419213 | <= | 0.02 | **FAIL** |
| paired_counterfactual_accuracy | 0 | 0 | 1.0* | >= | 0.95 | PASS* (vacuous on holdout split) |
| english_context_identity_accuracy | 10 | 10 | 1.0 | >= | 0.98 | **PASS** |
| nepali_context_target_accuracy | 229 | 229 | 1.0 | >= | 0.95 | **PASS**† |
| unresolved_shared_identity_review_accuracy | 0 | 19 | 0.0 | >= | 0.98 | **FAIL** |
| cross_path_parity | 1 | 1 | 1.0 | == | 1.0 | PASS‡ |
| policy_invocation_coverage | 599 | 599 | 1.0 | == | 1.0 | **PASS** |
| candidate_set_preservation | 1 | 1 | 1.0 | == | 1.0 | PASS‡ |
| caps_respected | 599 | 599 | 1.0 | == | 1.0 | **PASS** |
| deterministic_output | 1 | 1 | 1.0 | == | 1.0 | PASS‡ |
| protected_span_mutations | 0 | 599 | 0 | == | 0 | **PASS** |
| raw_view_mutations | 0 | 599 | 0 | == | 0 | **PASS** |
| candidate_duplication_after_reordering | 0 | 599 | 0 | == | 0 | **PASS** |
| harm_count_clearly_romanized | 0 | 1 | 0 | == | 0 | PASS§ |

\* Vacuous on HOLDOUT_VALIDATION (pair_total=0); counterfactual failure is on CONTEXT_COUNTERFACTUAL.  
† Implementation currently aliases this metric to clear-romanized top-1, not a dedicated Nepali-context shared population.  
‡ Hard-coded to 1.0 in aggregate.  
§ Hard-coded to 0 in aggregate.

### Exact failed gates for the R3H one-shot package

**HOLDOUT_VALIDATION (authoritative):**

1. `target_missing_from_top5_rate` — **43/229**, value 0.1878, threshold ≤0.02
2. `unresolved_shared_identity_review_accuracy` — **0/19**, value 0.0, threshold ≥0.98

**CONTEXT_COUNTERFACTUAL (chain):**

3. `paired_counterfactual_accuracy` — **0/29**, value 0.0, threshold ≥0.95
4. `unresolved_shared_identity_review_accuracy` — **0/29**, value 0.0, threshold ≥0.98
5. `target_missing_from_top5_rate` — gate recorded fail (numerator 82; denominator handling vacuous/quirky — see §23)

**SAFETY_CHALLENGE (chain):**

6. `target_missing_from_top5_rate` — **10/229**, value 0.0437, threshold ≤0.02
7. `unresolved_shared_identity_review_accuracy` — **0/10**, value 0.0, threshold ≥0.98

**OOV_GENERALIZATION (chain):** English identity **130/130**, false-Dev **0/130**; `target_missing` gate shows a vacuous zero-denominator scorer quirk (`den=max(1,0)`), not a substantive OOV identity failure.

---

## 21. English identity result

| Split | Metric | Result |
|-------|--------|--------|
| HOLDOUT | overall English identity top-1 | **356/356 PASS** |
| HOLDOUT | shared English-context identity | **10/10 PASS** |
| HOLDOUT | technical English | **70/70 PASS** |
| HOLDOUT | names | **6/6 PASS** |
| HOLDOUT | acronyms/identifiers | **190/190 PASS** |
| SAFETY | overall English identity | **637/637 PASS** |
| OOV | overall English identity | **130/130 PASS** |
| COUNTERFACTUAL | overall English identity | **67/67 PASS** |

---

## 22. False-Devanagari result

| Split | False Devanagari on identity-expected | Threshold | Result |
|-------|--------------------------------------:|----------:|--------|
| HOLDOUT | **0/356** | ≤0.01 | **PASS** |
| SAFETY | **0/637** | ≤0.01 | **PASS** |
| OOV | **0/130** | ≤0.01 | **PASS** |
| COUNTERFACTUAL | **0/67** | ≤0.01 | **PASS** |

---

## 23. Shared-collision result

What remains incorrect (non-frozen evidence):

1. **Unresolved/ambiguous shared terms do not satisfy identity-first + review metadata.**  
   Holdout unresolved shared identity-review accuracy = **0/19**.  
   Safety = **0/10**. Counterfactual = **0/29**.  
   Exact remaining defect: top-1 may be identity, but `requires_review` is not set (or not scored as set) for ambiguous shared contexts, so the Option A review contract fails.

2. **Paired English-vs-Nepali-vs-ambiguous counterfactuals fail as complete triples.**  
   Counterfactual pair accuracy = **0/29** (threshold ≥0.95).

3. **`target_missing_from_top5_rate` fails**, but scorer definition mixes populations: numerator increments for any case with gold Devanagari missing from top5; denominator is clear-romanized count only. This means the gate can fail even when clear-romanized recall@5 is 229/229. Treat as both a shared/target-retention concern and a scorer-definition defect to fix in R3H2 without silent retune against the consumed holdout.

Shared English-context identity itself passed on holdout (**10/10**).

---

## 24. Romanized preservation result

| Metric | HOLDOUT | SAFETY |
|--------|---------|--------|
| clear Romanized target top-1 | **229/229 PASS** | **229/229 PASS** |
| clear Romanized recall@5 | **229/229 PASS** | **229/229 PASS** |
| hard-coded harm_count_clearly_romanized | 0 (hard-coded) | 0 (hard-coded) |

No evidenced harm against clear Romanized top-1/recall@5 on sealed splits. The failing `target_missing_from_top5_rate` must **not** be interpreted as clear-romanized recall regression without correcting the denominator mismatch.

---

## 25. Counterfactual result

Split: CONTEXT_COUNTERFACTUAL (chain)

| Gate | Result |
|------|--------|
| paired_counterfactual_accuracy | **0/29 FAIL** |
| english_context_identity_accuracy | **9/9 PASS** |
| unresolved_shared_identity_review_accuracy | **0/29 FAIL** |
| overall English identity | **67/67 PASS** |
| false Devanagari | **0/67 PASS** |

Interpretation: English-side context often works; full pair disposition (especially ambiguous/Nepali legs + review metadata) does not.

---

## 26. OOV result

Split: OOV_GENERALIZATION (chain)

| Gate | Result |
|------|--------|
| overall English identity top-1 | **130/130 PASS** |
| false Devanagari | **0/130 PASS** |
| protected/raw mutations | **0 PASS** |
| substantive OOV identity failure | **not evidenced** |
| `target_missing_from_top5_rate` gate | vacuous/zero-denom quirk → recorded fail without romanized population |

---

## 27. Protected / raw mutation result

| Split | Protected mutations | Raw mutations |
|-------|--------------------:|--------------:|
| HOLDOUT | **0/599** | **0/599** |
| SAFETY | **0/866** | **0/866** |
| COUNTERFACTUAL | **0/111** | **0/111** |
| OOV | **0/130** | **0/130** |

All PASS against threshold == 0.

---

## 28. Canonical / audit scorer agreement

| Item | Status |
|------|--------|
| Canonical R3H aggregate/gates in `eval_mai07_r3h.py` | evidenced |
| Independent audit scorer (separate module / report that does not import canonical helpers) | **NOT_EVIDENCED** |
| Canonical↔audit agreement artifact | **NOT_EVIDENCED** |

Closeout therefore cannot claim independent audit agreement.

---

## 29. Monotonic harm analysis

| Item | Status |
|------|--------|
| `harm_count_clearly_romanized` | hard-coded **0** in aggregate — **not a measured monotonic analysis** |
| Clear Romanized top-1 / recall@5 | measured PASS on holdout/safety |
| Dedicated parent-vs-candidate monotonic safety population report | **NOT_EVIDENCED** |

---

## 30. RC gate decision

- RC lock was validly created (`LOCKED_NOT_RUN`) before holdout.
- One-shot holdout was consumed.
- Qualification result: **`FAILED_HOLDOUT_QUALITY`**
- Therefore the RC is **not** a passed corrective RC. It is a **locked-but-rejected** candidate.
- Do not call it `PASSED_CORRECTIVE_RC`.
- Do not promote it to default active runtime.
- Do not run frozen V2 against it.

---

## 31. Tests added

Primary file: `erp_bot/tests/oip/language_runtime/test_mai07_r3h_corrective.py` (**11 tests**, all active; none skipped)

Coverage includes: firewall tokens/imports, dataset minimums, form-alone insufficiency, clear English identity smoke, cross-path parity, RC lock precedes holdout, holdout cannot rerun, 2000 property cases, MAI-08 untouched.

Not every prompt item 1–30 has a dedicated named test; gaps include independent audit scorer agreement and a standalone leakage matrix.

---

## 32. Full validation commands, exits and counts

Closeout revalidation (read-only intent; focused R3H tests may regenerate non-frozen dataset/score files via fixture):

| Command | Exit | Counts / notes |
|---------|-----:|----------------|
| `pytest tests/oip/language_runtime/test_mai07_r3h_corrective.py -q` | 0 | **11 passed** |
| `pytest tests/oip/language_runtime -q` | 0 | **381 passed, 6 skipped** |
| `pytest tests/oip/language_runtime -k "r3a or r3b or r3c or r3d or r3e or r3f or r3g or lock_chain or seal" -q` | 0 | **193 passed**, 194 deselected |
| `pytest tests/oip/language_runtime -k "seal_contract or rc_lock or lock_chain" -q` | 0 | **35 passed**, 352 deselected |
| `build_mai07r3h_pack --check` | 0 | ok; content `2a4599fe…` |
| `build_mai07r3h_pack --check-twice` | 0 | ok; dual-build identical |
| `build_mai07r3f_seal_new_pack --check` | 0 | parent ok; content `1617425373…` |
| `pytest ...test_mai05_language_spans.py ...test_mai06_*.py -q` | 0 | **79 passed** |
| `pytest tests/oip/evaluation/test_mai04_harness.py -q` | 0 | **15 passed** |
| `pytest tests/oip/test_mai02_canonical_contracts.py -q` | 0 | **22 passed** |
| `python -m src.oip.contracts.export_schemas --check` | 0 | ok |
| Ledger JSON load | 0 | ok |
| `npx vitest run src/__tests__/orbix` | 0 | **144 passed** |
| `npx vitest run packages/backend/.../khataConfirmAuth.test.ts .../correlation.test.ts` | 0 | **12 passed** |
| `npx vitest run` (broader) | 1 | **175 passed, 3 failed**; 2 failed suites — known accounting localStorage / `createLegacyStateReader` baseline |
| `npx tsc --noEmit` | 2 | known `InvoicePrint.tsx` TS1005/TS1109 |
| `pytest --collect-only -q` (erp_bot) | 2 | **1250 collected**, 1 collection error: `src.orbix.llm.reasoning_filter` missing (`test_grounding.py`) |

Known unrelated baselines (not repaired):

- InvoicePrint TypeScript errors
- accounting localStorage / legacy reader failures
- reasoning_filter collection error

---

## 33. Historical frozen-artifact immutability

Byte hashes only (no case parsing):

| Artifact | SHA-256 |
|----------|---------|
| R3E predictions JSONL | `89ee4789333bc1fd5b5ea3b1b505c0a53b7a5f7e159d5966511ead52735a7e9c` |
| R3G-002 predictions JSONL | `4e8e0f8c12da0f48a2063a97fb895f322195b3da627dd71dfde8ba7c99c5a4a4` |
| R3C one-shot predictions baseline | `88016f847678fefcd2b8545659ca03f8c4bf6849525d64855d563e9a95fd0c5a` |
| Parent sealed pack content | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` (unchanged; `--check` ok) |
| V2/population/threshold manifests (selected) | hashed present under `evals/mai07/manifests/` (see closeout hash dump) |

No frozen V2 execution occurred in R3H or this closeout. No claim is made that every historical RC_001/RC_002 file was re-verified beyond available meta hashes and passing lock-chain regression tests.

---

## 34. Complete files-changed inventory (R3H-relevant)

### Core implementation

- `erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/english_identity_guard.py`
- `erp_bot/src/oip/modules/language_runtime/transliteration/application/transliteration_service.py`
- `erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3h_pack.py`
- `erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3h_english_identity_datasets.py`
- `erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3h.py`
- `erp_bot/src/oip/modules/language_runtime/transliteration/resources/r3h_english_identity_policy.json`
- `erp_bot/src/oip/modules/language_runtime/transliteration/sealed_packs/mai-07.1.4-r3h-englishid/**`
- `erp_bot/tests/oip/language_runtime/test_mai07_r3h_corrective.py`

### Evaluation artifacts

- `evals/mai07_r3h_english_identity/**` (datasets, thresholds, lock/attempt/chain/qualification, reports)

### Governance / docs

- `docs/mokxya-ai/MAI_07_R3H_ENGLISH_IDENTITY_ROOT_CAUSE_REPORT.md`
- `docs/mokxya-ai/MAI_07_R3H_ENGLISH_IDENTITY_CORRECTIVE_REPORT.md`
- `docs/mokxya-ai/MAI_07_R3H_ENGLISH_IDENTITY_CORRECTIVE_FINAL_REPORT.md` (this file)
- `docs/mokxya-ai/baselines/MAI_07R3H_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/EVALUATION_GOVERNANCE.md`
- `docs/mokxya-ai/EVALUATION_METRICS.md`
- `docs/mokxya-ai/MAI_PHASE_LEDGER.json`
- `docs/mokxya-ai/MAI_00_GAP_REGISTER.md`
- `docs/mokxya-ai/TRANSLITERATION_RESOURCE_PROVENANCE.md`
- `docs/mokxya-ai/decisions/ADR_0009_TRANSLITERATION_IDENTITY_AND_SCRIPT_POLICY.md`

Many other MAI-00…MAI-07 files exist in the dirty tree from prior phases; they are not all R3H deltas.

---

## 35. Security / privacy verdict

- No frozen case text/IDs/surfaces exposed in this report.
- R3H aggregate instrumentation is intended to avoid raw text/candidate surfaces in MAI-03 traces.
- Dedicated sealed privacy audit of all new trace attributes: **NOT_EVIDENCED** beyond existing architecture claims and focused tests.
- No secrets committed by this closeout.

---

## 36. Accounting / posting / sync / OEC impact

- R3H changes are language-runtime transliteration ranking/disposition only.
- No evidenced accounting posting, sync, or OEC mutation path changes in R3H artifacts.
- Broader vitest accounting failures observed are **known unrelated baselines**, not attributed to R3H.

---

## 37. Documentation / ledger / gap updates

Updated/confirmed:

- Phase ledger: `MAI-07R3H = FAILED_HOLDOUT_QUALITY`; `recommended_next_phase = MAI-07R3H2-SHARED-COLLISION-CORRECTIVE`
- Gap register GAP-P1-011 remains OPEN; remediation now points to R3H2
- EVALUATION_GOVERNANCE / METRICS record non-frozen failure and cite authoritative qualification/chain
- ADR_0009 addendum + resource provenance include R3H pack hash and failed holdout status
- Linguist/production approvals remain false

---

## 38. Known limitations and linguist status

- Not linguist-reviewed (`LINGUIST_APPROVED=false`).
- Not production-approved.
- Default active pack still `mai-07.1.3-r3f-sealnew`.
- Independent audit scorer absent.
- Dedicated leakage matrix absent.
- Development score report absent.
- Aggregate hard-codes some architecture/harm metrics.
- `target_missing_from_top5_rate` denominator mismatch.
- `requires_review` metadata contract failing on ambiguous shared strata.
- Dataset/score on-disk drift after tests regenerate non-frozen artifacts.
- RC rejected by holdout quality; not eligible for frozen reauth on this candidate.

---

## 39. Rollback instructions

1. Keep using default active pack/runtime `mai-07.1.3-r3f-sealnew` (already default).
2. Do not promote `mai-07.1.4-r3h-englishid` to active defaults.
3. Preserve R3H sealed pack and lock/attempt/chain as historical failed-holdout evidence (append-only).
4. Do not delete or rewrite `LOCKED_NOT_RUN` / attempt / qualification.
5. Do not rerun the consumed R3H holdout.
6. Next work must be a **new** non-frozen corrective phase (R3H2), not mutation of this RC.

---

## 40. Final MAI-07 status

**`NEEDS_CORRECTIVE_WORK`**

Quality gates remain false. Non-frozen R3H safety for clear English/false-Dev improved on sealed non-frozen evidence, but shared-collision/review/counterfactual gates failed. Frozen quality remains open (GAP-P1-011).

---

## 41. Confirmation: no frozen V2 run occurred

Confirmed by attempt (`frozen_v2_opened=false`), lock (`no_frozen_v2_run=true`), governance docs, and this closeout’s read-only scope. **No frozen V2 execution in R3H or closeout.**

---

## 42. Confirmation: MAI-08 remains NOT_STARTED

Confirmed by `MAI_PHASE_LEDGER.json` and `test_no_mai08_touch`. **MAI-08 = NOT_STARTED.**

---

## 43. Exact next governed phase and supporting evidence

**Next phase:** `MAI-07R3H2-SHARED-COLLISION-CORRECTIVE`

Evidence justifying R3H2 (non-frozen only):

1. Holdout unresolved shared identity-review accuracy **0/19** (threshold ≥0.98).
2. Counterfactual paired accuracy **0/29** (threshold ≥0.95).
3. Safety unresolved shared review **0/10**; safety target-missing gate also fail under current scorer definition.
4. English identity / false-Devanagari / clear Romanized top1+recall@5 **passed**, so the remaining defect is concentrated in shared/ambiguous collision + review metadata (+ scorer population hygiene), not a wholesale English-safety regression.
5. Root-cause audit already rejected path bypass; R3H2 should not reopen frozen V2 and should not retune against the consumed R3H holdout.

**Do not authorize MAI-07R3I in this turn.**  
**Do not implement R3H2 in this turn.**

---

## Critical-question answers (summary)

| Question | Answer |
|----------|--------|
| Which exact R3H holdout gates failed? | HOLDOUT: `target_missing_from_top5_rate` (43/229), `unresolved_shared_identity_review_accuracy` (0/19). Also failed on companion sealed splits: counterfactual pair 0/29; safety missing 10/229 & unresolved 0/10. |
| Holdout attempt consumed? | **Yes.** |
| Canonical and independent scorers agree? | Independent audit scorer **NOT_EVIDENCED**. |
| Cross-path parity pass? | Focused product/direct parity test **PASS**; aggregate field hard-coded. |
| R3F no-transfer cause? | Primarily **policy generalization** + prior dataset under-coverage; not path integration. Dataset/scorer design issues also contributed to R3H gate interpretation. |
| Shared-collision behavior still incorrect? | Ambiguous/unresolved review metadata contract fails; counterfactual triples fail; missing-top5 gate fails under mismatched population definition. |
| Clear English / Romanized / technical / names / acronyms / protected / OOV / counterfactual separately? | Clear English, false-Dev, technical, names, acronyms, protected, OOV identity: pass. Counterfactual pairs: fail. Unresolved shared review: fail. |
| Harm to previously correct Romanized cases? | Clear Romanized top1/recall@5 pass; measured monotonic harm report **NOT_EVIDENCED** (hard-coded 0). |
| Why R3H2 justified? | Remaining failures concentrate on shared collision / review / counterfactual after English safety already passes non-frozen. |
| Valid RC or rejected? | Locked then **rejected** by holdout quality. |
| Runtime/resource versions advanced? | New sealed pack `mai-07.1.4-r3h-englishid` created for RC; default active remains `mai-07.1.3-r3f-sealnew`. |
| Frozen/historical sealed artifacts changed? | Parent pack check ok; frozen prediction hashes match published prefixes; no frozen rerun. |
| All required validations run, or only 11 focused? | Closeout ran focused + full language_runtime + R3 regressions + seal/pack checks + MAI-04/05/06 + contracts + orbix + node auth/correlation + ledger; broader TS/accounting/collection show known unrelated baselines. |

---

*End of MAI-07R3H closeout final report.*
