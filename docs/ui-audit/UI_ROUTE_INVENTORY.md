# UI Route Inventory

Generated: 2026-07-20T11:09:16.867Z

## Summary

| Metric | Value |
|--------|------:|
| Total routes (incl. auth) | 4 |
| Authenticated page IDs | 0 |
| Unique page components | 0 |
| With nav entry | 0 |
| Without nav entry | 0 |
| Nav destinations missing App route | 77 |
| Visually covered (UI QA harness) | 0 |

## Router model

Navigation is **not** URL-path based. The app uses Zustand `currentPage` and a large `switch` in `src/App.tsx`. Authenticated pages render inside `Layout` → `AppShell`.

## Auth stages

| Stage | Component |
|-------|-----------|
| checking | inline spinner |
| error | InitErrorScreen |
| no-company | SignUpWizard |
| gateway | GatewayScreen |
| company-login | CompanyLoginScreen |
| authenticated | Layout → AppShell → page |

## Routes without navigation entry

_None_

## Nav destinations without App.tsx route

- `dashboard`
- `orbix`
- `billing`
- `sales-return`
- `sales-order`
- `delivery-challan`
- `sales-register`
- `parties`
- `purchase`
- `purchase-return`
- `purchase-order`
- `goods-receipt`
- `purchase-register`
- `receipt`
- `payment`
- `contra`
- `bank-reconciliation`
- `bank-statement-import`
- `cheque-register`
- `cheque-printing`
- `pdc-register`
- `pos-billing`
- `items`
- `item-groups`
- `stock-summary`
- `stock-ledger`
- `stock-transfer`
- `stock-journal`
- `physical-stock`
- `job-work-register`
- `batch-management`
- `warehouses`
- `journal`
- `voucher-entry`
- `debit-note`
- `credit-note`
- `accounts`
- `day-book`
- `ledger`
- `cost-centers`
- `standard-narration`
- `bill-sundry`
- `units`
- `price-lists`
- `budget`
- `fixed-assets`
- `fiscal-year`
- `trial-balance`
- `profit-loss`
- `balance-sheet`
- `cash-flow`
- `party-statement`
- `outstanding-receivables`
- `outstanding-payables`
- `aging-report`
- `budget-vs-actual`
- `branch-reports`
- `sales-analysis`
- `ratio-analysis`
- `financial-dashboard`
- `vat-reports`
- `tds-report`
- `statutory-compliance`
- `audit-log`
- `settings`
- `company-features`
- `users`
- `branch-master`
- `print-settings`
- `configuration-hub`
- `accounts-configuration`
- `inventory-config`
- `backup-restore`
- `payroll`
- `pdc-management`
- `recurring-vouchers`
- `communication-hub`

## Full route table

| Page ID | Component | Module | Nav | Visual QA | Priority |
|---------|-----------|--------|-----|-----------|----------|

