# Sutra ERP — Cached Design Rules & Architectural Metadata (DO NOT EDIT — used for context caching)

## Stack
React 19, Vite, TanStack Router, Tailwind v4, Dexie (IndexedDB), Zustand, Recharts, TypeScript strict.

## Critical Scope Rules (ENFORCE ON EVERY TASK)
- NEVER read or edit: node_modules, dist, .git, .workspace, .tanstack, *.lock, tsconfig.tsbuildinfo
- DEAD/UNUSED files — never open or edit: src/components/StockItems.tsx, src/components/invoice/PurchaseInvoiceForm.tsx, src/components/invoice/ReturnInvoiceForm.tsx
- The stock items list page is src/pages/StockBook.tsx (NOT StockItems.tsx)
- SalesInvoiceForm.tsx handles ALL 4 billing tabs inside BillingInvoice.tsx
- Only edit files explicitly named in the current task

## Color Tokens (CSS vars in src/styles.css)
Primary: #1557b0 (hover #0f4a96)
Sidebar bg: #16213e | Sidebar border: #1e2d50 | Sidebar accent: #1e3060
Page bg: #f0f2f5
Border: #dde1ea | Border strong: #c5cad8
Success: #15803d | Warning: #b45309 | Danger: #dc2626 | Info: #0369a1
Table header bg: #eef1f8 | Table stripe: #f7f9fc | Table hover: #e8eeff
Amount debit: #1557b0 | Amount credit: #dc2626

## Typography Rules
- Page title: text-[14px] font-bold text-gray-900
- Section header: text-[10px] font-bold uppercase tracking-widest text-gray-500
- Table header: text-[10px] font-bold uppercase letter-spacing: 0.06em text-[#4b5563]
- Body/cell text: text-[12px] text-gray-700
- Form label: text-[11px] font-semibold text-gray-700
- NEVER use: font-black, text-base, text-xl, tracking-widest on data/names/amounts

## Standard CSS Classes (defined in styles.css — use these, do not recreate inline)
Layout: .page-wrapper, .page-toolbar, .page-toolbar-left, .page-toolbar-right, .page-content-area
Titles: .page-title, .page-subtitle
Tables: .data-table, .data-table thead th.th-right, .data-table thead th.th-center, .sticky-thead
Amounts: .amt, .amt-dr (blue), .amt-cr (red), .amt-positive (green), .amt-negative (red), .amt-zero (gray)
Badges: .badge, .badge-posted, .badge-draft, .badge-cancelled, .badge-paid, .badge-unpaid, .badge-partial, .badge-active, .badge-inactive, .badge-sales, .badge-purchase, .badge-journal, .badge-payment, .badge-receipt, .badge-contra
Forms: .form-wrapper, .form-header, .form-section, .form-section-title, .form-footer, .form-grid-2, .form-grid-3, .form-grid-4
Invoice: .line-table, .totals-panel, .totals-row, .totals-row.total-final, .totals-row.total-vat
Dashboard: .kpi-card, .kpi-label, .kpi-value, .kpi-meta
Sidebar: .sidebar-scroll (custom scrollbar)
Search: .search-input
Reports: .report-toolbar
Print: .no-print, .print-only
Animations: .animate-fadeIn, .animate-slide-in

## Button Standard
Primary: h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md
Outline: h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50
Sizes: xs=h-6, sm=h-7, md=h-8, lg=h-9

## Input Standard
h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]

## Table Standard
thead tr: bg-[#eef1f8] border-b-2 border-[#c5cad8]
th: px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left
tbody tr even: bg-[#f7f9fc]
tbody tr hover: bg-[#e8eeff]
td: px-3 py-[7px] text-[12px] text-gray-700
tfoot: bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold

---

## 1. Core TypeScript Types

```typescript
export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  gstin?: string;
  address?: string;
  state: string; // Indian State name or code
  createdAt: Date;
}

export interface FiscalYear {
  id: string;
  companyId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export interface TaxCategory {
  id: string;
  name: string; // e.g., "GST 18%"
  cgstRate: number; // e.g., 9
  sgstRate: number; // e.g., 9
  igstRate: number; // e.g., 18
  hsnCode?: string;
}

export interface Account {
  id: string;
  companyId: string;
  tenantId: string;
  name: string;
  code?: string;
  groupName: string; // e.g., "Sundry Debtors", "Bank Accounts"
  openingBalance: number;
  balanceType: 'DR' | 'CR';
}

export interface VoucherLine {
  accountId: string;
  amount: number;
  type: 'DR' | 'CR';
  narration?: string;
  billReferences?: BillReference[];
}

export interface Voucher {
  id: string;
  companyId: string;
  tenantId: string;
  fiscalYearId: string;
  voucherType: 'PAYMENT' | 'RECEIPT' | 'JOURNAL' | 'CONTRA' | 'SALES' | 'PURCHASE' | 'SALES_RETURN' | 'PURCHASE_RETURN';
  voucherNo: string;
  date: Date;
  lines: VoucherLine[];
  narration?: string;
  isPosted: boolean;
  metadata?: Record<string, any>;
}

export interface Ledger {
  id: string;
  companyId: string;
  tenantId: string;
  voucherId: string;
  accountId: string;
  date: Date;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface BillReference {
  refType: 'NEW' | 'AGAINST' | 'ADVANCE' | 'ON_ACCOUNT';
  refNo: string;
  amount: number;
}
```

## 2. Database Schema Snippets (PostgreSQL DDL)

```sql
-- Core Tenants & Identity Partitioning
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    gstin VARCHAR(15),
    state VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Master Tables
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    group_name VARCHAR(100) NOT NULL,
    opening_balance NUMERIC(15, 2) DEFAULT 0.00,
    balance_type VARCHAR(2) CHECK (balance_type IN ('DR', 'CR')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- Immutable Event-Sourced Ledger Postings
CREATE TABLE ledger_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
    voucher_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id),
    posting_date DATE NOT NULL,
    debit NUMERIC(15, 2) DEFAULT 0.00,
    credit NUMERIC(15, 2) DEFAULT 0.00,
    narration TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Immutable Event-Sourced Inventory Postings
CREATE TABLE inventory_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
    voucher_id UUID NOT NULL,
    item_id UUID NOT NULL,
    material_centre_id UUID NOT NULL,
    posting_date DATE NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL, -- positive for receipts, negative for issues
    rate NUMERIC(15, 4) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 3. Standard API Response Envelope Structure

```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-06-23T14:57:54.000Z"
}
```
Or for errors:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance in selected account",
    "details": {}
  },
  "timestamp": "2026-06-23T14:57:54.000Z"
}
```

## 4. Keyboard Shortcut Mapping

| Key | Action | Context |
|---|---|---|
| **F2** | Save/Submit Form | Global Forms |
| **F4** | Focus/Open Narration Box | Voucher entry |
| **F6** | Toggle Type (DR/CR) | Voucher line items grid |
| **F9** | Delete Active Row | Grids / Line items table |
| **Alt + C** | Add Master Account/Item inline | Select Dropdowns |

## 5. Default Indian CoA Group Hierarchy

- **Income (Revenue)**
  - Direct Income (Sales)
  - Indirect Income (Interest, Rent, Discounts Received)
- **Expenses**
  - Direct Expenses (Purchases, Carriage Inwards)
  - Indirect Expenses (Salaries, Rent, Depreciation)
- **Assets**
  - Fixed Assets (Plant & Machinery, Computers, Buildings)
  - Current Assets
    - Bank Accounts
    - Cash-in-hand
    - Sundry Debtors
    - Stock-in-hand
- **Liabilities**
  - Capital Account (Equity, Reserves & Surplus)
  - Current Liabilities
    - Sundry Creditors
    - Duties & Taxes (GST Accounts: CGST, SGST, IGST)
    - Provisions

## 6. GST Tax Category Structure

| Tax Category | CGST Rate | SGST Rate | IGST Rate | Description |
|---|---|---|---|---|
| **GST 0% (Exempt)** | 0% | 0% | 0% | Exempt or Nil rated goods/services |
| **GST 5%** | 2.5% | 2.5% | 5% | Essential items, basic foods |
| **GST 12%** | 6% | 6% | 12% | Standard rate lower tier |
| **GST 18%** | 9% | 9% | 18% | Standard rate default tier (services & main goods) |
| **GST 28%** | 14% | 14% | 28% | Luxury / Sin goods |

## 7. Error Codes and Messages

| Code | Message |
|---|---|
| `UNAUTHORIZED` | Invalid credentials or expired session token. |
| `FORBIDDEN` | You do not have the required role to perform this action. |
| `TENANT_NOT_FOUND` | The specified tenant partition does not exist. |
| `FISCAL_YEAR_CLOSED` | Transactions cannot be entered/modified in a closed fiscal year. |
| `UNBALANCED_VOUCHER` | Total Debit must equal Total Credit for double-entry validation. |
| `DUPLICATE_VOUCHER_NO` | The voucher number already exists in this fiscal year. |
| `INVALID_GSTIN` | The provided GSTIN does not follow the standard Indian format. |
