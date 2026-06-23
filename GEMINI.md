# Sutra ERP — Cached Design Rules (DO NOT EDIT — used for context caching)

## Stack

React 19, Vite, TanStack Router, Tailwind v4, Dexie (IndexedDB), Zustand, Recharts, TypeScript strict.

## Critical Scope Rules (ENFORCE ON EVERY TASK)

- NEVER read or edit: node_modules, dist, .git, .workspace, .tanstack, \*.lock, tsconfig.tsbuildinfo
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
