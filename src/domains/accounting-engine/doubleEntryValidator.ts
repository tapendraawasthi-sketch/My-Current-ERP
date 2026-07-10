import { validateDoubleEntry, type DoubleEntryValidation } from "@/lib/accounting";
import type { JournalLine } from "./accountingAggregate";

export type { DoubleEntryValidation };

export function validateJournalLines(lines: JournalLine[]): DoubleEntryValidation {
  return validateDoubleEntry(lines);
}

export function assertBalanced(lines: JournalLine[]): DoubleEntryValidation {
  const result = validateJournalLines(lines);
  if (!result.isValid) {
    throw new Error(
      `Double-entry violation: debit=${result.totalDebit} credit=${result.totalCredit} diff=${result.difference}`,
    );
  }
  return result;
}
