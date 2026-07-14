# UI-7 — Line Item Grid Spec

Foundation: existing `InvoiceLineItem` + SalesInvoiceForm / PurchaseVoucher grids, wrapped by DocumentCanvas.

Required columns only when supported: item, description, qty, unit, rate, discount, tax, warehouse, amount.

Keyboard: Tab/Shift+Tab; Enter defined per field; focus restore on row delete. No spreadsheet formulas. Validation linked to row/field — not Toast-only. Financial alignment + tabular numerals via DS. Stock warnings only from authoritative sources.
