import type { JournalLine } from "./accountingAggregate";
import { AccountingPolicies } from "./accountingPolicies";

export interface PostingRuleResult {
  passed: boolean;
  code: string;
  message?: string;
}

export function validateLineCount(lines: JournalLine[]): PostingRuleResult {
  if (lines.length > AccountingPolicies.maxVoucherLines) {
    return {
      passed: false,
      code: "MAX_LINES_EXCEEDED",
      message: `Exceeds max ${AccountingPolicies.maxVoucherLines} lines`,
    };
  }
  return { passed: true, code: "LINE_COUNT_OK" };
}

export function validateNonZeroLines(lines: JournalLine[]): PostingRuleResult {
  const hasAmount = lines.some((l) => l.debit > 0 || l.credit > 0);
  if (!hasAmount) {
    return { passed: false, code: "EMPTY_LINES", message: "No debit/credit amounts" };
  }
  return { passed: true, code: "LINES_OK" };
}

export function validateAccountIds(lines: JournalLine[]): PostingRuleResult {
  const missing = lines.filter((l) => !l.accountId);
  if (missing.length > 0) {
    return { passed: false, code: "MISSING_ACCOUNT", message: "Line missing accountId" };
  }
  return { passed: true, code: "ACCOUNTS_OK" };
}

export function runPostingRules(lines: JournalLine[]): PostingRuleResult[] {
  return [validateLineCount(lines), validateNonZeroLines(lines), validateAccountIds(lines)];
}

export function allRulesPassed(results: PostingRuleResult[]): boolean {
  return results.every((r) => r.passed);
}
