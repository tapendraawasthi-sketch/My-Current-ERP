# PR-C2 arm blockers (must clear before Ask reports flag flip)

These tickets block **PR-C2-ARM** for `LAUNCH-ASK-COMPANY-REPORTS`.
They do **not** block filing the PR-C2 engineering package (this ship).

| Ticket | Status | Source |
|--------|--------|--------|
| TICKET-PR-B1-001 | OPEN | Staging operator attestation |
| TICKET-PR-B1-002 | OPEN | Connected E2E green |
| TICKET-PR-B5-001 | OPEN | Knowledge professional review |
| OWNER_SIGNOFF_ASK_REPORTS | PENDING | `artifacts/prod-ready-pr-c2/OWNER_SIGNOFF.md` |

## Note

`TICKET-PR-B3-001` (conflict reconfirm) is primarily a sales/purchase arm
blocker (PR-C1-ARM). Ask reports still require B1 + B5 + owner sign-off.

## Clear arm when

All tickets PASS (or owner-accepted residual note), `OWNER_SIGNOFF.md` filed,
staging golden path green within 48h of flip, registry `flag_armed=true`,
matrix row `depth=PRODUCTION` + `production_approved=true` for **this row only**.
