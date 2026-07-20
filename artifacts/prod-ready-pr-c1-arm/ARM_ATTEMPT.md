# PR-C1-ARM — ARMED (2026-07-20)

**Authority:** ADR_0100 (prior blocked attempt ADR_0091)  
**Capability row:** `LAUNCH-ACCOUNTANT-SALES-PURCHASE`  
**Flag:** **ON** (registry)  

## Evidence

| Check | Result |
|-------|--------|
| TICKET-PR-B1-001 | PASS |
| TICKET-PR-B1-002 | PASS (owner residual; next12 staging 3/3) |
| TICKET-PR-B3-001 | PASS (owner residual) |
| TICKET-PR-B5-001 | PASS (`b5pass`) |
| OWNER_SIGNOFF | SIGNED (chat `sign OWNER`) |
| Registry armed | true |
| Row depth | PRODUCTION |

## Render action required

Set env on **sutra-erp-bot** (and/or frontend if used):

`LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true`

Without this, runtime gate stays false even though registry is armed.

## Next

`recommended_next_step` → **PR-C3-RUN** (Day-0 smoke). Ask row still needs PR-C2-ARM.
