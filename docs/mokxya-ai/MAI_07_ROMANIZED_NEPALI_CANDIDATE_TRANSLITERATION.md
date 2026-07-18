# MAI-07 — Romanized Nepali Candidate Transliteration

## Verdict

**NEEDS_CORRECTIVE_WORK** · SEAL-NEW RC = **PASSED_NEW_RC** · R3H2 sealed non-frozen = **PASSED_CORRECTIVE_RC** (pack not promoted) · R3I frozen = **FAILED_QUALITY** · R3G-REAUTHORIZED = **BLOCKED_PRECONDITION_FAILED**

`QUALITY_GATES_PASSED=false` · `AUTOMATED_ENGINEERING_GATES_PASSED=true` (SEAL-NEW / R3H2 non-frozen only; R3I frozen quality false) · `LINGUIST_APPROVED=false` · `PRODUCTION_APPROVED=false`
GAP-P0-001 OPEN · GAP-P1-011 OPEN · GAP-P1-012 OPEN · GAP-P1-015 CLOSED · **MAI-08 NOT_STARTED** · Next = **MAI-07R3J-B-ADJUDICATION-AND-V3-FREEZE** (after human Round A/B/adjudication)

## R3H2 note (2026-07-16)

Shared-collision corrective pack `mai-07.1.5-r3h2-shared` / policy `mai-07-r3h2.1.0.0` passed sealed non-frozen holdout (`PASSED_CORRECTIVE_RC`) with GENERATE for shared surfaces, decisive EN/NP/ambiguous disposition, and span review metadata. Active runtime claim remains `mai-07.1.3-r3f-sealnew`. Do not start MAI-08; frozen V2 only under MAI-07R3I authorization.

## R3I note (2026-07-16)

One-shot frozen V2 of sealed R3H2 RC = `FAILED_QUALITY` (attempt consumed). Pack not promoted. Do not retune from frozen V2 cases. Prefer independently reviewed V3 / professional adjudication.

## R3J-A note (2026-07-16)

V2 marked `HISTORICAL_BENCHMARK_EXHAUSTED_FOR_MODEL_SELECTION` (ADR_0010). Independent V3 review packet ready under `docs/mokxya-ai/reviews/mai07_v3/` — **no independent human decisions imported**; `LINGUIST_APPROVED=false`. Blocker=`BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW`. Next=`MAI-07R3J-B-ADJUDICATION-AND-V3-FREEZE`. MAI-08 NOT_STARTED. Runtime/resources unchanged.

## R3J AI-assisted ACCOUNTING note (2026-07-17)

`PASSED_ENGINEERING_IMPORT` for segregated AI-assisted ACCOUNTING_DOMAIN Round A evidence under `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/accounting_domain/` (ADR_0011). Not independent review, not Round A lock, not Round B, not frozen V3 gold, not training, not runtime promotion. Official inbox untouched. MAI-07 remains `NEEDS_CORRECTIVE_WORK`.

## R3J remaining-role drafts note (2026-07-17)

`PASSED_DRAFT_GENERATION` for PRODUCT_POLICY / NEPALI_FLUENT_A / PROFESSIONAL_LINGUIST_B under `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/role_drafts/` (3333 rows).

## R3J remaining-roles verified import note (2026-07-17)

`PASSED_ENGINEERING_IMPORT` after user acceptance without changes. Evidence: `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/remaining_roles/` (semantic hash `1cc783d7…`). PROFESSIONAL_LINGUIST_B is AI role simulation only. Not independent review / Round A lock / Round B / frozen V3 / linguist or production approval.

## R3K cross-role consensus diagnostic note (2026-07-17)

`PASSED_ENGINEERING_DIAGNOSTIC`. 1111 cases / 3944 judgments. Disposition agreement 1.0 is **generator contamination**, not human IRR (ADR_0012). Risk queue 700. No majority gold / lock / Round B / frozen V3 / runtime promotion.

## Active claim vs seal

| Item | Value |
| --- | --- |
| Runtime | `mai-07.1.3-r3f-sealnew` |
| Resource | `16174253…` (claim matches compute) |
| Active RC (post-holdout) | semantic `530192228e7827bc33213f7ad8a3f4c2b75bdba6a01d78611617fd2d27c10e5c` |
| Lock-before-holdout hash | `f4c07e24…` cited but **body not preserved** |
| Historical R3F claim | `e94cc8c…` INVALIDATED_BY_SEAL_DRIFT |
| Overlay | disabled |

## R3G-REAUTHORIZED

Frozen V2 **not opened**. Blocked solely on missing immutable lock-before-holdout RC body. See `docs/mokxya-ai/MAI_07_R3G_REAUTHORIZED_FROZEN_V2_EVALUATION_REPORT.md`.

## Prior frozen attempt (immutable)

R3E `FAILED_QUALITY` predictions `89ee4789…` preserved.
