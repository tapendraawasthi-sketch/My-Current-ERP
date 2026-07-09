/** SUTRA AI — current fiscal year bounds (Nepal FY) */

export interface FiscalYearBounds {
  label: string;
  startDate: string;
  endDate: string;
}

export function resolveFiscalYear(raw?: {
  name?: string;
  fiscalYearBS?: string;
  startDate?: string;
  endDate?: string;
}): FiscalYearBounds {
  if (raw?.startDate && raw?.endDate) {
    return {
      label: raw.name ?? raw.fiscalYearBS ?? "Current FY",
      startDate: raw.startDate,
      endDate: raw.endDate,
    };
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const fyStartYear = month >= 6 ? year : year - 1;
  const startDate = `${fyStartYear}-07-01`;
  const endDate = `${fyStartYear + 1}-06-30`;
  const bsStart = fyStartYear + 57;
  const bsEnd = bsStart + 1;
  const label = `${bsStart}/${String(bsEnd).slice(-2)}`;

  return { label, startDate, endDate };
}
