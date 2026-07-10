export const ReportTypes = {
  TRIAL_BALANCE: "trial_balance",
  GENERAL_LEDGER: "general_ledger",
  ACCOUNT_LEDGER: "account_ledger",
  BALANCE_SHEET: "balance_sheet",
  PROFIT_LOSS: "profit_loss",
  CASH_FLOW: "cash_flow",
  STOCK_REPORT: "stock_report",
  INVENTORY_VALUATION: "inventory_valuation",
  TAX_REPORT: "tax_report",
  AGING_REPORT: "aging_report",
  DASHBOARD: "dashboard",
} as const;

export type ReportType = (typeof ReportTypes)[keyof typeof ReportTypes];

export interface ReportDefinition {
  reportType: ReportType;
  projectionTables: string[];
  legacyFunction: string;
}

const REGISTRY: Record<ReportType, ReportDefinition> = {
  [ReportTypes.TRIAL_BALANCE]: {
    reportType: ReportTypes.TRIAL_BALANCE,
    projectionTables: ["projectionTrialBalance"],
    legacyFunction: "computeTrialBalance",
  },
  [ReportTypes.GENERAL_LEDGER]: {
    reportType: ReportTypes.GENERAL_LEDGER,
    projectionTables: ["projectionGeneralLedger"],
    legacyFunction: "computeLedgerBalance",
  },
  [ReportTypes.ACCOUNT_LEDGER]: {
    reportType: ReportTypes.ACCOUNT_LEDGER,
    projectionTables: ["projectionGeneralLedger", "projectionAccountBalances"],
    legacyFunction: "computeLedgerBalance",
  },
  [ReportTypes.BALANCE_SHEET]: {
    reportType: ReportTypes.BALANCE_SHEET,
    projectionTables: ["projectionTrialBalance", "projectionAccountBalances"],
    legacyFunction: "computeBalanceSheet",
  },
  [ReportTypes.PROFIT_LOSS]: {
    reportType: ReportTypes.PROFIT_LOSS,
    projectionTables: ["projectionTrialBalance", "projectionGeneralLedger"],
    legacyFunction: "computeProfitLoss",
  },
  [ReportTypes.CASH_FLOW]: {
    reportType: ReportTypes.CASH_FLOW,
    projectionTables: ["projectionGeneralLedger"],
    legacyFunction: "computeCashFlow",
  },
  [ReportTypes.STOCK_REPORT]: {
    reportType: ReportTypes.STOCK_REPORT,
    projectionTables: ["projectionStockLedger", "projectionStockBalances"],
    legacyFunction: "computeStockSummary",
  },
  [ReportTypes.INVENTORY_VALUATION]: {
    reportType: ReportTypes.INVENTORY_VALUATION,
    projectionTables: ["projectionStockBalances"],
    legacyFunction: "computeTotalClosingStockValue",
  },
  [ReportTypes.TAX_REPORT]: {
    reportType: ReportTypes.TAX_REPORT,
    projectionTables: ["projectionTax"],
    legacyFunction: "computeTrialBalance",
  },
  [ReportTypes.AGING_REPORT]: {
    reportType: ReportTypes.AGING_REPORT,
    projectionTables: ["projectionInvoice"],
    legacyFunction: "computeAgingReport",
  },
  [ReportTypes.DASHBOARD]: {
    reportType: ReportTypes.DASHBOARD,
    projectionTables: [
      "projectionTrialBalance",
      "projectionStockBalances",
      "projectionAccountBalances",
    ],
    legacyFunction: "dashboard",
  },
};

export function getReportDefinition(reportType: ReportType): ReportDefinition {
  return REGISTRY[reportType];
}

export function listReportTypes(): ReportType[] {
  return Object.values(ReportTypes);
}
