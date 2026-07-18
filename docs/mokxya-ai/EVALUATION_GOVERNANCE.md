# EVALUATION_GOVERNANCE — Transliteration (MAI-07)

## Immutable lineage

Frozen dataset **V1** (`MAI_07_ROMANIZED_TRANSLITERATION_V1`) is immutable.

SHA-256: `5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208`

Do not rewrite V1 cases, gold, populations, audits, or historical C1/C2/R1/R2 reports.

## Corrected data (future only)

If human policy review requires label/population changes:

1. Create `MAI_07_ROMANIZED_TRANSLITERATION_V2` (new id, new hash).
2. Record `parent_dataset_hash` = V1 hash.
3. Publish machine-readable change log with case-level reasons.
4. Recompute populations from accepted policy.
5. Freeze thresholds **before** runtime/tuning.
6. One evaluation after lock.

**Do not create V2 in MAI-07R3A.**  
**Do not create/freeze dataset V2 in MAI-07R3B** — R3B only locks review import + Option A policy + evaluation-semantics plan.

**MAI-07R3C froze** `MAI_07_ROMANIZED_TRANSLITERATION_V2`  
hash `0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9`  
parent = V1 `5637ccd9…`. One-shot baseline recorded; thresholds were locked before observation. Do not retune against V2 frozen cases.

**MAI-07R3D** used separate non-frozen `evals/mai07_r3d_corrective/` DEVELOPMENT / HOLDOUT_VALIDATION / SAFETY_CHALLENGE. Holdout was locked before RC and opened once after RC lock. Non-frozen holdout success does not set `QUALITY_GATES_PASSED`.

**MAI-07R3E** executed exactly one sealed frozen-V2 evaluation of `mai-07.1.1-r3d` (`FAILED_QUALITY`: English identity / false-Devanagari). Attempt consumed; automatic rerun prohibited. Further correction requires a new non-frozen phase (**MAI-07R3F**), not frozen retune.

**MAI-07R3F** sealed non-frozen English Identity Guard RC `mai-07.1.2-r3f` (`PASSED_CORRECTIVE_RC`). Holdout metric tables claim all_pass; frozen V2 reserved for R3G.

**MAI-07R3G** preflight returned **BLOCKED_PRECONDITION_FAILED** (resource pack unrestorable vs `e94cc8c…`). An initial prediction-hash alarm was a **contract mismatch** (raw JSONL vs producer canonical-list `b5cdb56f…`); predictions reproduce sealed reports without runtime.

**MAI-07R3F-SEAL-RESTORE** = `RESTORE_NOT_POSSIBLE_NEW_RC_REQUIRED`. Original R3F RC `INVALIDATED_BY_SEAL_DRIFT`. Seal tooling mutation-proofed. Frozen V2 not opened.

**MAI-07R3F-SEAL-NEW** = `PASSED_NEW_RC`. New pack `mai-07.1.3-r3f-sealnew` (`16174253…`) under `mai-07-artifact-seal-contract.2.0.0`. Fresh holdout passed once. `AUTOMATED_ENGINEERING_GATES_PASSED=true` for new non-frozen RC; `QUALITY_GATES_PASSED=false`.

**MAI-07R3G-REAUTHORIZED** = `BLOCKED_PRECONDITION_FAILED` (historical). Lock chain recovered via **MAI-07R3F-SEAL-LOCK-CHAIN**. Frozen V2 **not opened**. **MAI-07R3G-REAUTHORIZED-002** = `FAILED_QUALITY` (one-shot frozen V2 consumed; English identity 98/102; false Devanagari 4/102). MAI-08 NOT_STARTED.

**MAI-07R3F-SEAL-LOCK-CHAIN** = `PASSED_RECOVERED_LOCK_CHAIN`. Immutable pre-holdout body `f4c07e24…` preserved; append-only chains verify for RC_001 (saved holdout evidence) and RC_002 (fresh holdout). `AUTOMATED_ENGINEERING_GATES_PASSED=true` for lock-chain integrity; `QUALITY_GATES_PASSED=false`.

**MAI-07R3H** = `FAILED_HOLDOUT_QUALITY` (non-frozen only). Product/direct/evaluator paths were audited and confirmed to invoke the same transliteration service path; Branch B (policy generalization defect) was selected. R3H added a canonical typed identity-disposition authority, a larger non-frozen shared-collision/counterfactual dataset, and a locked RC/one-shot holdout chain. English identity and false-Devanagari safety gates passed, but shared ambiguous-review and counterfactual gates failed. Frozen V2 **did not run**. MAI-08 NOT_STARTED.

**MAI-07R3H2** = `PASSED_CORRECTIVE_RC` (sealed non-frozen only). Corrective branches C+D+A (shared-context disposition + shared-surface GENERATE + span review metadata). Versioned canonical/audit scorers with population-bound metrics (no `max(1, den)`). Pack `mai-07.1.5-r3h2-shared` is RC evidence only — **not promoted**; active remains `mai-07.1.3-r3f-sealnew`. `QUALITY_GATES_PASSED=false`, `LINGUIST_APPROVED=false`, `PRODUCTION_APPROVED=false`. Frozen V2 **did not run**. Next=`MAI-07R3I-FROZEN-REAUTHORIZED`. MAI-08 NOT_STARTED.

**MAI-07R3I-FROZEN-REAUTHORIZED** = `FAILED_QUALITY` (one-shot frozen V2 of sealed R3H2 RC consumed). Explicit load of `mai-07.1.5-r3h2-shared` (default R3F pack not used). Failures: TARGET_TOP1 240/288, UNAMBIGUOUS_TOP1 228/255, ENGLISH_IDENTITY 99/102, FALSE_DEVANAGARI 3/102, PROTECTED_MUTATIONS 6. Attempt consumed; automatic rerun prohibited. Do **not** retune from frozen V2. Prefer governance decision for independently reviewed V3 / professional adjudication. R3H2 pack **not** promoted. MAI-08 NOT_STARTED.

**V2 governance (ADR_0010):** V2 is `HISTORICAL_BENCHMARK_EXHAUSTED_FOR_MODEL_SELECTION` — immutable historical record; not the next release gate; do not mine case bodies for correction.

**MAI-07R3J-A** = `REVIEW_PACKET_READY` / blocker `BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW`. Independent V3 review packet under `docs/mokxya-ai/reviews/mai07_v3/` (no human decisions yet; no model evaluation; runtime unchanged). Next=`MAI-07R3J-B-ADJUDICATION-AND-V3-FREEZE`. MAI-08 NOT_STARTED.

**MAI-07R3J-AI-ASSISTED-ACCOUNTING-IMPORT** = `PASSED_ENGINEERING_IMPORT`. Six ACCOUNTING_DOMAIN Round A workbooks (611 rows) imported under `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/accounting_domain/` with `review_method=AI_ASSISTED_HUMAN_VERIFIED`. **Not** independent human review; **not** official Round A lock; **not** Round B; **not** frozen V3 gold; **not** training; **not** runtime promotion. Official inbox / `ROUND_A_LOCKED` / `ROUND_B_READY` unchanged. See ADR_0011. MAI-08 NOT_STARTED.

**MAI-07R3J-AI-ASSISTED-REMAINING-ROLE-DRAFTS** = `PASSED_DRAFT_GENERATION`. AI-assisted Round A drafts for PRODUCT_POLICY, NEPALI_FLUENT_A, PROFESSIONAL_LINGUIST_B (3333 rows) under `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/role_drafts/`. Status `AI_ASSISTED_DRAFT_FOR_HUMAN_REVIEW` — **not** user-accepted verified import; **not** inbox/lock/Round B/frozen gold. MAI-08 NOT_STARTED.

**MAI-07R3J-AI-ASSISTED-REMAINING-ROLES-IMPORT** = `PASSED_ENGINEERING_IMPORT`. User accepted all 3333 suggestions without changes. Evidence under `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/remaining_roles/` (`AI_ASSISTED_HUMAN_VERIFIED`). PROFESSIONAL_LINGUIST_B is an **AI role simulation only** (`professional_linguist_adjudication=false`, `linguist_approved=false`). Not official Round A lock / Round B / frozen V3 gold / training / runtime promotion. MAI-08 NOT_STARTED.

**MAI-07R3K-AI-ASSISTED-CROSS-ROLE-CONSENSUS-DIAGNOSTIC** = `PASSED_ENGINEERING_DIAGNOSTIC`. Consolidated 3944 judgments / 1111 cases. Disposition agreement is **contaminated** (shared map+heuristic) and labeled non-independent AI-output similarity only — **not** human IRR, **not** majority gold. Risk queue 700 + blinded targeted packet (not official Round A). ADR_0012. MAI-08 NOT_STARTED.

**MAI-07R3K-CLOSURE** = `PASSED_CLOSURE` / `defect_scope=REPORT_ONLY`. Reconciled hybrid conversational citation (accounting semantic prefix `b96bec29` + ZIP suffix `1cdb68`). Canonical R3K semantic hash preserved (`42d1a5ff…`). Input authority manifest + typed hash contract. Does not authorize Round B, frozen V3, or quality gates.

**MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC** = `PASSED_ENGINEERING_DIAGNOSTIC`. Active runtime vs 1111 AI policy-reference cases. Policy conformance only (`runtime_conformance_is_language_quality=false`). No Devanagari spelling gold. Residual 829; packet 65. ADR_0013. MAI-08 NOT_STARTED.

**MAI-07R3M-AI-ASSISTED-POLICY-MISMATCH-TRIAGE** = `PASSED_ENGINEERING_TRIAGE`. Classified all 829 residuals (328 actual / 487 risk-only / 14 span). Safety-critical vs policy-critical separated. Code-corrective=9; resource=0. ADR_0014. Next=MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE. MAI-08 NOT_STARTED.

**MAI-07R3M-CLOSURE** = `PASSED_CLOSURE` / `defect_scope=REPORT_ONLY`. Reconciled Tier-1 reason-count presentation (occurrence vs primary partition). R3L/R3M semantic hashes preserved. Nine code-corrective candidates authority-proven. Does not authorize runtime edits, Round B, frozen V3, or quality gates.

**MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE** = historical `PASSED_CORRECTIVE_RC` on RC_002 / ATTEMPT_002 — **withdrawn for release authority** by integrity closure. Active remains `mai-07.1.3-r3f-sealnew`; candidate not promoted.

**MAI-07R3N-INTEGRITY-CLOSURE** = `INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`. Attempt 002 reused Attempt 001 case-ID/template-family/seed holdout after post-observation runtime coalesce + gate requiredness change (`INVALID_REQUIRED_POPULATION`→`NOT_APPLICABLE`) + one-sentence holdout edit, under reused candidate version `mai-07.1.6-r3n-policyconf`. No prediction rerun. Append-only invalidation sidecar retained. R3N2 protocol specified not executed. Next=`MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE`. Do not start R3O. MAI-08 NOT_STARTED.

**MAI-07R3N2** = `FAILED_HOLDOUT_QUALITY`. Fresh candidate `mai-07.1.7-r3n2-freshholdout` locked and evaluated once against a genuinely fresh 1000-case holdout (zero R3N holdout case/text/family overlap). Development and supporting splits passed; holdout failed identity_retention 148/150 and identity_invariant_analogue 98/100. Attempt consumed; no RC_002; do not repair in place. Next=`MAI-07R3N3-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE`. MAI-08 NOT_STARTED.

**MAI-07R3N3** = `FAILED_HOLDOUT_QUALITY`. Fresh candidate `mai-07.1.8-r3n3-identityinv` / policy `mai-07-r3n3.1.0.0` / pack `1268527c…` locked (semantic `0aaefd82…`) and evaluated once against a fresh 1200-case holdout (zero R3N/R3N2 holdout overlap; aggregate-only prior inputs, no prediction JSONL reads). Reserved-identity finalizer shipped; development and supporting splits passed; holdout failed identity_retention 288/300, exact_raw/exactly_one 288/300, identity_invariant 238/250, cap_pressure 238/250, finalizer_idempotence 1188/1200; english 325/325, false-dev 0/325, romanized 200/200, acronym/identifier/protected/caps passed; monotonic failed only finalizer_idempotence. Attempt consumed; no RC_002; do not repair in place. Next=`MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE`. MAI-08 NOT_STARTED.

**MAI-07R3N4** = `FAILED_HOLDOUT_QUALITY`. Fresh candidate `mai-07.1.9-r3n4-identityanchor` / policy `mai-07-r3n4.1.0.0` / pack `8b57db0f…` locked (semantic/`rc_manifest_semantic_sha256` `4e80b55a…`) and evaluated once against a fresh 2475-case `HOLDOUT_VALIDATION` split (zero R3N/R3N2/R3N3 holdout overlap; aggregate-only prior inputs, no prediction JSONL reads; minimum-denominator policy verified before lock). `IdentityAnchorV1` identity construction and a 14-family path-finalization registry shipped; development, minimum-denominator, and adversarial `IDENTITY_ANCHOR_CHALLENGE` (500/500) all passed; english/romanized/acronym/identifier/protected/caps/multi-token/refined/coalesced/serialization/unicode identity all passed at full strength; holdout failed identity_retention/exact_raw_identity/exactly_one_identity/anchor_validity 827/850, identity_invariant_analogue/cap_pressure_identity_retention 327/350, finalizer_idempotence/path_finalization_coverage 2452/2475 — every failing gate's deficit equals exactly 23 cases at its own population scale; monotonic split failed only finalizer_idempotence + path_finalization_coverage (360/400). Attempt consumed; no RC_002; do not repair in place. Next=`MAI-07R3N5-FRESH-HOLDOUT-IDENTITY-ANCHOR-CORRECTIVE`. MAI-08 NOT_STARTED.

**MAI-07R3N5** = `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC`. Fresh explicit-only candidate `mai-07.1.10-r3n5-targetspan` binds evaluation targets to immutable raw Unicode code-point intervals with source/surface digests. Dataset = 5,075 cases; development = 900; one-shot holdout = 2,475. Canonical and independently implemented audit scorers passed per-case and full metric/gate semantic agreement. Critical holdout gates passed: identity/exact/one/anchor 850/850; invariant/cap-pressure 350/350; finalizer-idempotence/path coverage 2475/2475. All supporting splits passed with explicit expected-behavior enforcement. Semantic lock `80bb914f...`; physical lock `743c34b9...`; attempt consumed once; duplicate refused; chain verified. Candidate remains unpromoted, active R3F unchanged, quality/linguist/production flags false. Next=`MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE`. MAI-08 NOT_STARTED.

## R3B evaluation semantics V2 (populations from Round A)

Authority: Round A `preferred_rank_policy` (not Round B, not frozen V1 labels alone).

| Round A policy | V2 population bucket |
|----------------|----------------------|
| `DEVANAGARI_TARGET_REQUIRED` | `TRANSLITERATION_REQUIRED` |
| `LATIN_IDENTITY_REQUIRED` / `NO_TRANSLITERATION_ALLOWED` | `IDENTITY_REQUIRED` |
| `LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL` | `TRANSLITERATION_OPTIONAL` (report separately; optional Devanagari ≠ required-target top-1) |
| `BOTH_EQUAL_REVIEW_REQUIRED` / `CANNOT_DECIDE` | `HUMAN_REVIEW_REQUIRED` |

Candidate labels: `ACCEPTABLE_PREFERRED` top-1 eligible only when Round-A-compatible and uniquely preferred for the required role; multiple bulk-mapped preferred must record ambiguity; `UNNATURAL_BUT_POSSIBLE` diagnostic only; `CANNOT_DECIDE` never inferred as correct.

Official five-label Round B used in R3B is an explicit product-owner bulk schema mapping of the locked three-label review — not professional-linguist five-label adjudication. Round B never overwrites Round A.

## Human adjudication vs training

Cases marked `prohibited_for_training=true` may still be used for human evaluation/adjudication.
Model training on them remains prohibited. Review import objects and blind mapping are training-prohibited.

## Score-impact previews

Reviewers must not receive score-impact information (e.g. 261/316, “need 18 more”).
Engineering impact simulators may run only after reviews and ADR acceptance are locked.

## Blinded review

R3A packets hide case IDs, ranks, scores, populations, and conflict flags from reviewers.
Blind mapping is for import only.
