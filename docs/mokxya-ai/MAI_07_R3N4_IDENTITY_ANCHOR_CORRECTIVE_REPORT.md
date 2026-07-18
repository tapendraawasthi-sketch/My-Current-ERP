# MAI-07R3N4 Identity-Anchor Corrective Report

**Engineering verdict:** `FAILED_HOLDOUT_QUALITY`  
**Date:** 2026-07-18  
**Phase:** `MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-ANCHOR-AND-FINALIZATION-COMPLETENESS-CORRECTIVE`  
**RC:** `MAI_07R3N4_FRESH_HOLDOUT_RELEASE_CANDIDATE_001`  
**Attempt:** `MAI_07R3N4_HOLDOUT_ATTEMPT_001`  
**Lock semantic sha256:** `4e80b55ae8338e5b281b72c54311a1dca25c7f97e79a4d5dc1b0ba5ae7165d51`

> **Do not repair R3N4 in-place.** This RC consumed its one holdout attempt and failed identity / path-finalization gates. Next governed phase: `MAI-07R3N5-FRESH-HOLDOUT-IDENTITY-ANCHOR-CORRECTIVE` (new candidate version + fresh holdout). Do **not** implement R3N5 in this closeout. Do **not** create RC_002.

## Non-claims

Engineering holdout qualification only. Does **not** grant linguist approval, product quality gates, production approval, frozen V2/V3 execution, Round B, or MAI-08 start. `FAILED_HOLDOUT_QUALITY` is **not** pack promotion. R3N3 prediction JSONL case surfaces were not read for dataset construction or corrective design (aggregate-only proof on file).

## 1. Verdict / flags

| Flag | Value |
|------|-------|
| `engineering_verdict` | `FAILED_HOLDOUT_QUALITY` |
| `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC` | **not earned** |
| `candidate_promoted` | false |
| `QUALITY_GATES_PASSED` | false |
| `LINGUIST_APPROVED` | false |
| `PRODUCTION_APPROVED` | false |
| `MAI-07` | `NEEDS_CORRECTIVE_WORK` |
| `MAI-08` | `NOT_STARTED` |
| `prohibited_for_training` | true |

## 2. Baseline / skips

Pre-edit `language_runtime` suite: **707 passed, 6 skipped, 0 failed**.  
Skips: historical R1/R2 overlay expectations (MAI-07R3C disposition). See `evals/mai07_r3n4_fresh_holdout/PREEDIT_BASELINE.json`.

## 3. Authorities

| Role | Pack / policy | Status |
|------|---------------|--------|
| R3N4 candidate | `mai-07.1.9-r3n4-identityanchor` / `mai-07-r3n4.1.0.0` | Explicit activation only; **not promoted** |
| Parent (failed R3N3) | `mai-07.1.8-r3n3-identityinv` / pack `1268527c5c5d99e036628dc104340dafe297afadf9938a310a099a38f825c0e7` | Consumed; aggregate guidance only |
| Active parent | `mai-07.1.3-r3f-sealnew` | Immutable default |
| Candidate pack content sha256 | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` | Sealed; `default_active=false` |
| Finalizer | `mai-07-r3n4.finalizer.1.0.0` | Anchor-driven; R3N4-only |
| Overlay | disabled | Non-authoritative |

## 4. Aggregate-only proof

`evals/mai07_r3n4_fresh_holdout/R3N4_AGGREGATE_ONLY_INPUT_PROOF.json` — prediction JSONL not opened; R3N3 reports not opened; one-way hashes only for freshness.

## 5. Source-path inventory

`evals/mai07_r3n4_fresh_holdout/SOURCE_PATH_INVENTORY.json` — every R3N4 output path re-enters `apply_r3n4_finalize_bundle` with a raw-derived `IdentityAnchorV1`. Identity is never reconstructed from ranked candidates.

## 6. Anchor contract

`IdentityAnchorV1` (`r3n4_identity_anchor.py`): UNICODE_CODE_POINT offsets; `raw_surface == raw_text[start:end]`; digests validated; immutable after creation; no normalization/casefold/whitespace collapse. Surfaces/digests excluded from production traces.

## 7. Finalizer changes

`finalize_candidates_r3n4` builds the sole identity candidate from the anchor, strips prior identity-flagged look-alikes, reserves protected + highest Devanagari, deterministic cap, canonical provenance/IDs, `canonical_serialize` idempotence. Never infers identity from the candidate list.

## 8. Path-completeness proof

`r3n4_finalization_path_registry.py` + spy-capable `apply_r3n4_finalize_bundle`. Required families include protected, English skip/guard, abstention, ordinary Romanized, acronym, structural/refined/coalesced identifier, multi-token, optional/ambiguous, failure/fallback, cap-pressure, empty-generator.

## 9. Versions / hashes

| Artifact | SHA-256 |
|----------|---------|
| Pack content | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` |
| Runtime semantic (`mai07_r3n4_candidate_runtime.py`) | `b2d6dd17aa49f04e48c520c046150f9f73a169a36172d79fa7037b21e0196361` |
| Finalizer source | `9ba73225cf3a4fbbe6e60a3d98e16023dfb9c1f428bb503f1be956facaf259ab` |
| Lock semantic | `4e80b55ae8338e5b281b72c54311a1dca25c7f97e79a4d5dc1b0ba5ae7165d51` |
| Lock raw | `5ad47ae4688a4e23b8b333855a9413afe4698871b871c51418f970760e0264c1` |
| Parent R3N3 lock | `0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b` |
| R3N integrity closure | `fccbbcfbb7fbf9d816cbdc9278c8754964b5b7efcd6e499469e6e1701873ffae` |

## 10–11. Datasets / difficulty / freshness

`evals/mai07_r3n4_fresh_holdout/` — seeds 20260724/20260725; new IDs/families. Freshness firewall `proof_passed=true` vs R3N/R3N2/R3N3 (zero ID/text/skeleton/family overlap). Split floors met (DEV 800, HOLDOUT ≥1500 observed 2475, SAFETY 400, CF 300, OOV 100, MONOTONIC 400, IDENTITY_ANCHOR 500). Difficulty covers multi-token, punctuation/whitespace/NBSP, Unicode, refined/coalesced, identifiers, cap pressure, serialization, repeated finalization.

## 12. Development / property

DEVELOPMENT scored clean before lock (all required gates; canonical/audit agreement). Property suite ≥20,000 seeded cases in `test_mai07_r3n4_fresh_holdout.py`. Dual-build pack byte-identical.

## 13–14. Population N/D and scorer thresholds

See `POPULATION_DENOMINATORS.json` and `MAI_07R3N4_THRESHOLDS.json`. Scorer/contract versions `mai-07-r3n4.*.1.0.0`. Bound into RC lock.

## 15–16. RC lock / attempt

Chronology: dual-build → development pass → `LOCKED_NOT_RUN` → one-shot → attempt consumed. No rerun. No RC_002.

## 17–18. Parent / holdout metrics

Active R3F + failed R3N3 + R3N4 predictions persisted separately under `reports/`.

### HOLDOUT_VALIDATION (fail)

| Gate | Result | Threshold |
|------|--------|-----------|
| identity_retention | **827/850** | ==1.0 FAIL |
| exact_raw_identity | **827/850** | ==1.0 FAIL |
| exactly_one_identity | **827/850** | ==1.0 FAIL |
| identity_invariant_analogue | **327/350** | ==1.0 FAIL |
| cap_pressure_identity_retention | **327/350** | ==1.0 FAIL |
| anchor_validity | **827/850** | ==1.0 FAIL |
| finalizer_idempotence | **2452/2475** | ==1.0 FAIL |
| path_finalization_coverage | **2452/2475** | ==1.0 FAIL |
| english_identity_top1 | 200/200 | PASS |
| false_devanagari_on_english | 0/200 | PASS |
| romanized_script_at_5 | 200/200 | PASS |
| acronym / identifier / protected | 100/100 | PASS |
| multi_token / refined / coalesced / unicode | 1.0 | PASS |
| serialization_roundtrip | 500/500 | PASS |

## 19. Failure-set aggregate relationships

All listed identity and path/idempotence deficits equal **23 cases** at the aggregate level (850−827 = 350−327 = 2475−2452 = 23). No per-case surfaces inspected for corrective repair.

## 20–21. Identity / supporting

Serialization roundtrip passed on holdout population. IDENTITY_ANCHOR_CHALLENGE **500/500** passed. SAFETY / CONTEXT / OOV passed. MONOTONIC failed only `finalizer_idempotence` + `path_finalization_coverage` (360/400). Supporting results do not override holdout failure.

## 22–24. Parent differential / audit / immutability

Parent differential predictions recorded. Canonical/audit agreement on development. Active R3F runtime/resource unchanged; overlay disabled; R3N4 `default_active=false`; R3N3 evidence untouched; no frozen evaluation; no lexicon additions.

## 25–28. Tests / files / security / accounting

Focused R3N4 tests under `test_mai07_r3n4_fresh_holdout.py`. No accounting/posting/sync/OEC imports. No production-trace emission of anchor surfaces. Security: prohibited_for_training retained.

## 29–31. Documentation / limitations / rollback

This report + ADR_0018 + policy docs + baseline summary + ledger/gap updates. Limitation: residual 23-case identity/path gap under holdout despite DEVELOPMENT pass and IDENTITY_ANCHOR_CHALLENGE pass — suggests eval span-selection / path-marker coupling remaining, not lexicon. Rollback: leave active R3F; discard candidate activation.

## 32–35. Promotion / MAI-07 / MAI-08 / next

Not promoted. MAI-07=`NEEDS_CORRECTIVE_WORK`. MAI-08=`NOT_STARTED`.  
**Exact next phase:** `MAI-07R3N5-FRESH-HOLDOUT-IDENTITY-ANCHOR-CORRECTIVE` — new runtime/policy versions, fresh holdout, address residual identity/path-finalization completeness without reading R3N4 failure case texts for tuning.

## Related artifacts

- `evals/mai07_r3n4_fresh_holdout/`
- `docs/mokxya-ai/R3N4_IDENTITY_ANCHOR_POLICY.md`
- `docs/mokxya-ai/R3N4_FINALIZATION_PATH_AUTHORITY.md`
- `docs/mokxya-ai/baselines/MAI_07R3N4_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/decisions/ADR_0018_R3N4_IDENTITY_ANCHOR_AND_PATH_FINALIZATION.md`
- `erp_bot/tests/oip/language_runtime/test_mai07_r3n4_fresh_holdout.py`
