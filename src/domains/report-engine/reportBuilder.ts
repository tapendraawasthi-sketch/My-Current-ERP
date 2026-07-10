import type { ReportType } from "./reportRegistry";
import { readTrialBalanceFromProjection } from "./trialBalanceProjectionReader";
import { readGeneralLedgerFromProjection } from "./generalLedgerProjectionReader";
import { readAccountLedger } from "./accountLedgerReader";
import { buildBalanceSheetFromProjection } from "./balanceSheetBuilder";
import { buildProfitLossFromProjection } from "./profitLossBuilder";
import { buildCashFlowFromProjection } from "./cashFlowBuilder";
import { buildStockReportFromProjection } from "./stockReportBuilder";
import { buildInventoryValuationReport } from "./inventoryValuationReport";
import { buildTaxReportFromProjection } from "./taxReportBuilder";
import { buildAgingReportFromProjection } from "./agingReportBuilder";
import { runDashboardQuery } from "./dashboardQueryEngine";
import { ReportTypes } from "./reportRegistry";

export interface ReportQueryParams {
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
  partyType?: string;
}

export async function buildReport(
  reportType: ReportType,
  params: ReportQueryParams = {},
): Promise<unknown> {
  switch (reportType) {
    case ReportTypes.TRIAL_BALANCE:
      return readTrialBalanceFromProjection();
    case ReportTypes.GENERAL_LEDGER:
      return readGeneralLedgerFromProjection(params.accountId);
    case ReportTypes.ACCOUNT_LEDGER:
      if (!params.accountId) throw new Error("accountId required");
      return readAccountLedger(params.accountId);
    case ReportTypes.BALANCE_SHEET:
      return buildBalanceSheetFromProjection(params.asOfDate);
    case ReportTypes.PROFIT_LOSS:
      return buildProfitLossFromProjection(params.fromDate, params.toDate);
    case ReportTypes.CASH_FLOW:
      return buildCashFlowFromProjection(params.fromDate, params.toDate);
    case ReportTypes.STOCK_REPORT:
      return buildStockReportFromProjection();
    case ReportTypes.INVENTORY_VALUATION:
      return buildInventoryValuationReport();
    case ReportTypes.TAX_REPORT:
      return buildTaxReportFromProjection();
    case ReportTypes.AGING_REPORT:
      return buildAgingReportFromProjection(params.asOfDate, params.partyType);
    case ReportTypes.DASHBOARD:
      return runDashboardQuery();
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}
