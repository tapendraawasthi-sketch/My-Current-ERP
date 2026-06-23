// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import NepaliDate from "nepali-date-converter";
import { ReportPeriodPreset } from "./types";
import { NEPALI_MONTHS_EN, NEPALI_MONTHS_BS } from "./constants";

const BS_MONTH_DAYS = [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31];

export interface BSDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  bsDateStr: string;
  adDateStr: string;
}

/**
 * Standard AD date string (YYYY-MM-DD) to BS date string (YYYY/MM/DD)
 */
export function formatADToBS(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const jsDate = new Date(dateStr);
    if (isNaN(jsDate.getTime())) return dateStr;
    const nepDate = new NepaliDate(jsDate);
    return nepDate.format("YYYY/MM/DD");
  } catch (err) {
    console.error("AD to BS error:", err);
    return dateStr;
  }
}

/**
 * Converts BS date string (YYYY/MM/DD) to AD date string (YYYY-MM-DD)
 */
export function formatBSToAD(bsDateStr: string): string {
  if (!bsDateStr) return "";
  try {
    const clean = bsDateStr.replace(/-/g, "/");
    const [yStr, mStr, dStr] = clean.split("/");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1; // nepali-date-converter month is 0-indexed
    const d = parseInt(dStr, 10);

    const nepDate = new NepaliDate(y, m, d);
    const jsDate = nepDate.toJsDate();

    const adYear = jsDate.getFullYear();
    const adMonth = String(jsDate.getMonth() + 1).padStart(2, "0");
    const adDay = String(jsDate.getDate()).padStart(2, "0");
    return `${adYear}-${adMonth}-${adDay}`;
  } catch (err) {
    console.error("BS to AD error:", err);
    return bsDateStr;
  }
}

/**
 * Renders a human-readable BS date label.
 * e.g., "2083/04/15" -> "15 Shrawan 2083" or "१५ साउन २०८३"
 */
export function formatBSDate(bsDateStr: string, lang: "en" | "np" = "en"): string {
  if (!bsDateStr) return "";
  const clean = bsDateStr.replace(/-/g, "/");
  const parts = clean.split("/");
  if (parts.length !== 3) return bsDateStr;

  const y = parts[0];
  const mIndex = parseInt(parts[1], 10) - 1;
  const d = parts[2];

  if (mIndex < 0 || mIndex >= 12) return bsDateStr;

  if (lang === "np") {
    const monthNp = NEPALI_MONTHS_BS[mIndex];
    return `${parseInt(d, 10)} ${monthNp} ${y}`;
  } else {
    const monthEn = NEPALI_MONTHS_EN[mIndex];
    return `${parseInt(d, 10)} ${monthEn} ${y}`;
  }
}

/**
 * Increments or decrements days on a Bikram Sambat date string.
 */
export function addBSDays(bsDateStr: string, days: number): string {
  if (!bsDateStr) return "";
  try {
    const adDateStr = formatBSToAD(bsDateStr);
    const adDate = new Date(adDateStr);
    adDate.setDate(adDate.getDate() + days);

    const newAdStr = adDate.toISOString().split("T")[0];
    return formatADToBS(newAdStr);
  } catch (err) {
    return bsDateStr;
  }
}

/**
 * Returns the bounds (start, end) of a specific BS month (standard YYYY/MM/DD).
 */
export function getBSMonthRange(bsYear: number, bsMonth: number): { start: string; end: string } {
  const mVal = Math.max(1, Math.min(12, bsMonth));
  const maxDay = BS_MONTH_DAYS[mVal - 1];

  const mStr = String(mVal).padStart(2, "0");
  return {
    start: `${bsYear}/${mStr}/01`,
    end: `${bsYear}/${mStr}/${String(maxDay).padStart(2, "0")}`,
  };
}

/**
 * Splits BS months into quarters (Q1: Baisakh-Ashard, Q2: Shrawan-Ashwin, Q3: Kartik-Poush, Q4: Magh-Chaitra).
 */
export function getQuarterRange(
  bsYear: number,
  quarter: 1 | 2 | 3 | 4,
): { start: string; end: string } {
  switch (quarter) {
    case 1: // Baisakh 1 to Ashar end
      return {
        start: `${bsYear}/01/01`,
        end: `${bsYear}/03/${String(BS_MONTH_DAYS[2]).padStart(2, "0")}`,
      };
    case 2: // Shrawan 1 to Ashwin end
      return {
        start: `${bsYear}/04/01`,
        end: `${bsYear}/06/${String(BS_MONTH_DAYS[5]).padStart(2, "0")}`,
      };
    case 3: // Kartik 1 to Poush end
      return {
        start: `${bsYear}/07/01`,
        end: `${bsYear}/09/${String(BS_MONTH_DAYS[8]).padStart(2, "0")}`,
      };
    case 4: // Magh 1 to Chaitra end
      return {
        start: `${bsYear}/10/01`,
        end: `${bsYear}/12/${String(BS_MONTH_DAYS[11]).padStart(2, "0")}`,
      };
    default:
      return { start: `${bsYear}/01/01`, end: `${bsYear}/12/30` };
  }
}

/**
 * Generates active fiscal year label, e.g. "2083/84" based on AD date.
 */
export function fiscalYearFromAD(adDateStr: string): string {
  if (!adDateStr) return "2083/84";
  const bsDate = formatADToBS(adDateStr);
  const parts = bsDate.split("/");
  if (parts.length !== 3) return "2083/84";

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);

  // Fiscal year in Nepal starts Shrawan (Month 4)
  if (m >= 4) {
    const nextYShort = String(y + 1).slice(-2);
    return `${y}/${nextYShort}`;
  } else {
    const lastYShort = String(y).slice(-2);
    return `${y - 1}/${lastYShort}`;
  }
}

/**
 * Yields human-friendly labels for dates in filters.
 */
export function getPeriodLabel(
  startDate: string,
  endDate: string,
  preset: ReportPeriodPreset,
): string {
  const bsStart = formatADToBS(startDate);
  const bsEnd = formatADToBS(endDate);

  const startParts = bsStart.split("/");
  const endParts = bsEnd.split("/");

  if (preset === ReportPeriodPreset.MONTH && startParts.length === 3 && endParts.length === 3) {
    const mIndex = parseInt(startParts[1], 10) - 1;
    const year = startParts[0];
    const monthEn = NEPALI_MONTHS_EN[mIndex];
    return `${monthEn} ${year}`;
  }

  switch (preset) {
    case ReportPeriodPreset.TODAY:
      return `Today (${formatBSDate(bsStart)})`;
    case ReportPeriodPreset.WEEK:
      return `This Week (${formatBSDate(bsStart)} to ${formatBSDate(bsEnd)})`;
    case ReportPeriodPreset.MONTH:
      return `This Month (${formatBSDate(bsStart)} to ${formatBSDate(bsEnd)})`;
    case ReportPeriodPreset.QUARTER:
      return `Current Quarter (${formatBSDate(bsStart)} to ${formatBSDate(bsEnd)})`;
    case ReportPeriodPreset.FY:
      return `Fiscal Year (FY ${fiscalYearFromAD(startDate)})`;
    case ReportPeriodPreset.CUSTOM:
    default:
      return `${formatBSDate(bsStart)} to ${formatBSDate(bsEnd)}`;
  }
}

export function validateTransactionDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

export function formatBSEnglish(date: Date): string {
  const adStr = date.toISOString().split("T")[0];
  const bsStr = formatADToBS(adStr);
  return formatBSDate(bsStr, "en");
}

export function formatBSNepali(date: Date): string {
  const adStr = date.toISOString().split("T")[0];
  const bsStr = formatADToBS(adStr);
  return formatBSDate(bsStr, "np");
}

/**
 * Generates active BS calendar grid (typically 42 cells)
 */
export function getBSMonthCalendarGrid(year: number, month: number): BSDay[] {
  const range = getBSMonthRange(year, month);
  const startDayAdStr = formatBSToAD(range.start);
  const startDayJs = new Date(startDayAdStr);
  const startDayOfWeek = startDayJs.getDay(); // 0 = Sunday, 1 = Monday...

  const days: BSDay[] = [];

  // Previous month padding
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthRange = getBSMonthRange(prevYear, prevMonth);
  const prevMonthMaxDay = parseInt(prevMonthRange.end.split("/")[2], 10);

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dVal = prevMonthMaxDay - i;
    const dStr = String(dVal).padStart(2, "0");
    const mStr = String(prevMonth).padStart(2, "0");
    const bsDateStr = `${prevYear}/${mStr}/${dStr}`;
    days.push({
      day: dVal,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      bsDateStr,
      adDateStr: formatBSToAD(bsDateStr),
    });
  }

  // Current month days
  const currentMonthMaxDay = parseInt(range.end.split("/")[2], 10);
  for (let d = 1; d <= currentMonthMaxDay; d++) {
    const dStr = String(d).padStart(2, "0");
    const mStr = String(month).padStart(2, "0");
    const bsDateStr = `${year}/${mStr}/${dStr}`;
    days.push({
      day: d,
      month,
      year: year,
      isCurrentMonth: true,
      bsDateStr,
      adDateStr: formatBSToAD(bsDateStr),
    });
  }

  // Next month padding to fill standard 42-cell grid
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }
  const cellsLeft = 42 - days.length;
  for (let d = 1; d <= cellsLeft; d++) {
    const dStr = String(d).padStart(2, "0");
    const mStr = String(nextMonth).padStart(2, "0");
    const bsDateStr = `${nextYear}/${mStr}/${dStr}`;
    days.push({
      day: d,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      bsDateStr,
      adDateStr: formatBSToAD(bsDateStr),
    });
  }

  return days;
}

/**
 * State/Binding value helper hook for BS Web Date Pickers
 */
export function useBSDatePickerValue(initialAdDateStr: string = "") {
  const [adDate, setAdDate] = useState<string>(
    initialAdDateStr || new Date().toISOString().split("T")[0],
  );

  const bsDate = useMemo(() => formatADToBS(adDate), [adDate]);

  const setBSDate = (newBSDateStr: string) => {
    const newAD = formatBSToAD(newBSDateStr);
    setAdDate(newAD);
  };

  return {
    adDate,
    bsDate,
    setAdDate,
    setBSDate,
  };
}

export function getBSToday(): string {
  const adString = new Date().toISOString().split("T")[0];
  return formatADToBS(adString);
}

export function getBSTodayLong(): string {
  const bsToday = getBSToday();
  return formatBSDate(bsToday, "en");
}

export function convertADtoBS(adDate: string): string {
  return formatADToBS(adDate);
}

export function convertBStoAD(bsDate: string): string {
  return formatBSToAD(bsDate);
}

export function ADToBSString(adDate: string): string {
  return formatADToBS(adDate);
}

export function BSToADString(bsDate: string): string {
  return formatBSToAD(bsDate);
}

export function formatDateNepal(date: Date): string {
  return `${String(date.getDate()).padStart(2,"0")}-${String(date.getMonth()+1).padStart(2,"0")}-${date.getFullYear()}`;
}

export function getDaysInNepaliMonth(year: number, month: number): number {
  return 30; // Stub implementation
}
