# NEXT-05 — Confirm Path Honesty (Model B)

**Date:** 2026-07-19  
**Step:** NEXT-05  
**ADR:** ADR_0075  

## Decision

Short-lived, single-use, company-bound confirm tokens on product path
`DEXIE_EXECUTE_ORBIX_CONFIRM` (`executeOrbixConfirm`).

| Gate | Result |
|------|--------|
| NL assent posts | **false** (`nlAssentMayPost` always false; chat never calls confirm) |
| Token reuse | **fails** (`confirm_token_reuse`) |
| Wrong tenant | **denied** (`confirm_token_tenant_mismatch`) |
| Success without receipt | **fails** (`receipt_required`) |
| AI `confirm_oec_candidate` | still non-authority; tokens not minted on AI ingress |

## Evidence

- `docs/mokxya-ai/decisions/ADR_0075_CONFIRM_PATH_HONESTY_MODEL_B.md`
- `docs/mokxya-ai/MAI_CONFIRM_PATH_REGISTRY.json`
- `src/lib/ekhata/confirmPathAuthority.ts`
- `src/__tests__/orbix/maiNext05ConfirmPath.test.ts`
- `erp_bot/tests/oip/language_runtime/test_mai_next05_confirm_path.py`

## Explicit non-claims

- Not sole-OEC; GAP-P0-001 runtime remains OPEN (dual writers).
- Not production_approved.
- Does not close MAI-34 master Gate as production release.
