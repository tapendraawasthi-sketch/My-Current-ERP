# ADR_0100 — PR-C1-ARM Sales/Purchase Launch Armed

- **Status:** Accepted (2026-07-20)
- **Step:** PR-C1-ARM
- **Supersedes attempt:** ADR_0091 (BLOCKED) → this ADR records successful arm
- **Capability row:** `LAUNCH-ACCOUNTANT-SALES-PURCHASE`

## Context

Tickets B1-001/002, B3-001, B5-001 cleared (with documented owner residuals where noted).  
Owner signed `artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md` via chat `sign OWNER`.

## Decision

1. Registry `flag.armed=true`, `flag.production_approved=true`, `depth=PRODUCTION` for this row only.
2. NEXT-20 DONE for this launch row.
3. Runtime env `LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true` must be set on Render for live gate.
4. Ask reports row remains unarmed (PR-C2-ARM).
5. `recommended_next_step` → **PR-C3-RUN** (Day-0 smoke).

## Residuals accepted by owner

- B1-002 browser/sync pack not fully green (next12 staging PASS)
- B3 staging conflict exercise not fully run
- GAP-P2-008 remains REDUCED

## Explicit non-claims

- Not Ask-reports PRODUCTION
- Not global all-rows production_approved
- Not 14-day stability proven (PR-D*)
