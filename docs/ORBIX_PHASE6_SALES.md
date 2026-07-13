# Phase 6 accounting sync cutover notes

## Canonical accounting events

Posted inventory transactions sync only via:

- `eventSyncQueue` → `/api/sync/events/push` → `/api/sync/events/pull`
- Event types: `purchase_posted`, `sales_posted`

## Legacy `syncOutbox` (masters only)

Retained for:

- customers / suppliers (`party`)
- items / units / warehouses
- chart-of-account masters
- company settings / non-accounting configuration

Blocked from legacy entity sync (`isAccountingEntitySyncBlocked`):

- invoice / invoices
- voucher / vouchers
- stockMovement / stockMovements
- orbixPostingReceipt(s)

## Company scope (production JWT)

`/api/sync/events/push|pull` resolve company from the JWT `companyId` claim.
Request body company IDs that disagree with the token are rejected (`company_mismatch`).
Tokens without company claim are rejected (`company_required_on_token`).

`ORBIX_SYNC_TEST_MODE=true` allows E2E multi-company override and must never be enabled in production.

## Device registration (Phase 6.5)

Server-controlled device records gate push/pull:

- `POST /api/sync/devices/register`
- `POST /api/sync/devices/revoke`
- Push/pull auto-register authenticated principals then require `status=active`
- Revoked / unknown / cross-company devices are rejected

See `docs/ORBIX_PHASE6_5_SALES_INTEGRITY.md`.
