# ADR_0091 — PR-C1-ARM Attempt Blocked (honest non-flip)

- **Status:** Accepted (2026-07-20)
- **Step:** PR-C1-ARM (attempt)
- **Outcome:** **BLOCKED** — flag remains OFF; `production_approved=false`

## Context

PR-C1 shipped the release package (ADR_0090) with the capability gate wired
off. PR-C1-ARM requires clearing staging tickets, owner sign-off, staging
golden-path green within 48h of flip, then arming the row flag.

On 2026-07-20 continuum “go”, runtime probe showed:

- `blocking_tickets_clear=false`
- `owner_signed=false`
- `is_launch_sales_purchase_production_approved=false`
- Prior PR-B1 connected run still **FAIL**; manual attestation still **PENDING**

## Decision

1. **Do not flip** `flag_armed` / row `production_approved` / matrix
   `depth=PRODUCTION` / NEXT-20 DONE.
2. Record this attempt under `artifacts/prod-ready-pr-c1-arm/`.
3. Keep `recommended_next_step = PR-C1-ARM` until humans clear blockers
   (or file an explicit owner residual-acceptance note naming each ticket).
4. Forbidden: inventing OWNER_SIGNOFF, inventing staging PASS, or claiming
   production traffic enabled.

## Clear arm when (unchanged)

See `docs/mokxya-ai/releases/LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md` §9 and
`artifacts/prod-ready-pr-c1/BLOCKING_TICKETS.md`.

## Related

- ADR_0090 release package
- `artifacts/prod-ready-pr-c1-arm/ARM_ATTEMPT.md`
