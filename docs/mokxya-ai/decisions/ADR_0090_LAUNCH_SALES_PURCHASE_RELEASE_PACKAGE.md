# ADR_0090 — Launch Sales/Purchase Release Package (PR-C1 / NEXT-20 prep)

- **Status:** Accepted (2026-07-20)
- **Step:** PR-C1
- **Row:** `LAUNCH-ACCOUNTANT-SALES-PURCHASE`
- **Flag:** **OFF** (`production_approved=false` for the row)

## Context

PR-B1…PR-B6 landed engineering residuals and a hygiene CI story. PR-C1
acceptance requires a release dossier, capability gate, disclosures,
monitoring, and rollback — plus human owner sign-off and staging golden-path
green within 48h of any flag flip. Staging tickets
`TICKET-PR-B1-001/002`, `TICKET-PR-B3-001`, `TICKET-PR-B5-001` remain OPEN.

## Decision

1. **Ship the release package** (dossier + registry + runtime flag helper)
   with `flag_armed=false` and row `production_approved=false`.
2. **Do not** set matrix depth=`PRODUCTION` or flip the runtime flag until:
   - staging tickets cleared,
   - product owner sign-off recorded,
   - staging golden path re-run green within 48h of flip.
3. **Disclosures** are documented and exported as constants for UI/docs.
4. **Rollback** = set flag off → AI drafts for this row disabled; ERP screens remain.
5. **NEXT-20** remains OPEN until arm/flip evidence lands (`PR-C1-ARM`).

## Rejected

| Alternative | Why |
|-------------|-----|
| Flip `production_approved=true` now | Staging tickets + owner sign-off missing |
| Claim NEXT-20 DONE | Flag not armed |
| Widen to settlement/returns/bank recon | Out of narrow launch set |

## Related

- `docs/mokxya-ai/releases/LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md`
- `docs/mokxya-ai/MAI_LAUNCH_SALES_PURCHASE_RELEASE_REGISTRY.json`
- `artifacts/prod-ready-pr-c1/`
