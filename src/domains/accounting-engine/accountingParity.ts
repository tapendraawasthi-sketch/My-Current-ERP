import { createLegacyStateReader } from "@fios/legacy";
import { computeTrialBalance } from "@/lib/accounting";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import {
  calculateLegacyAccountBalance,
  calculateShadowAccountBalance,
} from "./accountBalanceCalculator";
import { buildLegacyTrialBalance, buildShadowTrialBalance } from "./trialBalanceBuilder";
import { listShadowJournals, listShadowVouchers } from "./accountingSnapshot";
import { buildTaxLinesFromInvoice } from "./taxPostingEngine";
import { AccountingPolicies } from "./accountingPolicies";
import { recordPostingDiagnostic } from "./postingDiagnostics";
import { accountingMetrics } from "./accountingMetrics";

const state = createLegacyStateReader();

export interface AccountingParityResult {
  metric: string;
  accountId?: string;
  voucherId?: string;
  legacyValue: number;
  shadowValue: number;
  diff: number;
  withinTolerance: boolean;
  passed: boolean;
}

export interface AccountingParityReport {
  checks: AccountingParityResult[];
  passed: boolean;
  recordedAt: string;
}

function checkMetric(
  metric: string,
  legacyValue: number,
  shadowValue: number,
  ids?: { accountId?: string; voucherId?: string },
): AccountingParityResult {
  const diff = Math.abs(legacyValue - shadowValue);
  const withinTolerance = diff <= AccountingPolicies.parityTolerance;
  return {
    metric,
    accountId: ids?.accountId,
    voucherId: ids?.voucherId,
    legacyValue,
    shadowValue,
    diff,
    withinTolerance,
    passed: withinTolerance,
  };
}

export function validateTrialBalanceParity(): AccountingParityResult[] {
  const legacy = buildLegacyTrialBalance();
  const shadow = buildShadowTrialBalance();
  return [
    checkMetric("trialBalanceDebit", legacy.totalDebit, shadow.totalDebit),
    checkMetric("trialBalanceCredit", legacy.totalCredit, shadow.totalCredit),
  ];
}

export function validateAccountBalanceParity(accountId?: string): AccountingParityResult[] {
  const accounts = accountId
    ? (state.getAccounts() as Array<{ id: string }>).filter((a) => a.id === accountId)
    : (state.getAccounts() as Array<{ id: string }>).slice(0, 20);

  return accounts.map((account) =>
    checkMetric(
      "accountBalance",
      calculateLegacyAccountBalance(account.id),
      calculateShadowAccountBalance(account.id),
      { accountId: account.id },
    ),
  );
}

export function validateVoucherCountParity(): AccountingParityResult[] {
  const legacyPosted = state.getVouchers().filter((v) => v.status === "posted").length;
  const shadowPosted = listShadowVouchers().filter((v) => v.status === "posted").length;
  return [checkMetric("postedVoucherCount", legacyPosted, shadowPosted)];
}

export function validateJournalParity(): AccountingParityResult[] {
  const legacyJournals = state
    .getVouchers()
    .filter((v) => v.status === "posted")
    .reduce((sum, v) => sum + (v.lines?.length ?? 0), 0);
  const shadowJournals = listShadowJournals().reduce((sum, j) => sum + j.lines.length, 0);
  return [checkMetric("journalLineCount", legacyJournals, shadowJournals)];
}

export function validateTaxParity(): AccountingParityResult[] {
  const invoices = state.getInvoices() as Array<Record<string, unknown>>;
  let legacyVat = 0;
  let shadowVat = 0;
  for (const inv of invoices) {
    legacyVat += Number(inv.vatAmount ?? 0);
    shadowVat += buildTaxLinesFromInvoice(inv).vatAmount;
  }
  return [checkMetric("totalVatAmount", legacyVat, shadowVat)];
}

export function validateBalanceParity(): AccountingParityResult[] {
  const legacy = computeTrialBalance(state.getAccounts(), state.getVouchers());
  const diff = Math.abs(legacy.totalDebit - legacy.totalCredit);
  const shadow = buildShadowTrialBalance();
  const shadowDiff = Math.abs(shadow.totalDebit - shadow.totalCredit);
  return [
    checkMetric("legacyBalanceDiff", diff, 0),
    checkMetric("shadowBalanceDiff", shadowDiff, 0),
  ];
}

export function runAccountingParityValidation(): AccountingParityReport {
  if (!isMigrationFlagEnabled("MIGRATION_ACCOUNTING_PARITY")) {
    return { checks: [], passed: true, recordedAt: new Date().toISOString() };
  }

  accountingMetrics.incrementParityChecks();
  const checks: AccountingParityResult[] = [
    ...validateTrialBalanceParity(),
    ...validateAccountBalanceParity(),
    ...validateVoucherCountParity(),
    ...validateJournalParity(),
    ...validateTaxParity(),
    ...validateBalanceParity(),
  ];

  for (const check of checks) {
    recordPostingDiagnostic({
      stage: check.passed ? "parity-pass" : "parity-fail",
      accountId: check.accountId,
      voucherId: check.voucherId,
      message: `${check.metric} legacy=${check.legacyValue} shadow=${check.shadowValue}`,
      timestamp: new Date().toISOString(),
    });
    if (!check.passed) accountingMetrics.incrementParityFailures();
  }

  const passed = checks.every((c) => c.passed);
  return { checks, passed, recordedAt: new Date().toISOString() };
}
