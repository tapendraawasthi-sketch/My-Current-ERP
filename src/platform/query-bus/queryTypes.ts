export const QueryTypes = {
  GET_VOUCHER: "GetVoucher",
  LIST_VOUCHERS: "ListVouchers",
  GET_INVOICE: "GetInvoice",
  LIST_INVOICES: "ListInvoices",
  GET_ACCOUNT: "GetAccount",
  LIST_ACCOUNTS: "ListAccounts",
  GET_PARTY: "GetParty",
  LIST_PARTIES: "ListParties",
  GET_ITEM: "GetItem",
  LIST_ITEMS: "ListItems",
  TRIAL_BALANCE: "TrialBalance",
  LEDGER: "Ledger",
  PROFIT_LOSS: "ProfitLoss",
  BALANCE_SHEET: "BalanceSheet",
  CASH_BOOK: "CashBook",
  DAY_BOOK: "DayBook",
  STOCK_LEDGER: "StockLedger",
  STOCK_SUMMARY: "StockSummary",
  INVENTORY_VALUATION: "InventoryValuation",
  TAX_SUMMARY: "TaxSummary",
  AUDIT_LOG: "AuditLog",
  NOTIFICATIONS: "Notifications",
  COMPANY_SETTINGS: "CompanySettings",
  FISCAL_YEAR: "FiscalYear",
  NUMBER_SERIES: "NumberSeries",
  SYNC_STATUS: "SyncStatus",
} as const;

export type QueryType = (typeof QueryTypes)[keyof typeof QueryTypes];

export const ALL_QUERY_TYPES: QueryType[] = Object.values(QueryTypes);
