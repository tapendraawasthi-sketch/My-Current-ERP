# ADR_0085 — Launch Mutation Residual Hard-Deny (PR-B2 / GAP-P0-001)

- **Status:** Accepted (2026-07-19)
- **Step:** PR-B2
- **Extends:** ADR_0072 Option A; ADR_0075 confirm tokens; ADR_0077 launch freeze
- **Gap:** GAP-P0-001 remains **REDUCED** (not CLOSED)

## Context

NEXT-02 classified dual writers honestly. Launch sales/purchase must not be
silently posted by Node `/khata/confirm` or OEC when Orbix launch markers are
present. Product path stays Model B `executeOrbixConfirm` → Dexie.

## Decision

1. **Product launch confirm path** remains `DEXIE_EXECUTE_ORBIX_CONFIRM`.
2. **Hard-deny Node khata confirm** for overlap intents
   (`khata_purchase`, `khata_cash_sale`, `khata_credit_sale`) when launch
   markers are present (`launch_event_id`, `channel`/`source` orbix|ai|…,
   `product_mutation_path`, or `orbix-confirm-*` token). Response:
   fail-closed, `draft_mutations=0`.
3. **Hard-deny OEC / AI confirm dispatch** claims for launch events
   (policy + honesty; live `allow_*=false` unchanged).
4. **Legacy Node khata** without launch markers stays allowed (non-launch).
5. **`oec_is_sole_mutation_authority=false`**; gap not CLOSED while
   `VOUCHER_SLICE_UI` + unmarked Node paths remain.

## Writer audit (launch sales/purchase)

| Path | Role on launch sales/purchase |
|------|-------------------------------|
| `DEXIE_EXECUTE_ORBIX_CONFIRM` | PRODUCT_AUTHORITY |
| `NODE_KHATA_CONFIRM` | HARD_DENY when launch-marked; else legacy alternate |
| `OEC_ACTION_RUNTIME` | HARD_DENY / not product |
| `AI_CONFIRM_OEC_CANDIDATE` | HARD_DENY / annotation-only |
| `VOUCHER_SLICE_UI` | Manual UI alternate (not Orbix launch confirm) |

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim sole-OEC / CLOSE GAP-P0-001 | Dual writers still exist off launch markers |
| Delete Node khata entirely | Breaks legacy non-launch khata |
| Rewrite Dexie / mode_aware | Out of scope thrash |

## Related

- `docs/mokxya-ai/MAI_LAUNCH_MUTATION_RESIDUAL_REGISTRY.json`
- `packages/backend/src/lib/launchMutationDeny.ts`
- `erp_bot/.../launch_mutation_residual_policy.py`
