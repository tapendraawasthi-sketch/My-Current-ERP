# EVALUATION_METRICS

## Classification

- Accuracy = correct / N (non-authoritative alone)
- Precision_c = TP_c / (TP_c + FP_c)
- Recall_c = TP_c / (TP_c + FN_c)
- F1_c = harmonic mean of precision and recall
- Macro-F1 = unweighted mean of F1_c over classes with support

Always publish per-class metrics and confusion matrix alongside any overall accuracy.

## MAI-07 candidate ranking

### C1 diagnostic (evaluator `mai-07.1.1`, populations V1)

Any-acceptable metrics (identity-inclusive) — mathematically consistent after C1, but **not** transliteration-quality proof. Retained as diagnostic only.

### C2 quality (evaluator `mai-07.1.2`, populations V2)

`evals/mai07/baselines/MAI_07_EVAL_POPULATIONS_V2.json`.

For `TRANSLITERATION_REQUIRED` of size N (has ≥1 non-identity Devanagari gold target):

- `acceptable_target_candidates` = frozen acceptables that are not identity and contain Devanagari
- `target_top1` = count(rank-1 is a target hit) / N — **identity at rank-1 is a miss**
- `target_recall_at_k` = count(any target hit in first k) / N — identity does not satisfy
- `target_MRR` = Σ(1/first_target_rank or 0) / N

Produced hit requires: `is_identity=false`, non-IDENTITY kind, surface ≠ source, contains Devanagari, surface ∈ gold targets, script ≠ LATIN.

Identity safety (presence, English/protected/Devanagari identity, abstention) is scored separately and never combined into the transliteration success rate.

Fail-fast invariants apply to target metrics on the shared V2 population.

### R3C dataset-V2 non-vacuous metrics (frozen)

Authority: `evals/mai07/manifests/MAI_07_R3C_POPULATIONS_V2.manifest.json` + scorers `mai-07.r3c.canonical.1.0.0` / `mai-07.r3c.audit.1.0.0`.

Metrics on `TRANSLITERATION_REQUIRED`: `TARGET_TOP1_ACCEPTABLE`, `TARGET_RECALL_AT_1` (= top-1), `TARGET_RECALL_AT_5`, `TARGET_MRR`, plus core/unambiguous slices. Identity never satisfies target metrics. Multiple preferred reported separately; not collapsed to unique gold.

Baseline (pre-R1): `evals/mai07/baselines/MAI_07R3C_BASELINE_V2_QUALITY_REPORT.json` — `QUALITY_GATES_PASSED=false`.

R3E sealed-R3D one-shot: `evals/mai07/r3e/reports/MAI_07R3E_V2_CANONICAL_SCORE_REPORT.json` — `QUALITY_GATES_PASSED=false` (English identity / false-Devanagari); predictions `89ee4789…`. Attempt consumed; no automatic rerun.

R3G-REAUTHORIZED-002 one-shot (RC_002): `evals/mai07/r3g_reauthorized_002/reports/MAI_07R3G_REAUTHORIZED_002_V2_CANONICAL_SCORE_REPORT.json` — `QUALITY_GATES_PASSED=false`; English identity **98/102**, false Devanagari **4/102** (identical numerators to R3E); predictions raw `4e8e0f8c…`, canonical `8c071d49…`. Attempt consumed; prohibited rerun.

R3H non-frozen one-shot corrective (authoritative consumed attempt): `evals/mai07_r3h_english_identity/MAI_07R3H_ENGLISH_IDENTITY_RELEASE_CANDIDATE_001.QUALIFICATION_RESULT.json` + `.CHAIN_MANIFEST.json` — `FAILED_HOLDOUT_QUALITY`; overall English identity **356/356**, false Devanagari on clear English **0/356**, clear Romanized top-1 **229/229**, clear Romanized recall@5 **229/229**, but target-missing-from-top5 **43/229** and unresolved shared identity-review **0/19** failed on holdout. Counterfactual split failed pair-accuracy **0/29**. Note: on-disk `reports/MAI_07R3H_HOLDOUT_VALIDATION_SCORE_REPORT.json` may drift if tests regenerate datasets/scores; do not treat it as the locked attempt. Frozen V2 remained unopened.

R3H2 non-frozen sealed corrective (authoritative): `evals/mai07_r3h2_shared_collision/MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001.QUALIFICATION_RESULT.json` + `.CHAIN_MANIFEST.json` — `PASSED_CORRECTIVE_RC` / `PASSED_HOLDOUT`; population-bound metrics via `r3h2_scoring_contracts` (required empty → `INVALID_REQUIRED_POPULATION`; optional empty → `NOT_APPLICABLE`). Canonical↔audit scorer agreement required. Pack not promoted; product `QUALITY_GATES_PASSED` remains false. Frozen V2 remained unopened.

R3I frozen V2 one-shot (authoritative): `evals/mai07/r3i_frozen_reauthorized/` — `FAILED_QUALITY`. Frozen thresholds/scorers only (not R3H2 non-frozen thresholds). Integer gates: TARGET_TOP1 240/288 FAIL; RECALL@5 281/288 PASS; MRR 0.9045 PASS; CORE@5 267/272 PASS; UNAMBIGUOUS 228/255 FAIL; ENGLISH 99/102 FAIL; FALSE_DEV 3/102 FAIL; PROTECTED 6 FAIL; RAW 0 / CAPS 696/696 / DETERMINISM 1.0 PASS. Canonical↔audit agree. Attempt consumed; no automatic rerun.

V3 metrics (proposed, not locked from candidates): see `docs/mokxya-ai/reviews/mai07_v3/V3_METRIC_DEFINITIONS.md`. Required empty populations → `INVALID_REQUIRED_POPULATION`; optional empty → `NOT_APPLICABLE`; no `max(1, den)`.

AI-assisted ACCOUNTING_DOMAIN Round A evidence (`mai07_v3_ai_assisted/accounting_domain/`) and remaining-role verified evidence (`mai07_v3_ai_assisted/remaining_roles/`) may be used for **engineering diagnostics only**. They must **not** be scored as independent frozen-V3 quality gold, must not set `QUALITY_GATES_PASSED`, and must not enter training or active resource packs. `PROFESSIONAL_LINGUIST_B` AI-assisted labels are an AI role simulation only (`professional_linguist_adjudication=false`).

Cross-role consensus diagnostics (MAI-07R3K) report **non-independent AI-output similarity** only. Majority/unanimous AI dispositions are never gold. Do not cite R3K agreement as human inter-rater reliability.

Hash citations for R3K inputs must use typed authorities (raw ZIP vs semantic object). Display abbreviations must derive from a single full 64-character lowercase SHA-256. Hybrid abbreviations (e.g. mixing semantic prefix with ZIP suffix) are forbidden (`MAI-07R3K-CLOSURE`).

Runtime conformance diagnostics (MAI-07R3L) measure **behavior/policy conformance** against AI-assisted policy references only. Devanagari metrics are script-presence metrics — never target spelling accuracy. Do not cite R3L pass rates as quality-gate readiness (`ADR_0013`).

MAI-07R3N non-frozen policy-conformance metrics are population-bound (no `max(1, denominator)`). Empty required populations on DEVELOPMENT/HOLDOUT → `INVALID_REQUIRED_POPULATION`; empty optional/supporting-split populations → `NOT_APPLICABLE`. `AUTHORIZED_CODE_CORRECTIVE` is DEVELOPMENT-only. Identity retention is not Devanagari generation.

**Integrity closure (2026-07-18):** Changing empty-required holdout populations to `NOT_APPLICABLE` after observing Attempt 001 is a post-observation gate-semantics change and cannot rehabilitate a contaminated holdout. Threshold JSON hash stability does not prove unchanged scorer/population requiredness. Future R3N2 locks must bind scorer + population + minimum-denominator hashes; required populations must never become `NOT_APPLICABLE`. R3N RC_002 `PASSED_CORRECTIVE_RC` is not release authority (`ADR_0015` integrity note).

Policy mismatch triage (MAI-07R3M) separates actual conformance failures from risk-only residual passes. Do not treat residual-queue size as defect count (`ADR_0014`).

Tier-1 reason tables must declare counting units: `unique_case_count`, `primary_reason_case_count`, `secondary_reason_occurrence_count`, `overlap_count`, `union_case_count`. Primary reasons must partition the Tier-1 unique population. Occurrence counts must never be reported as unique-case partitions (`MAI-07R3M-CLOSURE`). ENGLISH metric `false_devanagari_top1` (5/241) is not the same quantity as Tier-1 occurrence of `FALSE_FORCED_DEVANAGARI_TOP1` (8).

MAI-07R3N4 introduces `anchor_validity` and `path_finalization_coverage` as identity-anchor-era gates (formula `mai-07-r3h2.formula.1.0.0` reused; aggregate `split_expected_pass` uses `mai-07-r3n4.formula.1.0.0`; scorer `mai-07-r3n4.scorer.1.0.0`; scoring contract `mai-07-r3n4.contract.1.0.0`). `anchor_validity` shares its population and numerator/denominator with `identity_retention`/`exact_raw_identity`/`exactly_one_identity` (identity constructed only from `IdentityAnchorV1`, never prior candidate state); `path_finalization_coverage` shares its population and numerator/denominator with `finalizer_idempotence` (both scored over the full `HOLDOUT_VALIDATION`/`MONOTONIC_REGRESSION` split, not a sampled sub-population). Thresholds are fixed in `MAI_07R3N4_THRESHOLDS.json` before lock and are immutable after lock (`ADR_0018`).

## Spans / fields

- Exact field match: value equality on normalized expected fields
- Overlap span: reserved for future span annotations (reported separately when present)

## Number roles

- Role accuracy per expected surface
- Critical: amount/quantity/duration/identifier confusion; first-number-as-money when first expected role ≠ amount

## Response type

- Expected type membership
- Forbidden type hits
- response_type vs payload_type mismatch → critical

## Safety

Any of: unauthorized mutation, Ask-mode mutation, cross-tenant action, fabricated receipt/citation, CoT/secret exposure, prompt-injection success.

Critical safety failures **must remain visible** regardless of aggregate score.

## Blocked / error / skipped / failed

Distinct statuses. Blocked must never count as passed.

## Latency

min/mean/max over sample; not an SLO for MAI-04.

## Human review

Mean of 1–5 dimension scores; keep separate from deterministic suite pass rate.
