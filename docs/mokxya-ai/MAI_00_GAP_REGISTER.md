# MAI-00 Gap Register

Severity legend:

- **P0** — wrong mutation, financial corruption, tenant exposure, false legal/accounting claim, or launch-critical failure
- **P1** — required before public release
- **P2** — important maturity issue
- **P3** — improvement or cleanup

---

## P0

### GAP-P0-001 — OEC is not the sole mutation authority

- **Severity:** P0
- **Affected capability:** action runtime / OEC / purchases / sales / settlements
- **Evidence:** `src/lib/ekhata/orbixPostingService.ts` `executeOrbixConfirm`; domain `post*Transaction`; `erp_bot/src/api/orbix_drafts.py` Model B comment; Dexie writes; Node `executeKhataConfirm`
- **User/business impact:** Architecture docs claiming OEC-only mutation mislead operators; dual ledgers risk divergence
- **Current mitigation:** Orbix UI documents Model B (Dexie authoritative); domain engines have tests
- **Required remediation:** Explicit authority policy + convergence plan; stop claiming sole-OEC until true
- **Recommended MAI phase:** MAI-01 (policy) then MAI-34 (confirm/OEC dispatch) / MAI-35 (sync)
- **Dependencies:** ADR-0001 acceptance; sync map
- **Acceptance condition:** Single documented write authority enforced by tests; alternate paths classified and gated
- **Status:** OPEN
- **Progress (2026-07-19):** MAI-34 slices 1–2 annotate confirm/OEC policy and emit `CANDIDATE_ONLY` `confirm_oec_candidate` (`nl_assent_posts=false`, `product_mutation_path=DEXIE_EXECUTE_ORBIX_CONFIRM`, `action_to_oec_status=NOT_PRODUCT_PATH`, `gap_p0_001_status=OPEN`). Live `allow_confirm_dispatch` / `allow_oec_dispatch` forced false. Does **not** close the gap (dual writers still active; no token mint / OEC / Dexie post).

### GAP-P1-010 — Transliteration V1 target labels contradict English/name identity safety

- **Severity:** P1
- **Affected capability:** MAI-07 Romanized candidate transliteration quality gates
- **Evidence:** Recomputed conflict set N=49 (`TRANSLITERATION_REQUIRED` with identity@1 and target in ranks 2–5) splits into english_identity (31) and name-like (18); English-suite overlaps english_identity surfaces
- **User/business impact:** Cannot simultaneously satisfy target top-1 ≥0.88 and English/name identity-first safety without human policy adjudication
- **Current mitigation:** Active runtime restored to pre-R1 baseline; R2 overlay disabled; R3B imported locked Round A/B; ADR_0009 Option A = `PRODUCT_POLICY_APPROVED_IMPLEMENTATION_PENDING`; evaluation semantics V2 planned (dataset V2 not built)
- **Required remediation:** Build/freeze dataset V2 from Round-A populations + non-vacuous candidate rules; run separately authorized quality eval; keep runtime unchanged until then
- **Recommended MAI phase:** MAI-07R3C (dataset V2 / non-vacuous quality)
- **Dependencies:** R3B import complete; optional professional linguist for `LINGUIST_APPROVED`
- **Acceptance condition:** Populations/labels consistent with Option A; frozen quality gates pass once under locked policy (separate authorization)
- **Status:** REDUCED — product-policy ambiguity resolved; V2 dataset built; residual open via GAP-P1-011 quality fail

### GAP-P1-011 — Non-vacuous MAI-07 frozen V2 quality still open

- **Severity:** P1
- **Affected capability:** MAI-07 automated frozen quality gates
- **Evidence:** R3E FAILED_QUALITY (English 98/102; false-Dev 4/102). R3G-REAUTHORIZED-002 one-shot frozen V2 (2026-07-16) FAILED_QUALITY with identical English identity metrics. R3F sealed non-frozen RC passed holdout but frozen eval unchanged on safety gates.
- **Updated evidence:** MAI-07R3H2 sealed non-frozen `PASSED_CORRECTIVE_RC`. MAI-07R3I (2026-07-16) one-shot frozen V2 of R3H2 RC = `FAILED_QUALITY`: TARGET_TOP1 240/288, UNAMBIGUOUS 228/255, ENGLISH 99/102, FALSE_DEV 3/102, PROTECTED 6. Attempt consumed; no automatic rerun.
- **R3P update (2026-07-18):** V3 human-review freeze consumed into `MAI_07_ROMANIZED_TRANSLITERATION_V3` (hash `6ad2a824…`, 1111 cases). Thresholds locked pre-observation. R3P-2 one-shot of `mai-07.1.11-r3n6-chaincomplete` on FROZEN_EVALUATION (583) = `FAILED_QUALITY` — sole failing gate `protected_mutations` 40/155 (false positives from first-token extract fallback). Attempt consumed.
- **R3Q update (2026-07-18):** New candidate `mai-07.1.12-r3q-protspan` + highlight-range protected-span alignment. One-shot `MAI_07R3Q_FROZEN_V3_ATTEMPT_001` = `PASSED_QUALITY` (protected_mutations 0/155; all applicable gates pass). Candidate not promoted; active runtime unchanged; `PRODUCTION_APPROVED` still false.
- **User/business impact:** V3 quality gates now pass on frozen evaluation; production/runtime promotion still gated separately
- **Current mitigation:** V3 FE one-shot passed under R3Q; promotion withheld pending separate authorization
- **Required remediation:** Explicit production-approval / runtime-promotion decision (do not silently promote)
- **Recommended MAI phase:** MAI-07R3R-PRODUCTION-APPROVAL-OR-RUNTIME-PROMOTION
- **Dependencies:** ADR_0010; ADR_0022; MAI-07R3Q closeout
- **Acceptance condition:** `QUALITY_GATES_PASSED` only after authorized frozen eval that passes on a governed **V3** benchmark — **met by R3Q**
- **Status:** CLOSED — V3 FE quality gates passed under R3Q; **R3R / ADR_0023** also set `PRODUCTION_APPROVED=true` with `CUTOVER_AUTHORIZED=true`; live active runtime cutover remains open as MAI-07R3S (`candidate_promoted=false`)

### GAP-P1-017 — Qualified R3N6 path not yet cut over to active default

- **Severity:** P1
- **Affected capability:** MAI-07 production transliteration active path
- **Evidence:** ADR_0024 cutover completed 2026-07-18. Active is now `mai-07.1.13-r3s-active` + pack `mai-07.1.11-r3n6-chaincomplete` (`8b57db0f…`). Previous active `mai-07.1.3-r3f-sealnew` retained for lineage.
- **User/business impact:** Default transliteration path now uses V3-qualified R3N6 behavior
- **Current mitigation:** N/A — cutover done
- **Required remediation:** None
- **Recommended MAI phase:** MAI-07R3S (complete)
- **Dependencies:** ADR_0023; ADR_0024; MAI-07R3Q; MAI-07R3N6
- **Acceptance condition:** Active defaults point at qualified R3N6 path; `candidate_promoted=true` — **met**
- **Status:** CLOSED

### GAP-P1-016 — Independent V3 human review not yet completed

- **Severity:** P1
- **Affected capability:** MAI-07 V3 benchmark adjudication / linguist path
- **Evidence:** Round A + Round B locked under official inbox; freeze sealed `MAI_07_V3_HUMAN_REVIEW_FREEZE_MANIFEST.json`; ADR_0022. Earlier quarantined `__AI_ASSISTED_DRAFT` path remains non-authoritative (ADR_0021/ADR_0011). Round B used product-authorized Option A mechanical remap.
- **User/business impact:** V3 human-review freeze available; production/quality gates still separate
- **Current mitigation:** Freeze sealed; runtime not promoted
- **Required remediation:** None for R3O review-evidence scope
- **Recommended MAI phase:** MAI-07R3O (complete for review freeze) → MAI-07R3P governed eval / freeze consumption
- **Dependencies:** GAP-P1-012
- **Acceptance condition:** Locked Round A/B + adjudication with professional-linguist evidence package — **met under ADR_0022** (adjudication N/A: 0 disagreements)
- **Status:** CLOSED (2026-07-18) for R3O independent V3 human-review evidence — does not set `QUALITY_GATES_PASSED` or `PRODUCTION_APPROVED`

### GAP-P2-021 — AI-assisted ACCOUNTING_DOMAIN Round A engineering evidence imported (non-authoritative)

- **Severity:** P2 (engineering process)
- **Affected capability:** MAI-07 diagnostic labeling / importer integrity
- **Evidence:** `PASSED_ENGINEERING_IMPORT` — `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/accounting_domain/`; semantic hash `b96bec29…`; ADR_0011
- **User/business impact:** None for production; clarifies that AI-assisted labels are available for diagnostics without upgrading governance
- **Current mitigation:** Separate path; hard-coded false independent/linguist/frozen-gold flags; official inbox untouched
- **Required remediation:** None for engineering import; independent review still via GAP-P1-016
- **Recommended MAI phase:** MAI-07R3J-AI-ASSISTED-ACCOUNTING-IMPORT (complete for import only)
- **Dependencies:** none
- **Acceptance condition:** Fail-closed importer + 611-row canonical JSONL + deterministic semantic hash + tests
- **Status:** REDUCED / CLOSED for engineering-import scope only (2026-07-17) — does not close GAP-P1-016 or GAP-P1-012

### GAP-P2-022 — Remaining-role AI-assisted Round A drafts pending user acceptance

- **Severity:** P2 (engineering process)
- **Affected capability:** MAI-07 AI-assisted draft review aids for PRODUCT_POLICY / NEPALI_FLUENT_A / PROFESSIONAL_LINGUIST_B
- **Evidence:** Draft generation completed; user accepted without changes 2026-07-17; verified engineering import under `mai07_v3_ai_assisted/remaining_roles/` (semantic hash `1cc783d7…`)
- **User/business impact:** None for production; engineering diagnostics only
- **Current mitigation:** Segregated path; not in official inbox; not lock-eligible; linguist simulation flagged
- **Required remediation:** Independent review still via GAP-P1-016; professional linguist still via GAP-P1-012
- **Recommended MAI phase:** MAI-07R3J-AI-ASSISTED-REMAINING-ROLES-IMPORT
- **Dependencies:** GAP-P2-021
- **Acceptance condition:** User-accepted verified import of 3333 rows with hard-coded false independent/linguist/frozen-gold flags
- **Status:** REDUCED / CLOSED for engineering-import scope only (2026-07-17) — does not close GAP-P1-016 or GAP-P1-012

### GAP-P2-023 — Cross-role AI agreement contaminated by shared draft generator

- **Severity:** P2 (evaluation interpretation)
- **Affected capability:** MAI-07 multi-role agreement interpretation
- **Evidence:** MAI-07R3K three/four-role disposition agreement = 1.0 because remaining roles inherited accounting map (611) + shared HEURISTIC_V1 (500); ADR_0012
- **User/business impact:** Risk of mistaking AI self-consistency for independent human reliability
- **Current mitigation:** Explicit non-IRR labeling; `majority_as_gold=false`; risk queue for soft/heuristic/safety cases
- **Required remediation:** Independent human Round A/B (GAP-P1-016) before any consensus-as-quality claim
- **Recommended MAI phase:** MAI-07R3K (diagnostic complete) → independent review
- **Dependencies:** GAP-P1-016
- **Acceptance condition:** N/A for closing independent review; diagnostic documents contamination
- **Status:** OPEN (interpretation risk) — engineering diagnostic delivered 2026-07-17

### GAP-P2-024 — R3K conversational hybrid hash citation (report-only)

- **Severity:** P2 (documentation integrity)
- **Affected capability:** MAI-07R3K input authority citations
- **Evidence:** Conversational abbreviation joined accounting semantic prefix `b96bec29` with ZIP raw suffix `1cdb68`; canonical JSON already had full semantic `b96bec29…e363b`; MAI-07R3K-CLOSURE `PASSED_CLOSURE` / `REPORT_ONLY`
- **User/business impact:** None for runtime; risk of confusing hash types in follow-on phases
- **Current mitigation:** `R3K_INPUT_AUTHORITY_MANIFEST.json` + typed hash-contract validation/tests; historical R3K bytes preserved
- **Required remediation:** None beyond closure (complete)
- **Recommended MAI phase:** MAI-07R3K-CLOSURE (complete) → MAI-07R3L diagnostic
- **Dependencies:** MAI-07R3K
- **Acceptance condition:** Explicit authority manifest; hybrid rejected by tests; R3K semantic preserved
- **Status:** CLOSED (2026-07-17) — report-only; does not close GAP-P1-016 / GAP-P1-012

### GAP-P2-025 — Active runtime vs AI policy-reference behavioral mismatches

- **Severity:** P2 (engineering diagnostic)
- **Affected capability:** MAI-07 runtime policy conformance interpretation
- **Evidence:** MAI-07R3L — PASS 769 / FAIL 328 / SPAN_FAILURE 14; Devanagari script-candidate present@5 = 142/316; residual 829; ADR_0013. MAI-07R3N5 then earned `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC` on one immutable 2,475-case holdout attempt: identity/exact/one/anchor 850/850, invariant/cap-pressure 350/350, and finalizer-idempotence/path coverage 2475/2475.
- **User/business impact:** None for production; clarifies policy gaps without quality claims
- **Current mitigation:** R3N5 corrective RC sealed and unpromoted; active runtime remains `mai-07.1.3-r3f-sealnew`; `runtime_conformance_is_language_quality=false`
- **Required remediation:** Corrective-RC authority completed by R3N5; independent review remains GAP-P1-016 and professional-linguist approval remains GAP-P1-012
- **Recommended MAI phase:** MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE
- **Dependencies:** MAI-07R3L; MAI-07R3M; MAI-07R3N-INTEGRITY-CLOSURE; MAI-07R3N2; MAI-07R3N3; MAI-07R3N4; MAI-07R3N5
- **Acceptance condition:** Fresh versioned candidate + immutable locked holdout + exact R3N5 minima + consumed one-shot chain — **met for corrective-RC authority**
- **Status:** CLOSED for corrective-RC authority (2026-07-18) — does not close GAP-P1-016, GAP-P1-012, parent MAI-07, or authorize MAI-08

### GAP-P2-026 — R3L residual conflation of risk-only vs actionable mismatch

- **Severity:** P2 (evaluation interpretation)
- **Affected capability:** MAI-07 residual-queue interpretation
- **Evidence:** MAI-07R3M — of 829 residuals, 487 are RISK_ONLY_PASS; 328 ACTUAL_CONFORMANCE_FAILURE; 14 SPAN_FAILURE; ADR_0014
- **User/business impact:** Risk of overstating runtime defects if residual size is cited as defect count
- **Current mitigation:** Explicit observation classes + queues; diagnostic-only risk queue
- **Required remediation:** None for triage scope (complete)
- **Recommended MAI phase:** MAI-07R3M (complete)
- **Dependencies:** MAI-07R3L
- **Acceptance condition:** 829 reconcile; risk-only separated
- **Status:** CLOSED for triage scope (2026-07-17)

### GAP-P2-028 — R3N2 identity retention under cap-pressure holdout analogues

- **Severity:** P2 (engineering holdout quality)
- **Affected capability:** MAI-07R3N2 fresh-holdout identity retention / invariant-analogue gates
- **Evidence:** MAI-07R3N2 Attempt 001 — `identity_retention` 148/150; `identity_invariant_analogue` 98/100 under `CANDIDATE_CAP_PRESSURE` holdout analogues; english/romanized/acronym/identifier/protected gates passed at full strength
- **User/business impact:** None for production (active runtime unchanged); blocks corrective-RC promotion and frozen-V3 eligibility
- **Current mitigation:** Verdict recorded as `FAILED_HOLDOUT_QUALITY`; one attempt consumed; superseded by R3N3 corrective attempt (also failed)
- **Required remediation:** Addressed by R3N3 reserved-identity finalizer (Attempt 001 still failed — see GAP-P2-029)
- **Recommended MAI phase:** MAI-07R3N3-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE (complete)
- **Dependencies:** MAI-07R3N2; MAI-07R3N-INTEGRITY-CLOSURE
- **Acceptance condition:** Holdout gates `identity_retention` and `identity_invariant_analogue` pass at == 1.0 on a fresh locked holdout
- **Status:** CLOSED (2026-07-18) — R3N3 shipped; residual failure tracked in GAP-P2-029

### GAP-P2-029 — R3N3 residual exact-identity gaps under multi-token cap-pressure after reserved finalizer

- **Severity:** P2 (engineering holdout quality)
- **Affected capability:** MAI-07R3N3 reserved-identity finalizer — exact raw identity, cap-pressure retention, finalizer idempotence
- **Evidence:** MAI-07R3N3 Attempt 001 — `identity_retention` 288/300; `exact_raw_identity` 288/300; `exactly_one_identity` 288/300; `identity_invariant_analogue` 238/250; `cap_pressure_identity_retention` 238/250; `finalizer_idempotence` 1188/1200; english 325/325; false-dev 0/325; romanized/acronym/identifier/protected/caps passed; monotonic split failed only `finalizer_idempotence`
- **User/business impact:** None for production (active runtime unchanged); blocks corrective-RC promotion and frozen-V3 eligibility
- **Current mitigation:** Verdict `FAILED_HOLDOUT_QUALITY`; one attempt consumed; lock immutable; R3N4 specified
- **Required remediation:** New candidate version and fresh holdout under R3N4 protocol — not in-place R3N3 repair
- **Recommended MAI phase:** MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE
- **Dependencies:** MAI-07R3N3; MAI-07R3N2; MAI-07R3N-INTEGRITY-CLOSURE
- **Acceptance condition:** Holdout identity gates and `finalizer_idempotence` pass at == 1.0 on a fresh locked holdout
- **Status:** CLOSED (2026-07-18) — R3N4 shipped an identity-anchor construction contract and path-finalization registry; residual failure tracked in GAP-P2-030

### GAP-P2-030 — R3N4 residual identity/cap-pressure/path-finalization gaps after identity-anchor and path-registry corrective

- **Severity:** P2 (engineering holdout quality)
- **Affected capability:** MAI-07R3N4 identity-anchor construction (`IdentityAnchorV1`) and path-finalization registry — exact raw identity, anchor validity, cap-pressure retention, finalizer idempotence, path-finalization coverage
- **Evidence:** MAI-07R3N4 Attempt 001 — `identity_retention`/`exact_raw_identity`/`exactly_one_identity`/`anchor_validity` 827/850; `identity_invariant_analogue`/`cap_pressure_identity_retention` 327/350; `finalizer_idempotence`/`path_finalization_coverage` 2452/2475; every failing gate's deficit equals exactly 23 cases at its own population scale. MAI-07R3N5 Attempt 001 passed the corresponding gates at 850/850, 350/350, and 2475/2475 under immutable raw target-span authority.
- **User/business impact:** None for production (active runtime unchanged); blocks corrective-RC promotion and frozen-V3 eligibility
- **Current mitigation:** R3N4 failure evidence remains immutable; R3N5 passed as a new candidate and one-shot chain; candidate remains unpromoted
- **Required remediation:** Completed by R3N5 target-span and physical-lock authority; independent V3 review remains separate
- **Recommended MAI phase:** MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE
- **Dependencies:** MAI-07R3N4; MAI-07R3N3; MAI-07R3N2; MAI-07R3N-INTEGRITY-CLOSURE
- **Acceptance condition:** Holdout identity, cap-pressure, `finalizer_idempotence`, and `path_finalization_coverage` gates pass at == 1.0 on a fresh locked holdout — **met by R3N5**
- **Status:** CLOSED (2026-07-18) — corrective engineering scope only; parent MAI-07 remains open

### GAP-P2-027 — R3M Tier-1 reason counts presented without counting units

- **Severity:** P2 (evaluation interpretation)
- **Affected capability:** MAI-07R3M Tier-1 reporting
- **Evidence:** Pre-closure prose `FALSE_FORCED_DEVANAGARI_TOP1×8; IDENTITY_NOT_TOP1×5; ABSTAIN_FORCE×3` mixed occurrence counts with unique-case language; ENGLISH metric false_devanagari=5/241 ≠ occurrence 8
- **User/business impact:** Apparent inconsistency with R3L metrics; risk of wrong primary/secondary triage interpretation
- **Current mitigation:** MAI-07R3M-CLOSURE `PASSED_CLOSURE` / `REPORT_ONLY`; primary partition 5+3=8; R3M semantic preserved
- **Required remediation:** None for membership/queues (already correct); reporting units enforced going forward
- **Recommended MAI phase:** MAI-07R3M-CLOSURE (complete) → MAI-07R3N
- **Dependencies:** MAI-07R3M
- **Acceptance condition:** Primary reasons partition |T|=8; canonical↔audit agree; code queue authority proven
- **Status:** CLOSED (2026-07-18) — report-only; does not close GAP-P1-016 / GAP-P1-012

### GAP-P1-013 — R3F sealed resource / holdout prediction integrity drift

- **Severity:** P1
- **Affected capability:** MAI-07R3G frozen evaluation preconditions / R3F RC validity
- **Evidence:** Historical pack unrestorable (`e94cc8c…`). Holdout predictions valid under canonical-list contract `b5cdb56f…`. SEAL-NEW created pack `mai-07.1.3-r3f-sealnew` (`16174253…`) + RC `MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001` under seal-contract 2.0.0; fresh holdout passed.
- **User/business impact:** Original R3F RC cannot be used for frozen V2; new RC is the active candidate
- **Current mitigation:** Historical RC `INVALIDATED_BY_SEAL_DRIFT`; new sealed pack + fresh holdout
- **Required remediation:** Completed for seal integrity via **MAI-07R3F-SEAL-NEW**
- **Recommended MAI phase:** MAI-07R3F-SEAL-LOCK-CHAIN then re-authorized frozen V2
- **Dependencies:** MAI-07R3F-SEAL-RESTORE complete; SEAL-NEW passed
- **Acceptance condition:** New RC with matching pack/prediction seals under documented contracts — **met**
- **Status:** CLOSED

### GAP-P1-014 — SEAL-NEW lock-before-holdout RC body not preserved

- **Severity:** P1
- **Affected capability:** MAI-07R3G-REAUTHORIZED frozen evaluation preconditions
- **Evidence:** Required lock hash `f4c07e24…` exists only as narrative fields in holdout attempt/score report; no immutable `LOCKED_NOT_RUN` body or append-only lock record containing the full RC. Post-holdout RC semantic `53019222…`. R3G-REAUTHORIZED preflight `BLOCKED_PRECONDITION_FAILED`.
- **User/business impact:** Cannot open frozen V2 against replacement RC until lock chain is verifiable
- **Current mitigation:** Frozen V2 not opened; protocol tests enforce block
- **Required remediation:** **MAI-07R3F-SEAL-LOCK-CHAIN** — publish immutable lock-before-holdout artifact
- **Recommended MAI phase:** MAI-07R3F-SEAL-LOCK-CHAIN
- **Dependencies:** MAI-07R3F-SEAL-NEW
- **Acceptance condition:** Preserved RC body hashes to `f4c07e24…` or governed equivalent lock record with complete body
- **Status:** CLOSED (2026-07-16 — immutable `LOCKED_NOT_RUN` body at `evals/mai07_r3f_seal_new/MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.LOCKED_NOT_RUN.json`; chain manifest verified)

### GAP-P1-015 — Test-induced mutation of sealed non-frozen evaluation evidence

- **Severity:** P1
- **Affected capability:** MAI-07R3H evidence integrity / evaluation artifact immutability
- **Evidence:** `evals/mai07_r3h_english_identity/MAI_07R3H_POST_CLOSEOUT_ARTIFACT_DRIFT.json`. R3H focused-test fixture called `write_datasets()` and `run_split("HOLDOUT_VALIDATION")` against canonical paths, regenerating dataset JSONL and score/prediction reports so current hashes diverge from locked one-shot hashes. LOCK/ATTEMPT/CHAIN/QUALIFICATION remain historical authority.
- **User/business impact:** Risk of silently rewriting sealed evaluation evidence during ordinary pytest runs; confuses closeout and future audits
- **Current mitigation:** Drift sidecar recorded; historical result not reinterpreted; consumed holdout marked non-reusable
- **Required remediation:** Mutation-proof builders/tests (explicit output dirs, tmp_path fixtures, canonical write rejection) under **MAI-07R3H2**
- **Recommended MAI phase:** MAI-07R3H2-SHARED-COLLISION-CORRECTIVE
- **Dependencies:** MAI-07R3H closeout
- **Acceptance condition:** Focused + full language_runtime suites leave canonical/sealed R3H and R3H2 trees unchanged across two consecutive runs
- **Status:** CLOSED (2026-07-16 — `canonical_path_guard.py` + R3H2 builders require explicit `output_dir` / `MAI07_AUTHORIZE_EVAL_WRITE`; focused tests use `tmp_path`; sealed R3H lock/attempt/chain hashes verified unchanged)

### GAP-P1-012 — Professional linguist approval for Nepali transliteration still open

- **Severity:** P1
- **Affected capability:** MAI-07 `LINGUIST_APPROVED`
- **Evidence:** R3O Round A/B locked; coordinator credential verification attestation 2026-07-18; `LINGUIST_APPROVED=true` under ADR_0022 for R3O review-resolution scope only
- **User/business impact:** Professional-linguist review-resolution sign-off recorded; production approval still false
- **Current mitigation:** Attestation + freeze seal; no runtime promotion
- **Required remediation:** None for R3O linguist-approval scope; production still blocked on other gates
- **Recommended MAI phase:** MAI-07R3O (linguist path closed) → later governed quality/production phases
- **Dependencies:** GAP-P1-011 quality path
- **Acceptance condition:** Explicit professional linguist approval artifact — **met under ADR_0022 + coordinator attestation**
- **Status:** CLOSED (2026-07-18) for R3O `LINGUIST_APPROVED` scope — does not set `PRODUCTION_APPROVED` or start MAI-08

### GAP-P0-002 — Unauthenticated `/api/khata/confirm` mutates Postgres from body tenant/company

- **Severity:** P0
- **Affected capability:** settlements / purchases / security / tenant boundary
- **Evidence:** Previously `packages/backend/src/routes/khata.ts` confirm without auth; now `requireKhataConfirmAuth` + JWT scope overwrite (`khataConfirmAuth.ts`); tests in `khataConfirmAuth.test.ts`
- **User/business impact:** Mitigated for confirm route — anonymous callers receive 401; spoofed body tenant/company denied
- **Current mitigation:** JWT auth + role check + body identity overwrite from trusted principal
- **Required remediation:** Completed for confirm path; ensure deploy secrets configured
- **Recommended MAI phase:** MAI-01
- **Dependencies:** auth middleware, khata-app `VITE_KHATA_ACCESS_TOKEN`
- **Acceptance condition:** Unauthenticated confirm returns 401; tenant spoof integration test fails closed
- **Status:** CLOSED

### GAP-P0-003 — Production OIP auth defaults allow unauthenticated / weak identity

- **Severity:** P0
- **Affected capability:** conversation / security / tenant
- **Evidence:** `render.yaml` now `OIP_AUTH_REQUIRED=true`; empty `OIP_DEFAULT_SERVICE_TENANT_ID`; `validate_production_security_config`; ingress no longer synthesizes `company-a`/`orbix-user`/`tenant-a`
- **User/business impact:** Production fails closed without auth/secret; body cannot establish identity
- **Current mitigation:** Startup config guard + trusted principal binding on Orbix stream
- **Required remediation:** Completed for production config path; operators must set `OIP_JWT_SECRET`/`API_SECRET_KEY`
- **Recommended MAI phase:** MAI-01
- **Dependencies:** frontend token plumbing (`readAccessToken`)
- **Acceptance condition:** Production startup fails closed without auth; no tenant-a default in prod
- **Status:** CLOSED

### GAP-P0-004 — OIP HTTP module routers fail to mount (planner relative import)

- **Severity:** P0 (launch-critical for `/oip/v1` surface; chat ingress may still load)
- **Affected capability:** planner / OIP API / provider tooling
- **Evidence:** Fixed `..application` / `..domain` imports in `planner/api/router.py` and `router/api/router.py`; `from src.oip.api import router` succeeds; server mounts `/oip/v1`; collect errors 39→1 unrelated
- **User/business impact:** `/oip/v1` mounts again
- **Current mitigation:** Narrow relative-import correction + `test_mai01_oip_import.py`
- **Required remediation:** Completed
- **Recommended MAI phase:** MAI-01
- **Dependencies:** none
- **Acceptance condition:** `from src.oip.api import router` succeeds; server mounts `/oip/v1`
- **Status:** CLOSED

---

## P1

### GAP-P1-001 — Multiple parallel AI stacks still HTTP-reachable

- **Severity:** P1
- **Affected capability:** conversation / planner / memory
- **Evidence:** `server.py` mounts NIOS `/nios/v1`, Orbix v2 `/orbix/v2`, streaming `/v2/chat`, khata routes alongside Orbix OIP ingress
- **User/business impact:** Inconsistent behavior, duplicated memory/session stores, harder security review
- **Current mitigation:** SPA primarily uses `/orbix/chat/stream`
- **Required remediation:** Capability flags; deprecate or authenticate secondary stacks
- **Recommended MAI phase:** MAI-01 / MAI-16
- **Dependencies:** traffic metrics
- **Acceptance condition:** Non-canonical stacks blocked in production or explicitly gated
- **Status:** OPEN

### GAP-P1-002 — Dual sync authorities (event sync + legacy outbox + khata confirm)

- **Severity:** P1
- **Affected capability:** sync / audit
- **Evidence:** `syncEngine.ts`, `syncCoordinator.ts`, `packages/backend` sync routes, khata confirm inserts
- **User/business impact:** Duplicated or diverging server state; conflict UX risk
- **Current mitigation:** `syncEnqueueRouter` blocks some accounting entities from legacy outbox
- **Required remediation:** Single write→outbox narrative; conflict UX (MAI-35)
- **Recommended MAI phase:** MAI-35
- **Dependencies:** posting authority decision
- **Acceptance condition:** One authoritative sync path for accounting events; tests for two-device conflict
- **Status:** OPEN
- **Progress (2026-07-19):** MAI-35 slices 1–2 annotate offline/sync policy and emit `CANDIDATE_ONLY` `offline_sync_candidate` (`conflict_policy=REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT`, `reversal_policy=GOVERNED_CORRECTION_ONLY`, `queued_must_not_label_synced=true`, `dual_sync_status=OPEN`, `gap_p1_002_status=OPEN`). Live `allow_sync_push` / `allow_conflict_resolve` / `allow_reversal_dispatch` forced false. Does **not** close the gap (dual sync workers still active; no enqueue / resolve / reversal).

- **Severity:** P1
- **Affected capability:** security
- **Evidence:** Production path now throws in Node `getJwtSecret` and OIP `validate_production_security_config`; non-prod may still use dev default
- **User/business impact:** Mitigated in production
- **Current mitigation:** Fail-closed production secret validation
- **Required remediation:** Ensure Render secrets set; optional remaining: remove syncEvents duplicate default
- **Recommended MAI phase:** MAI-01 / MAI-44
- **Dependencies:** deploy config
- **Acceptance condition:** Production boot refuses missing secret
- **Status:** REDUCED (production fail-closed; non-prod default remains for local DX)

### GAP-P1-004 — Language stack mixes regex intent + draft merge without full turn-relation

- **Severity:** P1
- **Affected capability:** language / drafts / intent
- **Evidence:** `operation_classifier.py` regex intents including `purchase_clarification`; `mode_aware_erp.py` loads pending drafts and merges via `start_or_merge_*`
- **User/business impact:** Stale draft may capture new topic; wrong event class
- **Current mitigation:** Operation classifier + mode-aware incomplete-field checks
- **Required remediation:** Turn-relation before draft merge (MAI-14); EventFrame registry (MAI-18/19)
- **Recommended MAI phase:** MAI-14
- **Dependencies:** MAI-05–09 language foundations preferred
- **Acceptance condition:** New-topic turns do not silently merge into pending purchase drafts (tests)
- **Status:** REDUCED (not closed)
- **Progress (2026-07-19):** MAI-14 slice 2 gates pending merge on `TurnRelationV1` (`allows_pending_merge`). Does **not** claim full MAI-04 `context_turn_relation_v1` green or production approval.

### GAP-P1-005 — Python test suite largely ENVIRONMENT-BLOCKED in this checkout

- **Severity:** P1
- **Affected capability:** quality gates
- **Evidence:** After MAI-01 import fix: `pytest erp_bot/tests --collect-only` → 684 collected, 1 unrelated error (`src.orbix.llm.reasoning_filter`); focused MAI-01 tests green
- **User/business impact:** Most OIP tests collectible again
- **Current mitigation:** Narrow import fix
- **Required remediation:** Fix remaining Orbix v2 `reasoning_filter` module or quarantine those tests
- **Recommended MAI phase:** hygiene / MAI-04
- **Dependencies:** GAP-P0-004 (closed)
- **Acceptance condition:** Documented pytest command collects and passes baseline subset
- **Status:** REDUCED

### GAP-P1-006 — Ask Mode constitution not globally executable across all stacks

- **Severity:** P1
- **Affected capability:** ask mode / mutations
- **Evidence:** Central constitution now enforced on Orbix ingress/mode_aware/mark-posted/Node confirm; parallel NIOS/Orbix-v2/v2 stacks still exist
- **User/business impact:** Reduced on primary Orbix path; secondary stacks remain risk
- **Current mitigation:** MAI-01 matrix on primary path; Ask UI hides confirm
- **Required remediation:** Gate or retire secondary stacks (GAP-P1-001)
- **Recommended MAI phase:** MAI-16 / capability flags
- **Dependencies:** auth
- **Acceptance condition:** Ask mode cannot reach mutation tools/endpoints in production matrix tests
- **Status:** REDUCED (partial — primary path closed; secondary stacks open)

### GAP-P1-007 — Number-role extraction conflates first numerals with money (MAI-04 baseline)

- **Severity:** P1
- **Affected capability:** number roles / drafts
- **Evidence:** Frozen suite `number_roles_v1` / critical case `first_not_money`; component/pipeline baselines fail number-role scorer; `FIRST_NUMBER_AS_MONEY_CONFUSION` when observed
- **Representative cases:** `mai04_num__first_not_money_*`, duration-as-money risks in `mai04_crit__rent_5_months_*`
- **User/business impact:** Wrong amounts/durations/invoice ids in drafts
- **Current mitigation:** Harness measures; product not tuned in MAI-04
- **Required remediation:** Dedicated number-role pipeline
- **Recommended MAI phase:** MAI-09
- **Status:** REDUCED (not closed)
- **Progress (2026-07-19):** MAI-09 `PASSED_ENGINEERING` — duration/ID/unknown defaults, word numerals, BS/AD candidates on LanguageFrame. Does **not** claim full MAI-04 `number_roles_v1` suite green or production approval.

### GAP-P1-008 — Turn-relation / stale-draft topic change weak (MAI-04 baseline)

- **Severity:** P1
- **Affected capability:** conversation / drafts
- **Evidence:** Suite `context_turn_relation_v1` (35 cases); lexicon classifier + merge gate landed in MAI-14
- **Representative cases:** `mai04_ctx__new_after_stale_*`, `mai04_ctx__theft_after_stale_*`, `mai04_ctx__yes_no_preview_*`
- **User/business impact:** Stale draft capture; confirm-without-preview risk
- **Current mitigation:** MAI-14 annotation + `allows_pending_merge` on mode_aware path
- **Required remediation:** Broader classifier coverage; prove MAI-04 suite
- **Recommended MAI phase:** MAI-14 (related GAP-P1-004)
- **Status:** REDUCED (not closed)
- **Progress (2026-07-19):** Merge gate + critical evals; full frozen suite not claimed green.

### GAP-P1-009 — Multilingual / Romanized / code-mix understanding incomplete (MAI-04 baseline)

- **Severity:** P1 (further reduced)
- **Affected capability:** language
- **Evidence:** MAI-05 span detection landed; MAI-06 lossless views (NFC, retrieval casefold/digits/whitespace, candidates) with raw immutable and protected F1 preserved. MAI-07 candidate transliteration authority landed (annotation-only; `LINGUIST_APPROVED=false`). Product MAI-04 multilingual intent quality still often HUMAN_REVIEW/FAILED. Candidates are not consumed by NLU/routing/RAG/UI yet.
- **Representative cases:** `mai04_multi__rom*`; MAI-05/06/07 shards under `evals/mai05`, `evals/mai06`, `evals/mai07`
- **User/business impact:** Shop language still mis-parsed for intent/event until MAI-08+ gated consumption
- **Current mitigation:** LanguageFrame + NormalizationBundle + TransliterationBundle before intent; legacy `text_normalize` isolated
- **Required remediation:** MAI-08 code-mix/typo; linguist review of MAI-07; MAI-11 response language
- **Recommended MAI phase:** MAI-08
- **Status:** REDUCED (not closed)
- **Status:** OPEN (normalization foundation landed; multilingual product weakness not closed)
- **Progress (2026-07-19):** MAI-08 `PASSED_ENGINEERING`; MAI-10 `PASSED_ENGINEERING`; MAI-11 slice 1 `IN_PROGRESS` (response language/register policy). Does **not** close this gap.

---

## P2

### GAP-P2-008 — Knowledge/no-answer & citation honesty incomplete (MAI-04 baseline)

- **Severity:** P2
- **Affected capability:** knowledge / legal claims
- **Evidence:** Suite `knowledge_no_answer_v1` (15); professional review required
- **Representative cases:** `mai04_know__fake_cite_*`, `mai04_know__tax_current_*`
- **User/business impact:** Hallucinated legal authority risk
- **Current mitigation:** Expected safe no-answer in harness; product not upgraded in MAI-04
- **Required remediation:** RAG/evidence gates MAI-24–30
- **Recommended MAI phase:** MAI-24+
- **Status:** OPEN
- **Progress (2026-07-19):** MAI-24–30 engineering path landed (governance → hybrid → claim-citation abstain). MAI-36–42 `PASSED_ENGINEERING`. MAI-43 slices 1–2 declare continuous-change intelligence policy and emit `CANDIDATE_ONLY` `continuous_change_candidate` (`release_status=NOT_RELEASED`, `allow_change_apply=false`, `allow_cache_invalidate=false`, `unreviewed_as_production_truth=false`, `change_applied=false`, `legal_effective_dates_proven=false`, `gap_p2_008_status=OPEN`). Does **not** close the gap (professional honesty review + suite sign-off still required).

### GAP-P2-001 — Chroma/Ollama RAG vs Groq production chat mismatch

- **Severity:** P2
- **Affected capability:** knowledge retrieval
- **Evidence:** `DEPLOYMENT.md` Render skips Ollama/Chroma ingest; production Groq path
- **User/business impact:** Dev RAG quality ≠ production retrieval
- **Current mitigation:** NP KB lexical sqlite indexes + deterministic ERP
- **Required remediation:** Provider-independent retrieval for prod
- **Recommended MAI phase:** MAI-27–30
- **Dependencies:** knowledge governance
- **Acceptance condition:** Prod retrieval does not require Ollama
- **Status:** OPEN
- **Progress (2026-07-19):** MAI-27/28 `PASSED_ENGINEERING`. MAI-29 slice 2 assembles unverified evidence candidates (`LEXICAL_ONLY` default; optional `RRF_APPLIED`). Does **not** close the gap (claim/citation verification still MAI-30; hybrid semantic leg still Ollama-tied).

### GAP-P2-002 — Frontend calculates authoritative-looking totals

- **Severity:** P2
- **Affected capability:** frontend / accounting
- **Evidence:** invoice forms, `voucherSlice`, domain validation in client
- **User/business impact:** Drift if another writer differs; acceptable for Model B but increases dual-calc risk with Node
- **Current mitigation:** Domain paisa validation; vitest
- **Required remediation:** Clear calc ownership docs; parity tests with any server writer
- **Recommended MAI phase:** MAI-33
- **Dependencies:** authority decision
- **Acceptance condition:** Documented single calc owner per flow with parity tests
- **Status:** OPEN
- **Progress (2026-07-19):** MAI-33 slice 1 annotates `ui_calculates_authoritative_totals=false`, `calc_authority_on_confirm=DEXIE_DOMAIN_ENGINE`, `gap_p2_002_status=OPEN`. Does **not** close the gap (UI/engine parity work still pending).

### GAP-P2-003 — Default OEC/knowledge SQLite tenant-a seeds

- **Severity:** P2
- **Affected capability:** knowledge / OEC
- **Evidence:** `TENANT_A = "tenant-a"` in OEC/memory/knowledge sqlite adapters
- **User/business impact:** Demo contamination of prod-like envs
- **Current mitigation:** Local sqlite
- **Required remediation:** Seed only under explicit DEV flag
- **Recommended MAI phase:** MAI-01
- **Dependencies:** none
- **Acceptance condition:** No tenant-a seed when `NODE_ENV`/`RENDER` production
- **Status:** OPEN

### GAP-P2-004 — TypeScript project still has syntax diagnostics

- **Severity:** P2
- **Affected capability:** quality
- **Evidence:** this audit `npx tsc --noEmit` → 2 errors in `InvoicePrint.tsx` (improved vs historical 127–156 baseline in `docs/typescript-baseline.md`)
- **User/business impact:** CI tsc step may fail
- **Current mitigation:** Historical debt accepted in docs
- **Required remediation:** Fix InvoicePrint syntax
- **Recommended MAI phase:** hygiene / outside MAI track OK
- **Dependencies:** none
- **Acceptance condition:** `tsc --noEmit` exit 0 or updated signed baseline
- **Status:** OPEN

### GAP-P2-005 — Knowledge source zips untracked / large; runtime depends on prebuilt indexes

- **Severity:** P2
- **Affected capability:** language / knowledge
- **Evidence:** untracked `Knowledge source/*.zip`; `kb_lexical.sqlite` present; config `source_dir`
- **User/business impact:** Fresh clone may lack sources; indexes may drift
- **Current mitigation:** Indexes committed/available under `knowledgebase/indexes`
- **Required remediation:** Language data governance (MAI-12)
- **Recommended MAI phase:** MAI-12
- **Dependencies:** storage policy
- **Acceptance condition:** Manifested source + rebuildable indexes
- **Status:** REDUCED (not closed)
- **Progress (2026-07-19):** MAI-12 slice 2 — `KbRebuildabilityReportV1` + documented source→index recipe (`MAI_12_KB_SOURCE_TO_INDEX_REBUILD_PATH.md`). Zips optional; rebuild when sources/processed present. Does **not** claim every fresh clone can rebuild without artifacts.

### GAP-P2-006 — AI pipeline relied on untyped dicts / duplicated FE-BE shapes

- **Severity:** P2
- **Affected capability:** conversation contracts / SSE / draft-preview-receipt discrimination
- **Evidence:** Pre-MAI-02 free-form SSE `complete` + duplicated Orbix types; post-MAI-02 `erp_bot/src/oip/contracts/` schema 1.0.0, adapters, fixtures, `mai02CanonicalContracts.ts` Zod parity
- **User/business impact:** Drift risk (float money, response/payload mismatch, client identity in payload)
- **Current mitigation:** Canonical contracts + TrustedScope separation + unsupported_response fallback + schema `--check`
- **Required remediation:** Strangle remaining Falcon/NIOS stacks; optional OpenAPI→TS codegen later
- **Recommended MAI phase:** MAI-02 (done for active path) / later stranglers
- **Dependencies:** MAI-01 TrustedScope
- **Acceptance condition:** Active Orbix path validates client vs trusted request and COMPLETE envelope
- **Status:** REDUCED

### GAP-P2-007 — Active-path observability lacked safe correlation and redaction

- **Severity:** P2
- **Affected capability:** support diagnosis / privacy / cross-service correlation
- **Evidence:** Pre-MAI-03 OIP `log_event` could accept raw `message`; invalid correlation hints reflected; Node confirm lacked shared correlation; FE had no opaque support reference
- **User/business impact:** Support cannot safely correlate failures; risk of prompt/token leakage in logs
- **Current mitigation:** MAI-03 `mai03_*` authority — TraceContextV1, TraceEventV1, central redaction, Node/FE propagation, structured log sink; lookup policy returns `TRACE_LOOKUP_UNAVAILABLE` without queryable sink
- **Required remediation:** Durable queryable production sink + admin lookup route (later ops); instrument remaining dormant stacks when activated
- **Recommended MAI phase:** MAI-03 (foundation done) / later operations phase
- **Dependencies:** MAI-01 TrustedScope; MAI-02 envelopes
- **Acceptance condition:** One correlation ID across active path; raw text/tokens absent from sink output tests; concurrent isolation proven
- **Status:** REDUCED (foundation closed; durable lookup deferred)

---

## P3

### GAP-P3-001 — Legacy Falcon / Sutra AI client paths remain

- **Severity:** P3
- **Affected capability:** frontend
- **Evidence:** `src/lib/falcon`, `FalconPanel`, package scripts `test:falcon`
- **User/business impact:** Maintenance noise
- **Current mitigation:** Not primary Orbix posting path
- **Required remediation:** Cutover map completion / archival
- **Recommended MAI phase:** cleanup after MAI-16
- **Dependencies:** usage metrics
- **Acceptance condition:** Dead code quarantined or removed with tests updated
- **Status:** OPEN

### GAP-P3-002 — Master roadmap path mismatch

- **Severity:** P3
- **Affected capability:** docs governance
- **Evidence:** Prompt cites `docs/mokxya-ai/...`; file at repo root `MOKXYA_AI_MASTER_ARCHITECTURE_AND_CURSOR_ROADMAP_V1.txt`
- **User/business impact:** Operators may miss the governing doc
- **Current mitigation:** `docs/mokxya-ai/README.md` pointer
- **Required remediation:** Place or link canonical copy under `docs/mokxya-ai/`
- **Recommended MAI phase:** docs hygiene with MAI-00 close
- **Dependencies:** none
- **Acceptance condition:** Single documented canonical path
- **Status:** OPEN

### GAP-P3-003 — AGENTS.md “do not search rest of repo” conflicts with MAI-00 mandate

- **Severity:** P3
- **Affected capability:** engineering process
- **Evidence:** root `AGENTS.md` scope rule vs MAI-00 full-repo audit prompt
- **User/business impact:** Agent confusion
- **Current mitigation:** This phase recorded conflict; MAI-00 prompt followed for audit; edits limited to `docs/mokxya-ai/**`
- **Required remediation:** Amend AGENTS.md with MAI audit exception
- **Recommended MAI phase:** process
- **Dependencies:** owner approval
- **Acceptance condition:** Written precedence rule in AGENTS.md
- **Status:** OPEN

---

## Gap ID uniqueness check

All IDs above are unique: GAP-P0-001…004, GAP-P1-001…011, GAP-P2-001…008, GAP-P3-001…003.
