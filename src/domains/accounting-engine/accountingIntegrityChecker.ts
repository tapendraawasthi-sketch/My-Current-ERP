import { validateJournalLines } from "./doubleEntryValidator";
import {
  listAccountingAggregates,
  listShadowJournals,
  listShadowVouchers,
} from "./accountingSnapshot";
import { buildShadowTrialBalance } from "./trialBalanceBuilder";

export interface AccountingIntegrityIssue {
  code: string;
  message: string;
  voucherId?: string;
  accountId?: string;
}

export function checkTrialBalanceIntegrity(): AccountingIntegrityIssue | null {
  const tb = buildShadowTrialBalance();
  const diff = Math.abs(tb.totalDebit - tb.totalCredit);
  if (diff >= 0.01) {
    return {
      code: "TRIAL_BALANCE_MISMATCH",
      message: `Shadow trial balance unbalanced: debit=${tb.totalDebit} credit=${tb.totalCredit}`,
    };
  }
  return null;
}

export function checkVoucherBalanceIntegrity(): AccountingIntegrityIssue[] {
  const issues: AccountingIntegrityIssue[] = [];
  for (const voucher of listShadowVouchers()) {
    const validation = validateJournalLines(voucher.lines);
    if (!validation.isValid) {
      issues.push({
        code: "VOUCHER_UNBALANCED",
        message: `Voucher ${voucher.voucherNo} unbalanced`,
        voucherId: voucher.id,
      });
    }
  }
  return issues;
}

export function checkJournalIntegrity(): AccountingIntegrityIssue[] {
  const issues: AccountingIntegrityIssue[] = [];
  for (const journal of listShadowJournals()) {
    const validation = validateJournalLines(journal.lines);
    if (!validation.isValid) {
      issues.push({
        code: "JOURNAL_UNBALANCED",
        message: `Journal ${journal.id} unbalanced`,
        voucherId: journal.voucherId,
      });
    }
  }
  return issues;
}

export function checkAggregateConsistency(): AccountingIntegrityIssue[] {
  const issues: AccountingIntegrityIssue[] = [];
  const recomputed = new Map<string, { debit: number; credit: number }>();

  for (const journal of listShadowJournals()) {
    for (const line of journal.lines) {
      const existing = recomputed.get(line.accountId) ?? { debit: 0, credit: 0 };
      existing.debit += line.debit;
      existing.credit += line.credit;
      recomputed.set(line.accountId, existing);
    }
  }

  for (const aggregate of listAccountingAggregates()) {
    const computed = recomputed.get(aggregate.accountId);
    if (!computed) continue;
    if (
      Math.abs(computed.debit - aggregate.debitTotal) > 0.01 ||
      Math.abs(computed.credit - aggregate.creditTotal) > 0.01
    ) {
      issues.push({
        code: "AGGREGATE_MISMATCH",
        message: `Aggregate ${aggregate.accountId} does not match journals`,
        accountId: aggregate.accountId,
      });
    }
  }
  return issues;
}

export function runAccountingIntegrityChecks(): AccountingIntegrityIssue[] {
  const issues: AccountingIntegrityIssue[] = [];
  const tbIssue = checkTrialBalanceIntegrity();
  if (tbIssue) issues.push(tbIssue);
  issues.push(...checkVoucherBalanceIntegrity());
  issues.push(...checkJournalIntegrity());
  issues.push(...checkAggregateConsistency());
  return issues;
}
