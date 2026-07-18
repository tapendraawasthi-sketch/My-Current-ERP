# MAI-07R3H2 Baseline Summary

- Phase: `MAI-07R3H2-SHARED-COLLISION-CORRECTIVE`
- Verdict: `PASSED_CORRECTIVE_RC`
- Pack: `mai-07.1.5-r3h2-shared` (**not promoted**; active remains `mai-07.1.3-r3f-sealnew`)
- Policy: `mai-07-r3h2.1.0.0`
- RC: `MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001`
- Frozen V2 opened: **no**
- MAI-08 touched: **no**

## Sealed holdout (authoritative)

Qualification / chain under `evals/mai07_r3h2_shared_collision/`:

- `gate_all_pass=true`, qualification `status=PASSED_HOLDOUT`
- `QUALITY_GATES_PASSED=false`, `LINGUIST_APPROVED=false`, `PRODUCTION_APPROVED=false`
- Clear Romanized missing-from-top5: **0/229**
- Shared Nepali context target accuracy / generation / recall@5: pass on holdout populations
- Unresolved shared identity-review accuracy: pass (review metadata required)
- Counterfactual triples: scored on CONTEXT_COUNTERFACTUAL split (canonical↔audit agreement)
- Optional ambiguous retention: population-bound; empty → `NOT_APPLICABLE`

## Integrity

- R3H lock/attempt/chain/qualification hashes unchanged (see `MAI_07R3H_POST_CLOSEOUT_ARTIFACT_DRIFT.json` locked hashes).
- Canonical path guard rejects unauthorized writes to sealed trees.
- Focused tests write only via `tmp_path` / synthetic scorers.

## Next

`MAI-07R3I-FROZEN-REAUTHORIZED` (explicit authorization required). Do not infer linguist/production approval from this RC.
