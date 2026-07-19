# NEXT-11 — Calc Authority Honesty (GAP-P2-002 REDUCED)

**Date:** 2026-07-19  
**Step:** NEXT-11  
**ADR:** ADR_0078  

## Decision

| Surface | Calc owner | Role |
|---------|------------|------|
| Launch sales/purchase confirm/post | `DEXIE_DOMAIN_ENGINE` | Authoritative ledger amounts via `executeOrbixConfirm` |
| Orbix khata preview card | Display / confirm-binding | Not post authority |
| Manual invoice form totals | `UI_DISPLAY_ESTIMATE` | Labeled non-authoritative |

## Gap status

- **GAP-P2-002 = REDUCED** (not CLOSED)
- Remaining: UI display estimates + voucherSlice dual-calc residual risk

## Gates satisfied

- UI totals labeled non-authoritative where engine owns calc
- Edit loop must not invent party/amount (`edit_loop_may_invent` always false)
- Stale preview on confirm = REJECT
- Parity/honesty tests for registry + labels

## Evidence

- `docs/mokxya-ai/decisions/ADR_0078_CALC_AUTHORITY_HONESTY.md`
- `docs/mokxya-ai/MAI_CALC_AUTHORITY_REGISTRY.json`
- `erp_bot/.../calc_authority_policy.py`
- `src/platform/calc/calcAuthorityPolicy.ts`
- `erp_bot/tests/oip/language_runtime/test_mai_next11_calc_authority.py`
- `src/__tests__/orbix/maiNext11CalcAuthority.test.ts`

## Explicit non-claims

- Not production_approved (NEXT-20)
- Not GAP-P2-002 CLOSED
- Not sole OEC / AI journal math authority
- Not E2E launch slice (NEXT-12)
