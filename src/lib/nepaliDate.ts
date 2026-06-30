// â”€â”€â”€ Nepali Calendar (Bikram Sambat) Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fixes BUG-004, BUG-025-034: All date conversions centralised here.
// Every report should use these helpers for BS date display.

// BS month data: each row = [total days in each month for that BS year]
// Starting from BS 2000 (AD 1943-44)
export const BS_MONTH_DATA: number[][] = [
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2000
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2001
  [31,31,32,32,31,30,30,29,30,29,30,30], // 2002
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2003
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2004
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2005
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2006
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2007
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2008
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2009
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2010
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2011
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2012
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2013
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2014
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2015
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2016
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2017
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2018
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2019
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2020
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2021
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2022
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2023
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2024
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2025
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2026
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2027
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2028
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2029
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2030
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2031
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2032
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2033
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2034
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2035
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2036
  [31,31,31,32,31,31,30,29,30,29,30,30], // 2037
  [31,31,32,31,31,31,29,30,30,29,29,31], // 2038
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2039
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2040
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2041
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2042
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2043
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2044
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2045
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2046
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2047
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2048
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2049
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2050
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2051
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2052
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2053
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2054
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2055
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2056
  [31,31,32,31,31,30,30,29,30,29,30,30], // 2057
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2058
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2059
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2060
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2061
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2062
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2063
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2064
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2065
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2066
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2067
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2068
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2069
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2070
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2071
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2072
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2073
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2074
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2075
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2076
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2077
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2078
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2079
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2080
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2081
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2082
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2083
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2084
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2085
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2086
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2087
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2088
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2089
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2090
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2091
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2092
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2093
  [31,32,31,32,31,30,30,29,30,29,30,30], // 2094
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2095
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2096
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2097
  [31,31,32,31,31,30,30,30,29,30,29,31], // 2098
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2099
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2100
];

const BS_START_YEAR = 2000;
// AD date corresponding to BS 2000 Baisakh 1 = April 13, 1943
const AD_EPOCH = new Date(1943, 3, 14); // months are 0-indexed

export const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan",
  "Bhadra", "Ashwin", "Kartik", "Mangsir",
  "Poush", "Magh", "Falgun", "Chaitra",
];

export const BS_MONTHS_NP = [
  "à¤¬à¥ˆà¤¶à¤¾à¤–", "à¤œà¥‡à¤ ", "à¤†à¤·à¤¾à¤¢", "à¤¶à¥à¤°à¤¾à¤µà¤£",
  "à¤­à¤¾à¤¦à¥à¤°", "à¤†à¤¶à¥à¤µà¤¿à¤¨", "à¤•à¤¾à¤°à¥à¤¤à¤¿à¤•", "à¤®à¤‚à¤¸à¤¿à¤°",
  "à¤ªà¥Œà¤·", "à¤®à¤¾à¤˜", "à¤«à¤¾à¤²à¥à¤—à¥à¤¨", "à¤šà¥ˆà¤¤à¥à¤°",
];

export interface BSDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/**
 * Convert an AD Date object to BS date.
 * Fixes BUG-004, BUG-026: caller must wrap strings in new Date() before calling.
 */
export function adToBS(adDate: Date): BSDate {
  if (!(adDate instanceof Date) || isNaN(adDate.getTime())) {
    return { year: 2081, month: 1, day: 1 }; // safe fallback
  }

  // Total days from AD epoch
  const epochMs = AD_EPOCH.getTime();
  const inputMs = Date.UTC(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
  const epochRef  = Date.UTC(AD_EPOCH.getFullYear(), AD_EPOCH.getMonth(), AD_EPOCH.getDate());
  let totalDays = Math.floor((inputMs - epochRef) / 86400000);

  let bsYear = BS_START_YEAR;
  let bsMonth = 1;
  let bsDay = 1;

  // Walk through BS years
  while (totalDays > 0) {
    const yearIdx = bsYear - BS_START_YEAR;
    if (yearIdx >= BS_MONTH_DATA.length) break;
    const daysInYear = BS_MONTH_DATA[yearIdx].reduce((a, b) => a + b, 0);
    if (totalDays >= daysInYear) {
      totalDays -= daysInYear;
      bsYear++;
    } else {
      // Walk through months
      for (let m = 0; m < 12; m++) {
        const daysInMonth = BS_MONTH_DATA[yearIdx][m];
        if (totalDays >= daysInMonth) {
          totalDays -= daysInMonth;
          bsMonth = m + 2;
          if (bsMonth > 12) { bsMonth = 1; bsYear++; }
        } else {
          bsMonth = m + 1;
          bsDay = totalDays + 1;
          totalDays = 0;
          break;
        }
      }
    }
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

/**
 * Convert a BS date to AD Date.
 */
export function bsToAD(bsYear: number, bsMonth: number, bsDay: number): Date {
  let totalDays = 0;
  for (let y = BS_START_YEAR; y < bsYear; y++) {
    const idx = y - BS_START_YEAR;
    if (idx < BS_MONTH_DATA.length) {
      totalDays += BS_MONTH_DATA[idx].reduce((a, b) => a + b, 0);
    }
  }
  const yearIdx = bsYear - BS_START_YEAR;
  if (yearIdx < BS_MONTH_DATA.length) {
    for (let m = 0; m < bsMonth - 1; m++) {
      totalDays += BS_MONTH_DATA[yearIdx][m];
    }
  }
  totalDays += bsDay - 1;

  const result = new Date(AD_EPOCH);
  result.setDate(result.getDate() + totalDays);
  return result;
}

/**
 * Format a BSDate to ISO-like string "YYYY-MM-DD" in BS.
 */
export function formatBSDate(bs: BSDate): string {
  return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
}

/**
 * Format a BSDate to human-readable "DD MonthName YYYY B.S."
 */
export function formatBSDateLong(bs: BSDate, nepali = false): string {
  const months = nepali ? BS_MONTHS_NP : BS_MONTHS;
  return `${bs.day} ${months[bs.month - 1]} ${bs.year} B.S.`;
}

/**
 * Convert AD ISO string (YYYY-MM-DD) â†’ BS ISO string (YYYY-MM-DD).
 * Safe: returns "" on invalid input.
 * Fixes BUG-004, BUG-025, BUG-063, BUG-076.
 */
export function ADToBSString(adIso: string | null | undefined): string {
  if (!adIso) return "";
  try {
    const parts = adIso.split("T")[0].split("-");
    if (parts.length < 3) return "";
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(d.getTime())) return "";
    const bs = adToBS(d);
    return formatBSDate(bs);
  } catch {
    return "";
  }
}

/**
 * Convert AD ISO string â†’ BS long string "DD Month YYYY B.S."
 */
export function ADToBSLong(adIso: string | null | undefined, nepali = false): string {
  if (!adIso) return "";
  try {
    const parts = adIso.split("T")[0].split("-");
    if (parts.length < 3) return "";
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(d.getTime())) return "";
    const bs = adToBS(d);
    return formatBSDateLong(bs, nepali);
  } catch {
    return "";
  }
}

/**
 * Get today's date as AD ISO string.
 */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get today's BS date as ISO string "YYYY-MM-DD" (BS).
 */
export function getBSToday(): string {
  return ADToBSString(todayISO());
}

/**
 * Get today's BS date as long human-readable string.
 */
export function getBSTodayLong(): string {
  return ADToBSLong(todayISO());
}

/**
 * Get today as full datetime ISO string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Get BS fiscal year start for a given BS year (Baisakh 1).
 */
export function bsFiscalYearStart(bsYear: number): string {
  const adStart = bsToAD(bsYear, 1, 1);
  return adStart.toISOString().split("T")[0];
}

/**
 * Get BS fiscal year end for a given BS year (Chaitra last day).
 */
export function bsFiscalYearEnd(bsYear: number): string {
  const yearIdx = bsYear - BS_START_YEAR;
  const lastDay = yearIdx >= 0 && yearIdx < BS_MONTH_DATA.length
    ? BS_MONTH_DATA[yearIdx][11]
    : 30;
  const adEnd = bsToAD(bsYear, 12, lastDay);
  return adEnd.toISOString().split("T")[0];
}

/**
 * Parse BS ISO string "YYYY-MM-DD" and return BSDate.
 */
export function parseBSIso(bsIso: string): BSDate | null {
  const parts = bsIso.split("-");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * Format AD ISO for display: shows both BS and AD.
 * e.g. "15 Shrawan 2081 B.S. (2024-07-31)"
 */
export function formatDualDate(adIso: string | null | undefined): string {
  if (!adIso) return "-";
  const bsLong = ADToBSLong(adIso);
  return bsLong ? `${bsLong} (${adIso.split("T")[0]})` : adIso.split("T")[0];
}

/**
 * Get current Nepali fiscal year label like "2080-81".
 */
export function getCurrentFYLabel(): string {
  const today = todayISO();
  const bs = adToBS(new Date(today));
  // Nepali FY: Baisakh to Chaitra
  if (bs.month >= 1 && bs.month <= 12) {
    const startYear = bs.year;
    return `${startYear}-${String(startYear + 1).slice(2)}`;
  }
  return `${bs.year}-${String(bs.year + 1).slice(2)}`;
}
export const getNepaliMonths = () => ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

export const formatADToBS = (ad: string) => { try { return ADToBSString(ad); } catch { return ''; } };



