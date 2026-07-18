# MAI-07R3S Runtime Cutover Report

**Date:** 2026-07-18  
**Phase:** `MAI-07R3S-RUNTIME-CUTOVER-R3N6-TO-ACTIVE`  
**Authority:** ADR_0024  
**Authorization:** Explicit user “go” after ADR_0023

## Verdict

| Field | Value |
|---|---|
| Active runtime | **`mai-07.1.13-r3s-active`** |
| Active pack | **`mai-07.1.11-r3n6-chaincomplete`** |
| Pack hash | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` |
| Previous active | `mai-07.1.3-r3f-sealnew` |
| `candidate_promoted` | **true** |
| `PRODUCTION_APPROVED` | true |
| `QUALITY_GATES_PASSED` | true |
| `ENABLE_PROMOTION_OVERLAY` | false |
| MAI-08 | **NOT_STARTED** |

## What changed

1. `__init__.py` runtime/pack constants → R3S / R3N6  
2. `resource_repository.ACTIVE_PACK_VERSION` → R3N6 pack  
3. Default `attach_transliteration_to_frame` uses R3N4 refine + finalize  
4. Shared `mai07_active_default_guard` for candidate factories  
5. `mai07_r3s_active_runtime.transliterate_active` for explicit active pipeline

## Behavioral note

Identity-first finalize (qualified path) is now default. Example: `mero` tops as
identity with Devanagari `मेरो` still listed.

## Artifacts

- `docs/mokxya-ai/decisions/ADR_0024_RUNTIME_CUTOVER_R3N6_TO_ACTIVE.md`
- `erp_bot/.../application/mai07_r3s_active_runtime.py`
- `erp_bot/.../application/mai07_active_default_guard.py`
- `evals/mai07/manifests/MAI_07_R3P_V3_RELEASE_CANDIDATE.manifest.json`
