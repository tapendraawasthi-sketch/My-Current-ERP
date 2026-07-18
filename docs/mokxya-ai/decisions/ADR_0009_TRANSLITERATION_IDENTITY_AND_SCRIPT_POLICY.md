# ADR_0009 — Transliteration Identity and Script Ranking Policy

## Status

**PRODUCT_POLICY_APPROVED_R3F_RUNTIME_ACTIVATED**

Product owner approved Option A (conservative identity) during MAI-07R3B review import.
MAI-07R3D activated Option A in corrective runtime `mai-07.1.1-r3d` (non-frozen RC only).
MAI-07R3F activated the post-rank English Identity Guard in `mai-07.1.2-r3f` (non-frozen RC only).
**Not** sufficient for `LINGUIST_APPROVED=true` or `PRODUCTION_APPROVED=true`.
MAI-07R3E one-shot frozen-V2 evaluation of sealed R3D RC returned **FAILED_QUALITY** (English identity 98/102; false-Devanagari 4/102). Do not retune from frozen failures. R3F does not claim frozen quality.
MAI-07R3G frozen-V2 evaluation of sealed R3F RC was **BLOCKED_PRECONDITION_FAILED** (resource pack / holdout prediction integrity); frozen V2 not opened.

| Flag | Value |
|------|-------|
| PRODUCT_POLICY_REVIEWED | true (Option A) |
| NEPALI_FLUENT_REVIEWED | true (product-owner fluent review of locked Round A/B) |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| QUALITY_GATES_PASSED | **false** |
| R3D_AUTOMATED_ENGINEERING_GATES | **true** (non-frozen holdout only) |
| R3F_AUTOMATED_ENGINEERING_GATES | **true** (non-frozen holdout only; seal integrity now disputed on disk) |
| R3E_STATUS | FAILED_QUALITY |
| R3F_STATUS | PASSED_CORRECTIVE_RC |
| R3G_STATUS | BLOCKED_PRECONDITION_FAILED |
| R3G-002_STATUS | FAILED_QUALITY (frozen V2 consumed; English 98/102; false-Dev 4/102) |
| R3H_STATUS | FAILED_HOLDOUT_QUALITY (non-frozen only; frozen V2 not opened) |
| R3H_AUTOMATED_ENGINEERING_GATES | **false** (RC locked but holdout quality gates failed) |
| R3H2_STATUS | PASSED_CORRECTIVE_RC (non-frozen only; pack not promoted; frozen V2 not opened) |
| R3H2_AUTOMATED_ENGINEERING_GATES | **true** (sealed non-frozen holdout `gate_all_pass`; product QUALITY_GATES still false) |
| R3I_STATUS | FAILED_QUALITY (one-shot frozen V2 of R3H2 RC; attempt consumed) |
| R3I_QUALITY_GATES | **false** (TOP1/UNAMBIGUOUS/ENGLISH/FALSE_DEV/PROTECTED failed) |
| R3JA_STATUS | REVIEW_PACKET_READY / BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW |
| V2_GOVERNANCE | HISTORICAL_BENCHMARK_EXHAUSTED_FOR_MODEL_SELECTION (ADR_0010) |

## R3H addendum (2026-07-16)

MAI-07R3H generalized the English identity guard into a typed identity-disposition authority (`mai-07-r3h.1.0.0`) under Option A. Non-frozen holdout evidence shows English identity / false-Devanagari safety gates pass, but unresolved shared/ambiguous review metadata and shared-collision counterfactual gates fail. Default active pack remains `mai-07.1.3-r3f-sealnew`. Next governed phase: `MAI-07R3H2-SHARED-COLLISION-CORRECTIVE`. No linguist/production approval inferred.

## R3H2 addendum (2026-07-16)

MAI-07R3H2 policy `mai-07-r3h2.1.0.0` selects corrective branches **C+D+A**: decisive shared-context disposition, shared-surface `GENERATE`, and span-level review metadata (`review_required` / `review_reason_codes` / `disposition` / `policy_version`). Sealed non-frozen RC `MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001` = `PASSED_CORRECTIVE_RC`. Pack `mai-07.1.5-r3h2-shared` is **not** the active default (`mai-07.1.3-r3f-sealnew` unchanged). `LINGUIST_APPROVED=false`, `PRODUCTION_APPROVED=false`, product `QUALITY_GATES_PASSED=false`. Next: `MAI-07R3I-FROZEN-REAUTHORIZED`.

## R3I addendum (2026-07-16)

Frozen V2 one-shot of R3H2 = `FAILED_QUALITY`. English identity 99/102 and false Devanagari 3/102 still fail frozen integer gates; protected-span mutations = 6; target top-1 and unambiguous top-1 also fail. Do not infer linguist/production approval. Do not retune from frozen V2. Prefer independently reviewed V3 / professional adjudication. MAI-08 NOT_STARTED.

## Context

MAI-07 frozen V1 (`TRANSLITERATION_REQUIRED`, N=316) and runtime safety policy disagree on a conflict set of approximately 49 cases where:

- Evaluation treats a Devanagari target as required at rank 1.
- Safety classifies the span as English identity or name-like identity-first.

Engineering must not resolve this by silent gate weakening or hardcoding failures.

## Decision (Option A — Conservative Identity Policy)

Approved by product owner on 2026-07-15 via MAI-07R3B locked reviews + bulk schema mapping authority.

1. **English / acronyms / identifiers**  
   Latin-first. `LATIN_IDENTITY_REQUIRED` (or stronger). Devanagari prohibited unless separately governed.

2. **Proper names / entities**  
   Latin-first. Devanagari may be retained only as optional / review-marked. Optional Devanagari never counts toward required-target top-1.

3. **Clear Romanized Nepali**  
   Reviewed Devanagari may rank first (`DEVANAGARI_TARGET_REQUIRED`). Identity remains available in the candidate list.

4. **Optional Devanagari**  
   Does **not** count toward required-target top-1 quality population.

5. **Ambiguous / cannot-decide**  
   `BOTH_EQUAL_REVIEW_REQUIRED` or `CANNOT_DECIDE` → `HUMAN_REVIEW_REQUIRED`; excluded from automatic quality pass or reported separately.

## Round A vs Round B authority

- **Round A** is the sole product-ranking / population authority.
- **Round B** is candidate-quality evidence only and must never overwrite Round A automatically.
- Official five-label Round B labels come from an **explicit user-authorized bulk schema mapping** of the locked three-label review:
  - `ACCEPTABLE` → `ACCEPTABLE_PREFERRED`
  - `UNACCEPTABLE` → `UNNATURAL_BUT_POSSIBLE`
  - `CANNOT_DECIDE` → `CANNOT_DECIDE`
- This is **not** a row-by-row professional-linguist five-label adjudication.
- Multiple bulk-mapped `ACCEPTABLE_PREFERRED` candidates must not be collapsed into unique top-1 gold.

## Alternatives considered

- **Option B**: domain-term Devanagari promotion allowlist  
- **Option C**: aggressive Devanagari promotion (not recommended without linguist)  
- **Option D**: strict Latin whenever MAI-05 says ENGLISH  

See `docs/mokxya-ai/reviews/mai07r3/MAI_07R3_POLICY_OPTIONS.md`.

## Consequences

- Evaluation semantics V2 population rules are defined from Round A (`MAI_07R3_EVALUATION_SEMANTICS_V2.json`).
- **MAI-07R3C** froze dataset V2 (`0cee0c07…`) with parent V1; V1 remains immutable.
- One-shot pre-R1 baseline against V2 **failed** automated quality gates — do not weaken thresholds to pass.
- Runtime ranking policy may change only in a separately governed corrective phase (not by tuning against frozen V2).
- Active runtime remains pre-R1 baseline (`ENABLE_PROMOTION_OVERLAY=false`).
- MAI-08 remains unauthorized. `LINGUIST_APPROVED` / `PRODUCTION_APPROVED` remain false.

## References

- `docs/mokxya-ai/reviews/mai07r3/`
- `docs/mokxya-ai/MAI_07_R3_LANGUAGE_POLICY_REVIEW.md`
- `docs/mokxya-ai/reviews/mai07r3/MAI_07R3_BULK_SCHEMA_MAPPING_DECISION.json`
- `erp_bot/src/oip/modules/language_runtime/transliteration/application/import_mai07r3b_reviews.py`
