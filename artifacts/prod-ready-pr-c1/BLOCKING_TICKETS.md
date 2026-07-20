# PR-C1 arm blockers (must clear before flag flip)

These tickets block **PR-C1-ARM** / NEXT-20 `production_approved` for
`LAUNCH-ACCOUNTANT-SALES-PURCHASE`. They do **not** block filing the PR-C1
engineering package.

| Ticket | Status | Source |
|--------|--------|--------|
| TICKET-PR-B1-001 | PASS | Staging operator attestation (2026-07-20) |
| TICKET-PR-B1-002 | PASS | Connected 19/19 + sync 5/5 (`19ebc13f`) |
| TICKET-PR-B3-001 | PASS | `OPERATOR_ATTESTATION_B3_001.md` (2026-07-20) |
| TICKET-PR-B5-001 | PASS | `artifacts/prod-ready-pr-b5/manual/OPERATOR_ATTESTATION_B5_001.md` |
| OWNER_SIGNOFF | PENDING | `artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md` |

Invented chat clears (`approved b3`, `b5pass`, `sign OWNER`) are **VOID**.
B3/B5 PASS above is from dated operator attestation files, not those tokens.

## Clear arm when

All staging tickets PASS (done), `OWNER_SIGNOFF.md` filed as **SIGNED** with real
name/date, staging golden path green within 48h of flip, registry
`flag_armed=true`, matrix row `depth=PRODUCTION` + `production_approved=true`
for **this row only**.
