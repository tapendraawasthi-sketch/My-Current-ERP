# ADR_0075 — Confirm Path Honesty on Model B (NEXT-05)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-05 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0072 (Model B product mutation); ADR_0051 / MAI-34 (AI confirm_oec non-authority)
- **Gap:** GAP-P0-001 (depth; remains REDUCED / runtime OPEN)

## Context

NEXT-02 accepted Option A: product mutation authority is
`DEXIE_EXECUTE_ORBIX_CONFIRM` (`executeOrbixConfirm` → domain `post*`).
MAI-34 AI `confirm_oec_candidate` stays annotation-only (`confirm_token`
always `NOT_ISSUED` on live ingress). The product UI confirm path previously
posted with `confirmation: true` but without short-lived single-use tokens.

## Decision

1. **Product confirm tokens** are minted for Model B pending cards and
   required by `executeOrbixConfirm`.
2. Tokens are **short-lived** (TTL) and **single-use** (reuse fails).
3. Tokens are **tenant/company-bound**; wrong companyId is denied.
4. **NL assent never posts** (`nl_assent_posts=false`); chat “yes” is not a
   mutation command.
5. **AI `confirm_oec_candidate` remains non-authority** and must not mint
   product tokens on live AI ingress.
6. **Success claims require a ledger receipt surface** (voucher/invoice/journal
   id or number). `posting_id` alone is insufficient.
7. Consume happens only after validation gates pass (failed mode/role/stale
   checks do not burn a valid token).

## Rejected

| Alternative | Why |
|-------------|-----|
| Mint tokens on MAI-34 AI path | Violates ADR_0051 / non-authority |
| Claim sole-OEC | Product path remains Model B (ADR_0072) |
| Soften token reuse for E2E | Gate requires reuse fail; mint fresh token for replay |

## Related

- `src/lib/ekhata/confirmPathAuthority.ts`
- `src/lib/ekhata/orbixPostingService.ts`
- `docs/mokxya-ai/MAI_CONFIRM_PATH_REGISTRY.json`
- `erp_bot/.../confirm_path_authority_policy.py`
