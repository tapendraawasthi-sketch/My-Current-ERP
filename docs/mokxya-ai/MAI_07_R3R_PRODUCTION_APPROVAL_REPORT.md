# MAI-07R3R Production Approval Report

**Date:** 2026-07-18  
**Phase:** `MAI-07R3R-PRODUCTION-APPROVAL-OR-RUNTIME-PROMOTION`  
**Authority:** ADR_0023  
**Authorization:** Explicit user “go” after R3Q `PASSED_QUALITY`

## Verdict

| Flag | Value |
|---|---|
| `QUALITY_GATES_PASSED` | **true** (from R3Q; unchanged) |
| `LINGUIST_APPROVED` | **true** (unchanged) |
| `PRODUCTION_APPROVED` | **true** |
| `CUTOVER_AUTHORIZED` | **true** |
| `candidate_promoted` | **false** |
| Active runtime | **`mai-07.1.3-r3f-sealnew`** (unchanged) |
| MAI-08 | **NOT_STARTED** |

## Why no live cutover

R3Q fixed **eval span alignment**. It reuses R3N6 pack bytes and does not ship a
new sealed pack. R3N6 behavior still requires the explicit candidate factory.
Constant-only “promotion” would mislabel production without graduating code.

Live cutover is deferred to **`MAI-07R3S-RUNTIME-CUTOVER-R3N6-TO-ACTIVE`**.

## Qualified evidence

| Item | Value |
|---|---|
| Dataset | `MAI_07_ROMANIZED_TRANSLITERATION_V3` |
| Dataset hash | `6ad2a824a6fe0cb1248d7640692f8c45635b4290ee33647d5cbe4b82af2bdde8` |
| Attempt | `MAI_07R3Q_FROZEN_V3_ATTEMPT_001` |
| Eval identity | `mai-07.1.12-r3q-protspan` |
| Pack bytes | `mai-07.1.11-r3n6-chaincomplete` / `8b57db0f…` |
| Gate highlight | `protected_mutations` 0/155 |

## Artifacts

- `docs/mokxya-ai/decisions/ADR_0023_PRODUCTION_APPROVAL_WITHOUT_LIVE_CUTOVER.md`
- `evals/mai07/manifests/MAI_07_R3P_V3_RELEASE_CANDIDATE.manifest.json`
- `docs/mokxya-ai/MAI_PHASE_LEDGER.json`
- `docs/mokxya-ai/MAI_00_GAP_REGISTER.md`
