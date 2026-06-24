import NepaliDate from 'nepali-date-converter';

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const NEPALI_DAYS = [
  'Aaitabar', 'Sombar', 'Mangalbar', 'Budhabar', 'Bihibar', 'Sukrabar', 'Sanibar'
];

// Lookup table for days in each month for 2000-2090 BS (simplified)
// Using standard library capabilities for exact days since nepali-date-converter handles leap years implicitly
export function getDaysInBSMonth(year: number, month: number): number {
  // Try to create a date for the last possible day (32)
  for (let d = 32; d >= 29; d--) {
    try {
      new NepaliDate(year, month - 1, d);
      return d;
    } catch {
      continue;
    }
  }
  return 30; // fallback
}

export function isValidBSDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 32) return false;
  try {
    const nd = new NepaliDate(year, month - 1, day);
    return nd.getYear() === year && nd.getMonth() === (month - 1) && nd.getDate() === day;
  } catch {
    return false;
  }
}

export function adToBS(date: Date): { year: number; month: number; day: number; monthName: string } {
  if (isNaN(date.getTime())) throw new Error("Invalid AD date");
  const nd = new NepaliDate(date);
  const year = nd.getYear();
  const month = nd.getMonth() + 1;
  const day = nd.getDate();
  return {
    year,
    month,
    day,
    monthName: NEPALI_MONTHS[nd.getMonth()]
  };
}

export function bsToAD(year: number, month: number, day: number): Date {
  if (!isValidBSDate(year, month, day)) {
    throw new Error(`Invalid BS date: ${year}-${month}-${day}`);
  }
  const nd = new NepaliDate(year, month - 1, day);
  return nd.toJsDate();
}

export function formatBS(bsDate: { year: number; month: number; day: number } | string): string {
  if (typeof bsDate === 'string') {
    const parts = bsDate.replace(/-/g, '/').split('/');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return `${d} ${NEPALI_MONTHS[m - 1]} ${y}`;
    }
    return bsDate;
  }
  return `${bsDate.day} ${NEPALI_MONTHS[bsDate.month - 1]} ${bsDate.year}`;
}

export function todayBS(): { year: number; month: number; day: number; monthName: string; dayName: string } {
  const nd = new NepaliDate();
  return {
    year: nd.getYear(),
    month: nd.getMonth() + 1,
    day: nd.getDate(),
    monthName: NEPALI_MONTHS[nd.getMonth()],
    dayName: NEPALI_DAYS[nd.getDay()]
  };
}

export function getNepaliMonths(): string[] {
  return [...NEPALI_MONTHS];
}

export function getFiscalYearFromBS(bsDate: { year: number; month: number; day: number } | string): { startYear: number; endYear: number; label: string } {
  let y: number, m: number;
  if (typeof bsDate === 'string') {
    const parts = bsDate.replace(/-/g, '/').split('/');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else {
    y = bsDate.year;
    m = bsDate.month;
  }
  
  if (m >= 4) { // Shrawan or later
    return {
      startYear: y,
      endYear: y + 1,
      label: `${y}/${String(y + 1).slice(-2)}`
    };
  } else {
    return {
      startYear: y - 1,
      endYear: y,
      label: `${y - 1}/${String(y).slice(-2)}`
    };
  }
}
