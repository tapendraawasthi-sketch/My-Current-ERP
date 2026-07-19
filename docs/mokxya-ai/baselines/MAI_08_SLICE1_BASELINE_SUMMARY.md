# MAI-08 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Phase:** MAI-08 CODE-MIX AND TYPO ROBUSTNESS  
**Slice:** `SLICE1_SLOT_STABILITY_AND_MASTER_ABSTENTION`  
**Runtime:** `mai-08.0.1-slice1`  
**Authority:** ADR_0025  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| MAI-08 status | `IN_PROGRESS` |
| `production_approved` | false |
| `quality_gates_passed` | false |
| `silent_applications` (TypoCodeMixBundle) | **0** |
| EntityEnricher party floor / gap | **0.75** / **0.12** |
| EntityEnricher item floor / gap | **0.78** / **0.12** |
| MAI-09 | `NOT_STARTED` |

## Evidence

| Artifact | Result |
|----------|--------|
| `evals/mai08/manifests/MAI_08_SLICE1.manifest.json` | 4 suites / 42 cases |
| `erp_bot/tests/oip/language_runtime/test_mai08_slice1.py` | **6 passed** |
| `erp_bot/tests/oip/language_runtime/test_mai07_r3s_cutover.py` | **2 passed** (`mai_08=IN_PROGRESS`) |
| `src/__tests__/orbix/mai08EntityEnricher.test.ts` | **7 passed** |

## Gate metrics (slice 1)

| Metric | Threshold | Observed |
|--------|-----------|----------|
| `slot_stability_pass_rate` (code-mix + typo families) | ≥ 0.95 | **1.0** (pytest family gold) |
| `silent_high_risk_master_bind_rate` | = 0 | **0** (close-name adversarial suite) |
| `ood_abstain_or_clarify_rate` | ≥ 0.90 | **1.0** (OOD unknown party vitest) |
| TypoCodeMix `silent_applications` | = 0 | **0** |

## What landed

1. ADR_0025 + phase doc
2. `TypoCodeMixBundleV1` candidate-only attach after MAI-05/06 frames
3. `evals/mai08` metamorphic + abstain + OOD suites
4. EntityEnricher hard abstention + `itemAmbiguous`

## Explicit non-claims

- Does **not** close GAP-P1-009
- Does **not** authorize MAI-08 production
- Does **not** start MAI-09
- Deferred: `postSalesTransaction` substring pick, SpellingCorrector autoCorrect write-path
