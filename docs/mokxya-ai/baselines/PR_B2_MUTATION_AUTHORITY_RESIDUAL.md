# PR-B2 — Mutation Authority Residual (GAP-P0-001)

**Date:** 2026-07-19  
**Step:** PR-B2  
**ADR:** ADR_0085 (extends ADR_0072)  

## Product path (launch sales/purchase)

`executeOrbixConfirm` → Dexie domain `postSalesTransaction` / `postPurchaseTransaction`

## Hard-deny

| Writer | Launch-marked behavior |
|--------|------------------------|
| Node `/khata/confirm` overlap intents | **403** deny, `draft_mutations=0` |
| OEC / AI confirm dispatch | **denied** by residual policy |

## Writer audit

| Path | Classification |
|------|----------------|
| DEXIE_EXECUTE_ORBIX_CONFIRM | PRODUCT_AUTHORITY |
| NODE_KHATA_CONFIRM | HARD_DENY if launch-marked; else legacy |
| OEC_ACTION_RUNTIME | NOT product; launch hard-deny |
| AI_CONFIRM_OEC_CANDIDATE | Annotation-only; launch hard-deny |
| VOUCHER_SLICE_UI | Manual UI alternate (residual) |

## Gap

- **GAP-P0-001 = REDUCED** (not CLOSED)
- `oec_is_sole_mutation_authority=false`
- Residual: unmarked Node khata + voucher UI

## Evidence

- `docs/mokxya-ai/decisions/ADR_0085_LAUNCH_MUTATION_RESIDUAL_HARD_DENY.md`
- `docs/mokxya-ai/MAI_LAUNCH_MUTATION_RESIDUAL_REGISTRY.json`
- `packages/backend/src/lib/launchMutationDeny.ts`
- `erp_bot/tests/oip/language_runtime/test_mai_pr_b2_mutation_residual.py`
- `src/__tests__/orbix/maiPrB2MutationResidual.test.ts`

## Pointer

recommended_next_step → **PR-B3**
