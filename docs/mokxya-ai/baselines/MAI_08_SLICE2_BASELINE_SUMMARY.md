# MAI-08 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Phase:** MAI-08 CODE-MIX AND TYPO ROBUSTNESS  
**Slice:** `SLICE2_PIPELINE_AND_DEFERRED_ABSTENTION`  
**Runtime:** `mai-08.0.2-slice2`  
**Authority:** ADR_0025  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| MAI-08 status | `IN_PROGRESS` |
| Live ingress attach | **wired** (`oip_chat_ingress` after MAI-07) |
| Posting substring auto-pick | **removed** (exact name only) |
| Phone / reminder party resolve | **MAI-08 floors** via `resolveUniqueParty` |
| Write-path autoCorrect | **blocked** when party/product/amount/qty present |
| `production_approved` | false |

## Evidence

| Artifact | Result |
|----------|--------|
| `evals/mai08/manifests/MAI_08_SLICE2.manifest.json` | includes `deferred_path_abstain_v1` |
| `erp_bot/tests/oip/language_runtime/test_mai08_slice1.py` | ingress stage wired |
| `src/__tests__/orbix/mai08Slice2MasterResolve.test.ts` | phone/item abstention |
| `src/__tests__/orbix/mai08EntityEnricher.test.ts` | floors unchanged |

## Explicit non-claims

- Does **not** close GAP-P1-009 or MAI-08
- Does **not** start MAI-09
- Does **not** claim linguist/production approval
