import { createLegacyStateReader } from "@fios/legacy";
import {
  computeTrialBalance,
  computeBalanceSheet,
  computeProfitLoss,
  computeAgingReport,
} from "@/lib/accounting";
import {
  computeTotalClosingStockValue,
  mapConfigMethodToValuation,
} from "@/lib/stockValuation";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { readTrialBalanceFromProjection } from "./trialBalanceProjectionReader";
import { buildBalanceSheetFromProjection } from "./balanceSheetBuilder";
import { buildProfitLossFromProjection } from "./profitLossBuilder";
import { buildInventoryValuationReport } from "./inventoryValuationReport";
import { buildTaxReportFromProjection } from "./taxReportBuilder";
import { buildAgingReportFromProjection } from "./agingReportBuilder";
import { checkMetric, recordParityChecks, type ReportParityReport } from "./reportParityEngine";
import { recordReportDiagnostic } from "./reportDiagnostics";
import { reportMetrics } from "./reportMetrics";
import { forceReportCutoverRollback } from "./reportEngine";
import { ReportPolicies } from "./reportPolicies";
import { ReportTypes } from "./reportRegistry";

const state = createLegacyStateReader();

export async function validateTrialBalanceParity() {
  const legacy = computeTrialBalance(state.getAccounts(), state.getVouchers());
  const projection = await readTrialBalanceFromProjection();
  return [
    checkMetric(ReportTypes.TRIAL_BALANCE, "totalDebit", legacy.totalDebit, projection.totalDebit),
    checkMetric(ReportTypes.TRIAL_BALANCE, "totalCredit", legacy.totalCredit, projection.totalCredit),
  ];
}

export async function validateBalanceSheetParity(asOfDate?: string) {
  const legacy = computeBalanceSheet(state.getAccounts(), state.getVouchers(), asOfDate);
  const projection = await buildBalanceSheetFromProjection(asOfDate);
  return [
    checkMetric(ReportTypes.BALANCE_SHEET, "totalAssets", legacy.totalAssets, projection.totalAssets),
    checkMetric(
      ReportTypes.BALANCE_SHEET,
      "totalLiabEquity",
      legacy.totalLiabEquity,
      projection.totalLiabEquity,
    ),
  ];
}

export async function validateProfitLossParity(fromDate?: string, toDate?: string) {
  const legacy = computeProfitLoss(state.getAccounts(), state.getVouchers(), fromDate, toDate);
  const projection = await buildProfitLossFromProjection(fromDate, toDate);
  return [
    checkMetric(ReportTypes.PROFIT_LOSS, "totalIncome", legacy.totalIncome, projection.totalIncome),
    checkMetric(ReportTypes.PROFIT_LOSS, "totalExpense", legacy.totalExpense, projection.totalExpense),
    checkMetric(ReportTypes.PROFIT_LOSS, "netProfit", legacy.netProfit, projection.netProfit),
  ];
}

export async function validateInventoryParity() {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  const method = mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
  const legacyTotal = computeTotalClosingStockValue(state.getStockMovements(), method);
  const projection = await buildInventoryValuationReport();
  return [
    checkMetric(
      ReportTypes.INVENTORY_VALUATION,
      "totalValue",
      legacyTotal,
      projection.totalValue,
    ),
  ];
}

export async function validateTaxParity() {
  const invoices = state.getInvoices() as Array<Record<string, unknown>>;
  const legacyVat = invoices.reduce((s, inv) => s + Number(inv.vatAmount ?? 0), 0);
  const projection = await buildTaxReportFromProjection();
  return [
    checkMetric(ReportTypes.TAX_REPORT, "totalVat", legacyVat, projection.totalVat),
    checkMetric(ReportTypes.TAX_REPORT, "totalTds", 0, projection.totalTds),
  ];
}

export async function validateAgingParity(asOfDate?: string) {
  const legacy = computeAgingReport(state.getInvoices(), state.getParties(), asOfDate);
  const projection = await buildAgingReportFromProjection(asOfDate);
  const legacyOutstanding = legacy.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  const projectionOutstanding = projection.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  return [
    checkMetric(ReportTypes.AGING_REPORT, "rowCount", legacy.length, projection.length),
    checkMetric(ReportTypes.AGING_REPORT, "totalOutstanding", legacyOutstanding, projectionOutstanding),
  ];
}

export async function runFullReportParityValidation(): Promise<ReportParityReport> {
  if (!isMigrationFlagEnabled("MIGRATION_REPORT_PARITY")) {
    return { checks: [], passed: true, passRate: 1, recordedAt: new Date().toISOString() };
  }

  reportMetrics.incrementParityChecks();
  const checks = [
    ...(await validateTrialBalanceParity()),
    ...(await validateBalanceSheetParity()),
    ...(await validateProfitLossParity()),
    ...(await validateInventoryParity()),
    ...(await validateTaxParity()),
    ...(await validateAgingParity()),
  ];

  for (const check of checks) {
    recordReportDiagnostic({
      stage: check.passed ? "parity-pass" : "parity-fail",
      reportType: check.reportType,
      message: `${check.metric} legacy=${check.legacyValue} projection=${check.projectionValue}`,
      timestamp: new Date().toISOString(),
    });
    if (!check.passed) reportMetrics.incrementParityFailures();
  }

  const report = recordParityChecks(checks);

  if (
    ReportPolicies.autoRollbackOnParityFail &&
    !report.passed &&
    isMigrationFlagEnabled("MIGRATION_REPORT_CUTOVER")
  ) {
    forceReportCutoverRollback("parity threshold not met");
    reportMetrics.incrementRollbacks();
    recordReportDiagnostic({
      stage: "rollback",
      message: `auto-rollback: passRate=${report.passRate}`,
      timestamp: new Date().toISOString(),
    });
  }

  return report;
}
