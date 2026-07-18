# ADR-0002 — Executable AI Constitution

Status: Accepted  
Date: 2026-07-14  
Phase: MAI-01  

## Decision

MokXya enforces a single deny-by-default capability policy in
`erp_bot/src/oip/domain/constitution` (`evaluate_policy`). Mode (Ask/Accountant)
is an operating context, not an authorization grant. Trusted identity comes from
verified JWT/API-key principals (OIP and Node), never from request-body fields or
synthetic `tenant-a` / `company-a` / `orbix-user` defaults in production.

## Context

MAI-00 proved parallel mutation authorities and weak auth defaults. MAI-01 must
make Ask Mode technically read-only and close P0 auth issues without OEC
convergence or accounting engine changes.

## Alternatives rejected

1. **Scatter mode checks only in UI** — hiding buttons is not security.
2. **New secondary auth stack** — rejected; reuse `SecurityPrincipal` + Node `authMiddleware`.
3. **Reroute all mutations through OEC now** — deferred; Model B Dexie remains ledger authority.
4. **Keep body-trusted tenant/company** — rejected for production.

## Authority boundaries

| Concern | Authority |
|---------|-----------|
| Capability matrix | `evaluate_policy` |
| Tool category helper | `orbix/mode_policy` |
| Identity verification | OIP JWT/API key; Node JWT |
| Accounting calculation/post | Unchanged Dexie engines / Node `executeKhataConfirm` |
| OEC | Present; not sole ledger writer (see ADR-0001) |

## Consequences

- Production must set `OIP_AUTH_REQUIRED=true` and strong secrets.
- Frontend must forward access tokens for protected server routes.
- Ask Mode cannot create persisted drafts or show confirm cards.
- Accountant Mode still requires explicit confirmation for execute.

## Current Dexie/OEC deviation

Documented and intentional for MAI-01. GAP-P0-001 remains open until a later
migration phase deliberately converges writers.

## Future migration boundaries

- MAI-02 contracts  
- MAI-34 confirmation tokens / OEC dispatch  
- MAI-35 sync unification  
- MAI-44 red team  

## Rollback

Revert MAI-01 file set listed in `MAI_01_EXECUTABLE_CONSTITUTION.md` §16.
No migrations to roll back.
