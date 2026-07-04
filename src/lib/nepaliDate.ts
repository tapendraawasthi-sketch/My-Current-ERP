/**
 * nepaliDate.ts  (src/lib/nepaliDate.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Extended BS calendar utilities for Nepal ERP.
 * Depends on: nepali-date-converter  (already in your stack)
 *
 * Complements src/utils/nepaliDate.ts — import the base helpers from there;
 * import fiscal-year / formatting helpers from here.
 */

import NepaliDate from "nepali-date-converter";

function toLocalADString(d: Date): string {
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseLocalADString(s: string): Date {
  const [y, m, d] = s.split(/[-/]/).map(Number);
  return new Date(y, m - 1, d);
}

const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const NEPALI_DAYS = [
  "Aaitabar",
  "Sombar",
  "Mangalbar",
  "Budhabar",
  "Bihibar",
  "Sukrabar",
  "Sanibar",
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
    return nd.getYear() === year && nd.getMonth() === month - 1 && nd.getDate() === day;
  } catch {
    return false;
  }
}

export function adToBS(date: Date): {
  year: number;
  month: number;
  day: number;
  monthName: string;
} {
  if (isNaN(date.getTime())) throw new Error("Invalid AD date");
  const nd = new NepaliDate(date);
  const year = nd.getYear();
  const month = nd.getMonth() + 1;
  const day = nd.getDate();
  return {
    year,
    month,
    day,
    monthName: NEPALI_MONTHS[nd.getMonth()],
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
  if (typeof bsDate === "string") {
    const parts = bsDate.replace(/-/g, "/").split("/");
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

export function todayBS(): {
  year: number;
  month: number;
  day: number;
  monthName: string;
  dayName: string;
} {
  const nd = new NepaliDate();
  return {
    year: nd.getYear(),
    month: nd.getMonth() + 1,
    day: nd.getDate(),
    monthName: NEPALI_MONTHS[nd.getMonth()],
    dayName: NEPALI_DAYS[nd.getDay()],
  };
}

export function getNepaliMonths(): string[] {
  return [...NEPALI_MONTHS];
}

export function getFiscalYearFromBS(
  bsDate: { year: number; month: number; day: number } | string,
): { startYear: number; endYear: number; label: string } {
  let y: number, m: number;
  if (typeof bsDate === "string") {
    const parts = bsDate.replace(/-/g, "/").split("/");
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else {
    y = bsDate.year;
    m = bsDate.month;
  }

  if (m >= 4) {
    // Shrawan or later
    return {
      startYear: y,
      endYear: y + 1,
      label: `${y}/${String(y + 1).slice(-2)}`,
    };
  } else {
    return {
      startYear: y - 1,
      endYear: y,
      label: `${y - 1}/${String(y).slice(-2)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Month metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface BSMonthInfo {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  english: string;
  nepali: string;
  /** Which fiscal quarter this month belongs to (FY starts Shrawan = month 4) */
  fiscalQuarter: 1 | 2 | 3 | 4;
}

const BS_MONTHS: BSMonthInfo[] = [
  { number: 1, english: "Baisakh", nepali: "बैशाख", fiscalQuarter: 4 },
  { number: 2, english: "Jestha", nepali: "जेठ", fiscalQuarter: 4 },
  { number: 3, english: "Ashad", nepali: "असार", fiscalQuarter: 4 },
  { number: 4, english: "Shrawan", nepali: "श्रावण", fiscalQuarter: 1 },
  { number: 5, english: "Bhadra", nepali: "भाद्र", fiscalQuarter: 1 },
  { number: 6, english: "Ashwin", nepali: "आश्विन", fiscalQuarter: 1 },
  { number: 7, english: "Kartik", nepali: "कार्तिक", fiscalQuarter: 2 },
  { number: 8, english: "Mangsir", nepali: "मंसिर", fiscalQuarter: 2 },
  { number: 9, english: "Poush", nepali: "पुष", fiscalQuarter: 2 },
  { number: 10, english: "Magh", nepali: "माघ", fiscalQuarter: 3 },
  { number: 11, english: "Falgun", nepali: "फाल्गुन", fiscalQuarter: 3 },
  { number: 12, english: "Chaitra", nepali: "चैत्र", fiscalQuarter: 3 },
];

export function getBSMonthName(monthNo: number): BSMonthInfo {
  if (monthNo < 1 || monthNo > 12) throw new Error(`Invalid month number: ${monthNo}`);
  return BS_MONTHS[monthNo - 1];
}

export function getBSMonths(): BSMonthInfo[] {
  return [...BS_MONTHS];
}

// ─────────────────────────────────────────────────────────────────────────────
// Nepali digit conversion
// ─────────────────────────────────────────────────────────────────────────────

const NEPALI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toNepaliDigits(n: number | string): string {
  return String(n)
    .split("")
    .map((ch) => (ch >= "0" && ch <= "9" ? NEPALI_DIGITS[parseInt(ch)] : ch))
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// BS Calendar data  (days per month)  2070 – 2090 BS
// ─────────────────────────────────────────────────────────────────────────────

export const BS_CALENDAR: Record<number, number[]> = {
  2070: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2073: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2074: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2077: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2081: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

export function getDaysInBSMonthFull(year: number, month: number): number {
  if (BS_CALENDAR[year]) return BS_CALENDAR[year][month - 1];
  for (let d = 32; d >= 28; d--) {
    try {
      new NepaliDate(year, month - 1, d);
      return d;
    } catch {
      continue;
    }
  }
  return 30;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiscal year helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getCurrentFiscalYearBS(): string {
  const nd = new NepaliDate();
  const year = nd.getYear();
  const month = nd.getMonth() + 1; // 1-based

  if (month >= 4) {
    return `${year}/${String(year + 1).slice(-2)}`;
  } else {
    return `${year - 1}/${String(year).slice(-2)}`;
  }
}

export function parseFYLabel(fyLabel: string): { startYear: number; endYear: number } {
  const parts = fyLabel.split("/");
  if (parts.length !== 2) throw new Error(`Invalid fiscal year label: "${fyLabel}"`);
  const startYear = parseInt(parts[0], 10);
  const shortEnd = parseInt(parts[1], 10);
  const endYear = shortEnd > 100 ? shortEnd : Math.floor(startYear / 100) * 100 + shortEnd;
  return { startYear, endYear };
}

export function getFiscalYearDateRange(fyLabel: string): {
  startDate: string; // YYYY-MM-DD (AD)
  endDate: string; // YYYY-MM-DD (AD)
  startDateBS: string;
  endDateBS: string;
} {
  const { startYear, endYear } = parseFYLabel(fyLabel);

  const fyStartBS = { year: startYear, month: 4, day: 1 };
  const lastDayAshad = getDaysInBSMonthFull(endYear, 3);
  const fyEndBS = { year: endYear, month: 3, day: lastDayAshad };

  const startAD = bsToAD(fyStartBS.year, fyStartBS.month, fyStartBS.day);
  const endAD = bsToAD(fyEndBS.year, fyEndBS.month, fyEndBS.day);

  const fmt = (d: Date) => toLocalADString(d);

  return {
    startDate: fmt(startAD),
    endDate: fmt(endAD),
    startDateBS: `${startYear}-04-01`,
    endDateBS: `${endYear}-03-${String(lastDayAshad).padStart(2, "0")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiscal quarter
// ─────────────────────────────────────────────────────────────────────────────

export interface FiscalQuarterInfo {
  quarter: 1 | 2 | 3 | 4;
  quarterLabel: string;
  startDate: string;
  endDate: string;
  startDateBS: string;
  endDateBS: string;
}

export function getNepaliFiscalQuarter(
  bsDate: string | { year: number; month: number; day: number },
): FiscalQuarterInfo {
  let year: number, month: number;

  if (typeof bsDate === "string") {
    const parts = bsDate.split("-").map(Number);
    year = parts[0];
    month = parts[1];
  } else {
    year = bsDate.year;
    month = bsDate.month;
  }

  type Q = 1 | 2 | 3 | 4;
  const quarterMap: Record<number, Q> = {
    4: 1,
    5: 1,
    6: 1,
    7: 2,
    8: 2,
    9: 2,
    10: 3,
    11: 3,
    12: 3,
    1: 4,
    2: 4,
    3: 4,
  };

  const quarter: Q = quarterMap[month];
  const fyStartYear = month >= 4 ? year : year - 1;

  const quarterBounds: Record<Q, { startMonth: number; endMonth: number; label: string }> = {
    1: { startMonth: 4, endMonth: 6, label: "Q1 (Shrawan – Ashwin)" },
    2: { startMonth: 7, endMonth: 9, label: "Q2 (Kartik – Poush)" },
    3: { startMonth: 10, endMonth: 12, label: "Q3 (Magh – Chaitra)" },
    4: { startMonth: 1, endMonth: 3, label: "Q4 (Baisakh – Ashad)" },
  };

  const bounds = quarterBounds[quarter];
  const qStartYear = quarter === 4 ? fyStartYear + 1 : fyStartYear;
  const qEndYear = qStartYear;

  const startDayBS = 1;
  const endDayBS = getDaysInBSMonthFull(qEndYear, bounds.endMonth);

  const startAD = bsToAD(qStartYear, bounds.startMonth, 1);
  const endAD = bsToAD(qEndYear, bounds.endMonth, endDayBS);

  const fmt = (d: Date) => toLocalADString(d);
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    quarter,
    quarterLabel: bounds.label,
    startDate: fmt(startAD),
    endDate: fmt(endAD),
    startDateBS: `${qStartYear}-${pad(bounds.startMonth)}-${pad(startDayBS)}`,
    endDateBS: `${qEndYear}-${pad(bounds.endMonth)}-${pad(endDayBS)}`,
  };
}

export function getBSMonthDateRange(
  fyLabel: string,
  bsMonth: number,
): { startDate: string; endDate: string; startDateBS: string; endDateBS: string } {
  const { startYear, endYear } = parseFYLabel(fyLabel);
  const bsYear = bsMonth >= 4 ? startYear : endYear;

  const lastDay = getDaysInBSMonthFull(bsYear, bsMonth);
  const startAD = bsToAD(bsYear, bsMonth, 1);
  const endAD = bsToAD(bsYear, bsMonth, lastDay);

  const fmt = (d: Date) => toLocalADString(d);
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    startDate: fmt(startAD),
    endDate: fmt(endAD),
    startDateBS: `${bsYear}-${pad(bsMonth)}-01`,
    endDateBS: `${bsYear}-${pad(bsMonth)}-${pad(lastDay)}`,
  };
}

export function getFiscalYearMonths(
  fyLabel: string,
): Array<BSMonthInfo & { dateRange: ReturnType<typeof getBSMonthDateRange> }> {
  const fyOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  return fyOrder.map((m) => ({
    ...getBSMonthName(m),
    dateRange: getBSMonthDateRange(fyLabel, m),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────────────────────────────────────

type BSDateFormat =
  "YYYY-MM-DD" | "YYYY/MM/DD" | "DD MMMM YYYY" | "DD/MM/YYYY" | "NEPALI" | "SHORT" | "ISO";

export function formatBSDate(
  adDateParam: string | Date,
  format: BSDateFormat = "YYYY/MM/DD",
): string {
  const adDate =
    typeof adDateParam === "string"
      ? adDateParam.includes("T")
        ? new Date(adDateParam)
        : parseLocalADString(adDateParam)
      : adDateParam;

  if (isNaN(adDate.getTime())) return "";

  const bs = adToBS(adDate);
  const { year, month, day } = bs;
  const monthInfo = getBSMonthName(month);
  const pad = (n: number) => String(n).padStart(2, "0");

  switch (format) {
    case "YYYY-MM-DD":
    case "ISO":
      return `${year}-${pad(month)}-${pad(day)}`;

    case "YYYY/MM/DD":
      return `${year}/${pad(month)}/${pad(day)}`;

    case "DD MMMM YYYY":
      return `${day} ${monthInfo.english} ${year}`;

    case "DD/MM/YYYY":
      return `${pad(day)}/${pad(month)}/${year}`;

    case "NEPALI":
      return `${monthInfo.nepali} ${toNepaliDigits(day)}, ${toNepaliDigits(year)}`;

    case "SHORT":
      return `${pad(day)} ${monthInfo.english.slice(0, 3)} ${year}`;

    default:
      return `${year}/${pad(month)}/${pad(day)}`;
  }
}

export function formatBSObject(
  bs: { year: number; month: number; day: number },
  format: BSDateFormat = "YYYY-MM-DD",
): string {
  const { year, month, day } = bs;
  const monthInfo = getBSMonthName(month);
  const pad = (n: number) => String(n).padStart(2, "0");

  switch (format) {
    case "YYYY-MM-DD":
    case "ISO":
      return `${year}-${pad(month)}-${pad(day)}`;
    case "YYYY/MM/DD":
      return `${year}/${pad(month)}/${pad(day)}`;
    case "DD MMMM YYYY":
      return `${day} ${monthInfo.english} ${year}`;
    case "DD/MM/YYYY":
      return `${pad(day)}/${pad(month)}/${year}`;
    case "NEPALI":
      return `${monthInfo.nepali} ${toNepaliDigits(day)}, ${toNepaliDigits(year)}`;
    case "SHORT":
      return `${pad(day)} ${monthInfo.english.slice(0, 3)} ${year}`;
    default:
      return `${year}-${pad(month)}-${pad(day)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy backward compatibility helpers
// ─────────────────────────────────────────────────────────────────────────────

export function ADToBSString(adDateStr: string): string {
  if (!adDateStr) return "";
  return formatBSDate(adDateStr, "YYYY/MM/DD");
}

export function BSToADString(bsDateStr: string): string {
  if (!bsDateStr) return "";
  try {
    const parts = bsDateStr.split(/[-/]/);
    if (parts.length !== 3) return "";
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return "";
    const ad = bsToAD(year, month, day);
    return toLocalADString(ad);
  } catch {
    return "";
  }
}

export function getBSToday(): string {
  return ADToBSString(toLocalADString(new Date()));
}

export function getBSTodayLong(): string {
  const bs = getBSToday();
  if (!bs) return "";
  const parts = bs.split("/");
  if (parts.length !== 3) return bs;
  const month = parseInt(parts[1], 10);
  const mName = getBSMonthName(month).english;
  return `${parseInt(parts[2], 10)} ${mName} ${parts[0]}`;
}

export function formatADToBS(adDateStr: string): string {
  return ADToBSString(adDateStr);
}

export interface BSDay {
  day: number;
  month: number;
  year: number;
  adDateStr: string;
  bsDateStr: string;
  isCurrentMonth: boolean;
}

export function getBSMonthCalendarGrid(bsYear: number, bsMonth: number): BSDay[] {
  const calData = BS_CALENDAR[bsYear];
  if (!calData) return [];

  const daysInMonth = calData[bsMonth - 1];
  const firstDayAD = bsToAD(bsYear, bsMonth, 1);
  const startDow = firstDayAD.getDay(); // 0=Sun

  const days: BSDay[] = [];

  let prevYear = bsYear;
  let prevMonth = bsMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  const prevCalData = BS_CALENDAR[prevYear];
  const daysInPrevMonth = prevCalData ? prevCalData[prevMonth - 1] : 30;

  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const adDate = bsToAD(prevYear, prevMonth, d);
    days.push({
      day: d,
      month: prevMonth,
      year: prevYear,
      adDateStr: toLocalADString(adDate),
      bsDateStr: `${prevYear}/${String(prevMonth).padStart(2, "0")}/${String(d).padStart(2, "0")}`,
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const adDate = bsToAD(bsYear, bsMonth, d);
    days.push({
      day: d,
      month: bsMonth,
      year: bsYear,
      adDateStr: toLocalADString(adDate),
      bsDateStr: `${bsYear}/${String(bsMonth).padStart(2, "0")}/${String(d).padStart(2, "0")}`,
      isCurrentMonth: true,
    });
  }

  const remaining = 42 - days.length;
  let nextYear = bsYear;
  let nextMonth = bsMonth + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  for (let d = 1; d <= remaining; d++) {
    const adDate = bsToAD(nextYear, nextMonth, d);
    days.push({
      day: d,
      month: nextMonth,
      year: nextYear,
      adDateStr: toLocalADString(adDate),
      bsDateStr: `${nextYear}/${String(nextMonth).padStart(2, "0")}/${String(d).padStart(2, "0")}`,
      isCurrentMonth: false,
    });
  }

  return days;
}

export const getBSMonthRange = () => [];
export const getQuarterRange = () => [];
export const formatBSToAD = () => "";

// ─────────────────────────────────────────────────────────────────────────────
// Year-end closing helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface YearEndClosingPreview {
  fyLabel: string;
  closingDateAD: string;
  totalIncome: number;
  totalExpense: number;
  netProfitLoss: number;
  isProfit: boolean;
  journalEntriesCount: number;
  description: string;
}

export function buildYearEndClosingPreview(params: {
  fyLabel: string;
  totalIncome: number;
  totalExpense: number;
  retainedEarningsAccount: string;
  incomeSummaryAccount: string;
  incomeAccountCount: number;
  expenseAccountCount: number;
}): YearEndClosingPreview {
  const { endDate } = getFiscalYearDateRange(params.fyLabel);
  const net = params.totalIncome - params.totalExpense;
  const journalEntriesCount = params.incomeAccountCount + params.expenseAccountCount + 1;

  return {
    fyLabel: params.fyLabel,
    closingDateAD: endDate,
    totalIncome: params.totalIncome,
    totalExpense: params.totalExpense,
    netProfitLoss: Math.abs(net),
    isProfit: net >= 0,
    journalEntriesCount,
    description:
      `Closing FY ${params.fyLabel}: This will create ${journalEntriesCount} journal entries ` +
      `transferring net ${net >= 0 ? "profit" : "loss"} of ` +
      `Rs. ${Math.abs(net).toLocaleString("en-IN")} to ${params.retainedEarningsAccount}.`,
  };
}
