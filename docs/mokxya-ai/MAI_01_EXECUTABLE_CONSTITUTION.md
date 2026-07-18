# MAI-01 — Executable Product Constitution

**Status:** PASSED (gate evidence below)  
**Date:** 2026-07-14  
**production_approved:** false  

---

## 1. Objective

Convert MokXya’s Ask/Accountant constitution into a centralized, deny-by-default,
executable policy enforced before draft mutation and server-side accounting
mutation, without changing deterministic accounting engines or converging OEC.

## 2. Existing policy/auth architecture discovered

| Layer | Path | Role |
|-------|------|------|
| Mode capabilities | `erp_bot/src/orbix/mode_policy.py` | Ask vs Accountant tool category gates |
| OIP principal | `erp_bot/src/oip/infrastructure/security/principal.py` | `SecurityPrincipal` |
| OIP JWT / API key | `jwt_service.py`, `api_key_service.py`, `api/dependencies.py` | Existing auth |
| Secured facade | `secured_facade.py` | Auth when `auth_required` |
| Node JWT | `packages/backend/src/middleware/auth.ts` | `AuthTokenPayload` + `authMiddleware` |
| Frontend session | `src/platform/identity/session.ts` | `sutra_access_token` |

## 3. Selected canonical policy authority

**Pure domain:** `erp_bot/src/oip/domain/constitution/`  
- `evaluate_policy(PolicyContext) -> PolicyDecision`  
- Version: `mai-01.1.0` (`POLICY_VERSION`)

Adapters convert JWT/`SecurityPrincipal` → `TrustedPrincipal`.  
`orbix/mode_policy.py` remains the tool-category helper and is used for
Ask/Accountant capability resolution; mutation authorization for drafts uses
constitution evaluation.

## 4. Mode-capability matrix

| Operation | Ask | Accountant (+auth+perm) |
|-----------|-----|-------------------------|
| Read conversation/help/ephemeral example | allow (no auth) | allow |
| Read knowledge/ERP/calc | allow if authenticated | allow if authenticated |
| Create/update/cancel draft, preview, request confirmation | **deny** | allow |
| Execute confirmed command | **deny** | only with `explicit_confirmation` |
| Natural-language “yes” only | **deny** | **deny** |
| Model-originated mutation | **deny** | **deny** |
| Mark posted / sync / admin | **deny** | allow with permission |

Deny-by-default for unknown mode/operation.

## 5. Trusted principal source

Verified middleware JWT/API key → `SecurityPrincipal` → `TrustedPrincipal`.  
Request body `tenant_id`/`company_id`/`user_id` are **selectors only**.  
Dev identity only via `OIP_ALLOW_INSECURE_DEV_IDENTITY` and never in production.

## 6. Tenant/company validation

`evaluate_policy` returns `TENANT_SCOPE_MISMATCH` / `COMPANY_SCOPE_MISMATCH`.  
Node `requireKhataConfirmAuth` overwrites body identity from JWT after match check.

## 7. Python/OIP enforcement points

- `oip_chat_ingress.build_intelligence_request` — no `tenant-a`/`company-a`/`orbix-user` synthesis; auth required when configured
- `server.orbix_chat_stream` — binds Bearer/API key principal
- `mode_aware_erp` — Ask forced read-only caps; accountant draft blocked when `auth_required` without principal
- `orbix_drafts.mark-posted` — MARK_POSTED policy + Ask denial
- Production `get_oip_settings` — `validate_production_security_config`
- JWT verify accepts Sutra Node token shape (shared secret)

## 8. Node enforcement points

- `POST /api/khata/confirm` → `requireKhataConfirmAuth`
- Production JWT secret fail-closed in `getJwtSecret`

## 9. Frontend enforcement points

- Ask Mode hides `OrbixJournalCard` confirm UI
- `mayShowConfirmControl(mode)`
- Auth header forwarded from `readAccessToken()` on chat stream + mark-posted
- `khata-app` sends `VITE_KHATA_ACCESS_TOKEN` when set
- `executeOrbixConfirm` still requires accountant + explicit `confirmation` (unchanged accounting)

## 10. Production configuration rules

Rejected in production (`RENDER` / `NODE_ENV=production` / etc.):

- `OIP_AUTH_REQUIRED=false`
- Weak/missing JWT secrets
- `OIP_DEFAULT_SERVICE_TENANT_ID=tenant-a` (and company-a)
- `OIP_ALLOW_INSECURE_DEV_IDENTITY=true`

`render.yaml` now sets `OIP_AUTH_REQUIRED=true`, empty default tenant, secret sync keys.

## 11. Error codes

`AUTHENTICATION_REQUIRED`, `AUTHORIZATION_REQUIRED`, `TENANT_SCOPE_MISMATCH`,
`COMPANY_SCOPE_MISMATCH`, `MODE_FORBIDS_OPERATION`,
`EXPLICIT_CONFIRMATION_REQUIRED`, `MUTATION_TOOL_FORBIDDEN`,
`UNKNOWN_OPERATION_DENIED`, `UNKNOWN_MODE_DENIED`,
`INSECURE_PRODUCTION_CONFIGURATION`, `MODEL_ORIGINATED_MUTATION_DENIED`,
`NATURAL_LANGUAGE_CONFIRMATION_DENIED`, `POLICY_ALLOWED`.

## 12. Audit behavior

`log_event("mai01.policy_decision" | "mai01.policy_denial", **decision.to_audit_dict())`  
No tokens/secrets/prompts logged.

## 13. OEC deviation explicitly deferred

GAP-P0-001 remains open. Model B Dexie posting via `executeOrbixConfirm` is
unchanged. Action→OEC is not the Orbix ledger path. Constitution gates modes and
identity; it does not claim OEC-only mutation.

## 14. Tests and evidence

| Suite | Result |
|-------|--------|
| `pytest erp_bot/tests/oip/test_mai01_*.py` | **35 passed** |
| `vitest` orbix + khataConfirmAuth | **141 passed** (was 129) |
| `npm run test:accounting` | 17 pass / 3 fail / 1 suite error — **same baseline** |
| `npx tsc --noEmit` | 2 InvoicePrint errors — **same baseline** |
| `pytest erp_bot/tests --collect-only` | **684 collected, 1 unrelated error** (`reasoning_filter`) — was 39 errors |
| `from src.oip.api import router` | **ok**; server logs `OIP kernel mounted at /oip/v1` |
| Playwright | skipped |

## 15. Known limitations

- Secondary stacks (NIOS/Orbix v2/v2 chat) not fully constitution-wired (GAP-P1-001)
- Local chat without JWT still works when `OIP_AUTH_REQUIRED=false` (non-prod)
- mark-posted requires JWT or explicit insecure-dev flag when auth enforced
- Cryptographic single-use confirmation tokens deferred to MAI-34
- Dual sync still open (GAP-P1-002)

## 16. Rollback

Revert these paths only (no destructive git):

- `erp_bot/src/oip/domain/constitution/**`
- `erp_bot/src/oip/modules/planner/api/router.py`, `router/api/router.py`
- `erp_bot/src/api/oip_chat_ingress.py`, `orbix_drafts.py`, `server.py` (auth binding)
- `erp_bot/src/oip/config/settings.py`, `jwt_service.py`, `permission_registry.py`
- `erp_bot/src/oip/integration/mode_aware_erp.py`
- `packages/backend/src/middleware/auth.ts`, `khataConfirmAuth.ts`, `routes/khata.ts`
- Frontend: `orbixQwenClient.ts`, `orbixPostingService.ts`, `OrbixWorkspace.tsx`, `presentation.ts`, `khata-app/.../khataApi.ts`
- `render.yaml`, `vitest.config.ts`, `erp_bot/.env.example`
- Tests and `docs/mokxya-ai/MAI_01_*`, ADR_0002, ledger/gap updates

No schema migrations added.

## 17. Gate verdict

**PASSED** against MAI-01 acceptance checklist (see final report).  
`production_approved` remains **false**.
