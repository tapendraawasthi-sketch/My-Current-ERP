# Orbix Phase 4.2–4.8 Implementation Report

**Date:** 2026-07-12  
**Architecture:** Model B — Dexie local-first (`SutraERPDatabase`)

## 1–4. Prior Phase 4 code review

| Component | Decision |
|-----------|----------|
| `executeOrbixConfirm` | **Refactored** — inventory → `postPurchaseTransaction` |
| localStorage idempotency | **Deprecated** for purchases |
| `/orbix/drafts` | **Kept** (client-verified ack only) |
| `confirmKhataEntry` | **Kept** for non-inventory khata only |
| `addInvoice` | **Refactored** — audit + syncOutbox in same txn |
| Python `_post_confirmed_voucher` | **Refactored** — `posted: false`, `ready_for_local_post: true` |

## 5–14. Purchase command

- **Command:** `postPurchaseTransaction` (`src/domains/purchase/postPurchaseTransaction.ts`)
- **Manual form:** continues via `addInvoice` → shared `invoicePostingWriters` (same journal/stock)
- **Orbix:** `executeOrbixConfirm` → inventory classification → `postPurchaseTransaction`
- **Dexie v27:** `orbixPostingReceipts` (`id, scopedKey, idempotencyKey, companyId, draftId, status, …`)
- **Idempotency:** lookup-or-create `processing` → complete inside same txn; replay returns stored result
- **Txn tables:** invoices, vouchers, stockMovements, accounts, auditLogs, syncOutbox, orbixPostingReceipts, items, periodLocks
- **Audit:** required; failure aborts
- **Sync:** durable `syncOutbox` row; no network inside txn
- **Numbers:** allocated inside txn via `generateNextInvoiceNo` with collision retry

## 15–17. Classification & Python

- Inventory purchase intents: `khata_purchase`, `khata_stock_purchase`, `khata_credit_purchase`
- Unresolved item → `classification_required` (no silent asset posting)
- E2E item: **E2E Test Bike** (`item-e2e-test-bike`, pcs, goods)
- Python must not claim browser ledger completion

## 18–26. Environment

| Item | Value |
|------|-------|
| Start | `erp_bot\.venv\Scripts\python.exe scripts\start_render.py` |
| Port | **8765** |
| `/ready` | `posting_authority: dexie_local_first` (verified) |
| Seed | `seedOrbixE2ECompany()` / `resetOrbixE2ECompany()` |
| Users | `e2e.accountant` (post), `e2e.viewer` (restricted) |

## 27–42. Test results (this session)

| Check | Result |
|-------|--------|
| Domain `postPurchaseTransaction` | **7/7 passed** (post, idempotent replay, permission, ask mode, rollback, zero qty, seed) |
| Orbix gates + classification | **6/6 passed** |
| Phase 3 contracts | **included in 22 Orbix tests passed** |
| Backend bike draft | **passed** |
| `/ready` | **passed** |
| Connected Playwright API | run gated by live bot (health/clarify/continuation/mark-posted) |
| Full UI Day Book E2E | **remaining** — domain verifies Dexie persistence; browser Day Book click-through still recommended |
| Vite build / full tsc | pre-existing platform errors may remain; purchase module tests green |

## 43–50. Files

**Created**

- `src/domains/purchase/postPurchaseTransaction.ts`
- `src/domains/purchase/money.ts`
- `src/domains/purchase/e2eSeed.ts`
- `src/domains/purchase/index.ts`
- `src/store/invoicePostingWriters.ts`
- `src/__tests__/orbix/postPurchaseTransaction.test.ts`
- `docs/ORBIX_PHASE4_2_REPORT.md`

**Changed**

- `src/lib/db.ts` (v27 receipts)
- `src/lib/ekhata/orbixPostingService.ts`
- `src/store/slices/voucherSlice.ts`
- `src/store/index.ts` (re-exports writers)
- `erp_bot/src/orbix/tools/ledger_tools.py`
- `docs/ORBIX_PHASE4_CONNECTED.md`
- `src/__tests__/orbix/orbixPostingService.test.ts`

## 51–53. Limitations

- Browser-local RBAC is not cryptographic; console can still call JS/IndexedDB
- Multi-device voucher/invoice numbers remain sync-sensitive
- Deterministic LLM test provider package not fully separated (`OIP_FORCE_STUB_PROVIDERS` + preprocess path used)
- Connected Playwright UI Confirm → Day Book still to harden
- Phase 4.12 UI migration **not started** (gated)

## 54. Next phase

1. Playwright: seed E2E company in page, Confirm click, assert Day Book + stock  
2. Stale-preview + restricted-user browser cases  
3. Then Phase 4.12 ItemSelect / ItemForm / StockJournal
