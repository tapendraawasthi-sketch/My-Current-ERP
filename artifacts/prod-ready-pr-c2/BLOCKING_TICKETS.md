# PR-C2 arm blockers (must clear before flag flip)

These tickets block **PR-C2-ARM** / Ask-reports `production_approved` for
`LAUNCH-ASK-COMPANY-REPORTS`. They do **not** block filing the PR-C2
engineering package (this ship).

| Ticket | Status | Source |
|--------|--------|--------|
| TICKET-PR-B1-001 | PASS | Staging operator attestation (2026-07-20) |
| TICKET-PR-B1-002 | PASS (residual) | next12 staging green; browser/sync residual accepted 2026-07-20 |
| TICKET-PR-B5-001 | PASS | Owner `b5pass` 2026-07-20 |
| OWNER_SIGNOFF_ASK_REPORTS | PENDING | `artifacts/prod-ready-pr-c2/OWNER_SIGNOFF.md` |

## Clear arm when

All tickets PASS (or owner-accepted residual note), `OWNER_SIGNOFF.md` filed,
staging golden path green within 48h of flip, registry `flag_armed=true`,
matrix row `depth=PRODUCTION` + `production_approved=true` for **this row only**.

## Explicit non-claims

- Not production_approved  
- Not flag armed  
- Not NEXT-20 DONE for Ask reports  
