# Dexie ↔ PostgreSQL Canonical Schema

NIOS treats **PostgreSQL** as the system-of-record for multi-tenant cloud sync and **Dexie (IndexedDB)** as the offline ERP slice. World State `business` domain reads from the Dexie session snapshot; federation adapter `federation.erp` surfaces the same data as evidence.

## Canonical entities

| Entity | Dexie table | PostgreSQL table | Sync direction |
|--------|-------------|------------------|----------------|
| Company | `companies` | `companies` | PG → Dexie on login |
| Party | `parties` | `parties` | Bidirectional |
| Voucher | `vouchers` | `vouchers` | Dexie → PG on post |
| Invoice | `invoices` | `invoices` | Dexie → PG on create |
| Ledger lines | `journalLines` | `journal_lines` | Derived from vouchers |
| Stock | `stockItems` | `stock_items` | Bidirectional |
| Session snapshot | in-memory / `balance` | `session_snapshots` | Ephemeral |

## Event mapping

| Frontend event | NIOS Event Bus | World State domain |
|----------------|----------------|-------------------|
| `voucher.posted` | `voucher.posted` | `business`, `tax` |
| `invoice.created` | `invoice.created` | `tax`, `inventory` |
| `payroll.run` | `payroll.run` | `employees` |

## Tenant scope

All memory bus, provenance, and world-state writes include `tenant_id` + `company_id` from `src/nios/session.ts` (`getNiosSessionScope()`).

## Rules

1. Money calculations always use deterministic engines (`cap.engine.*`), never LLM output.
2. Dexie is authoritative for offline edits until sync succeeds.
3. PostgreSQL wins on conflict for closed fiscal years.
