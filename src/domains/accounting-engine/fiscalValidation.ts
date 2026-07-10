import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export interface FiscalViolation {
  date: string;
  message: string;
}

export function validateDateInFiscalYear(date: string): FiscalViolation | null {
  const fiscalYear = state.getCurrentFiscalYear() as {
    startDate?: string;
    endDate?: string;
    label?: string;
  } | null;
  if (!fiscalYear?.startDate || !fiscalYear?.endDate) return null;
  if (date < fiscalYear.startDate || date > fiscalYear.endDate) {
    return {
      date,
      message: `Date ${date} is outside fiscal year ${fiscalYear.label ?? ""}`,
    };
  }
  return null;
}
