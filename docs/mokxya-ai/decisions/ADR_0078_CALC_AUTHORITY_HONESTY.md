# ADR_0078 — Calc Authority Honesty for Launch Draft/Preview (NEXT-11)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-11 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0072 (Model B confirm); ADR_0050 / MAI-33 preview policy; ADR_0077 launch freeze
- **Gap:** GAP-P2-002 → **REDUCED** (not CLOSED)

## Context

UI surfaces (invoice form, Orbix confirm card) show totals that can look
authoritative while Model B posting uses Dexie domain engines. MAI-33 annotated
ownership but left GAP-P2-002 OPEN without parity/label depth.

## Decision

1. **Confirm/post calc owner (launch sales/purchase):** `DEXIE_DOMAIN_ENGINE`
   (`postSalesTransaction` / `postPurchaseTransaction` via `executeOrbixConfirm`).
2. **Orbix khata preview card:** display/confirm-binding only; not post authority.
3. **Manual invoice form totals:** `UI_DISPLAY_ESTIMATE` — must be labeled
   non-authoritative.
4. **Edit loop** must not invent party or amount; stale preview rejects on confirm.
5. **GAP-P2-002 register status = REDUCED** with documented owners + tests.
   Not CLOSED while UI display estimates and voucherSlice dual-calc risk remain.

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim GAP CLOSED | Form/voucherSlice display estimates remain |
| Rewrite khata draft engines this step | Conflict-register thrash; depth is honesty first |
| AI/journal math as authority | Violates MAI-33 / fail-closed |

## Related

- `docs/mokxya-ai/MAI_CALC_AUTHORITY_REGISTRY.json`
- `erp_bot/.../calc_authority_policy.py`
- `src/platform/calc/calcAuthorityPolicy.ts`
