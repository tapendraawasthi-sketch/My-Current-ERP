# MAI-07R3H2 Shared Collision Corrective Report

## Verdict

**MAI-07R3H2 = PASSED_CORRECTIVE_RC** (sealed non-frozen holdout)

This phase remained strictly non-frozen. No frozen V2 execution occurred. Pack **not promoted**; active default remains `mai-07.1.3-r3f-sealnew`.

## Implemented

- Policy `mai-07-r3h2.1.0.0` on the typed identity-disposition authority (`english_identity_guard.py`).
- Shared-collision surfaces use `EligibilityDecision.GENERATE` (`SHARED_COLLISION_GENERATE`).
- Decisive shared-context dispositions: identity-preferred / target-preferred / ambiguous identity-first review.
- Span review metadata on `TransliterationSpanV1`: `review_required`, `review_reason_codes`, `disposition`, `policy_version`.
- Versioned scorers: `eval_mai07_r3h2_canonical_scorer.py` + independent `eval_mai07_r3h2_audit_scorer.py` + `r3h2_scoring_contracts.py` (no `max(1, den)`).
- Mutation-proof builders/guards: `canonical_path_guard.py`; `write_datasets(output_dir=...)` requires explicit dir; canonical writes need `MAI07_AUTHORIZE_EVAL_WRITE=1`.
- Sealed pack `mai-07.1.5-r3h2-shared` (RC evidence only; not active default).

## Corrective Branch

Selected: **C (shared-context disposition) + D (shared-surface generation) + A (review metadata)**.

Not selected as sole remedy: pure cap retention.

## Dataset / RC

Tree: `evals/mai07_r3h2_shared_collision/`

- RC: `MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001`
- Policy: `mai-07-r3h2.1.0.0`
- Pack: `mai-07.1.5-r3h2-shared`
- Thresholds: `locked_before_holdout_observation=true`
- Lock: `*.LOCKED_NOT_RUN.json` (immutable after evaluation)
- Chain: `*.CHAIN_MANIFEST.json` (one-shot consumed)
- Qualification: `status=PASSED_HOLDOUT`, `gate_all_pass=true`

## Governance Flags (unchanged product bar)

- `QUALITY_GATES_PASSED=false` (product/frozen quality bar not claimed)
- `LINGUIST_APPROVED=false`
- `PRODUCTION_APPROVED=false`
- `MAI-07=NEEDS_CORRECTIVE_WORK`
- `MAI-08=NOT_STARTED`
- Next governed phase: **MAI-07R3I-FROZEN-REAUTHORIZED**

Open gaps retained: GAP-P1-011, GAP-P1-012, GAP-P0-001.  
Closed by this phase: **GAP-P1-015** (mutation-proofing verified).

## Recommendation

Do not run frozen V2 from this chat/task. Proceed only under explicit authorization for **MAI-07R3I-FROZEN-REAUTHORIZED**.
