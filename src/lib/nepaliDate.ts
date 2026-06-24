// src/lib/nepaliDate.ts

// Nepali calendar data: BS year -> [days in each month]
const BS_CALENDAR: Record<number, number[]> = {
  2070: [31,32,31,32,31,30,30,30,29,30,29,31],
  2071: [31,31,32,31,31,31,30,29,30,29,30,30],
  2072: [31,31,32,32,31,30,30,29,30,29,30,30],
  2073: [31,32,31,32,31,30,30,30,29,29,30,31],
  2074: [30,32,31,32,31,30,30,30,29,30,29,31],
  2075: [31,31,32,31,31,31,30,29,30,29,30,30],
  2076: [31,31,32,32,31,30,30,29,30,29,30,30],
  2077: [31,32,31,32,31,30,30,30,29,30,29,31],
  2078: [31,31,31,32,31,31,29,30,30,29,29,31],
  2079: [31,31,32,31,31,31,30,29,30,29,30,30],
  2080: [31,31,32,32,31,30,30,29,30,29,30,30],
  2081: [31,32,31,32,31,30,30,30,29,30,29,31],
  2082: [30,32,31,32,31,30,30,30,29,30,29,31],
  2083: [31,31,32,31,31,31,30,29,30,29,30,30],
  2084: [31,31,32,32,31,30,30,29,30,29,30,30],
  2085: [31,32,31,32,31,30,30,30,29,30,29,31],
  2086: [31,31,31,32,31,31,30,29,30,29,30,30],
};

// AD date when BS 2070/01/01 starts
const EPOCH_AD = new Date(2013, 3, 14); // April 14, 2013

function getDaysFromEpoch(date: Date): number {
  const utc1 = Date.UTC(EPOCH_AD.getFullYear(), EPOCH_AD.getMonth(), EPOCH_AD.getDate());
  const utc2 = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((utc2 - utc1) / 86400000);
}

interface BSDate {
  year: number;
  month: number;
  day: number;
}

export function adToBS(adDate: Date): BSDate {
  let days = getDaysFromEpoch(adDate);
  let year = 2070;
  let month = 1;
  let day = 1;

  if (days < 0) {
    // Return a fallback for dates before epoch
    return { year: 2070, month: 1, day: 1 };
  }

  // Walk through BS calendar
  outer: for (const [y, months] of Object.entries(BS_CALENDAR)) {
    const yr = Number(y);
    for (let m = 0; m < 12; m++) {
      const daysInMonth = months[m];
      if (days < daysInMonth) {
        year = yr;
        month = m + 1;
        day = days + 1;
        break outer;
      }
      days -= daysInMonth;
    }
  }

  return { year, month, day };
}

export function bsToAD(year: number, month: number, day: number): Date {
  let days = 0;
  for (const [y, months] of Object.entries(BS_CALENDAR)) {
    const yr = Number(y);
    if (yr > year) break;
    if (yr === year) {
      for (let m = 0; m < month - 1; m++) {
        days += months[m];
      }
      days += day - 1;
      break;
    }
    for (const d of months) days += d;
  }
  const result = new Date(EPOCH_AD);
  result.setDate(result.getDate() + days);
  return result;
}

export function ADToBSString(adDateStr: string): string {
  if (!adDateStr) return "";
  try {
    const d = new Date(adDateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    const bs = adToBS(d);
    return `${bs.year}/${String(bs.month).padStart(2, "0")}/${String(bs.day).padStart(2, "0")}`;
  } catch {
    return "";
  }
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
    return ad.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function getBSToday(): string {
  return ADToBSString(new Date().toISOString().split("T")[0]);
}

export function getBSTodayLong(): string {
  const bs = getBSToday();
  if (!bs) return "";
  const parts = bs.split("/");
  if (parts.length !== 3) return bs;
  const months = [
    "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
    "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
  ];
  const month = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${months[month] || ""} ${parts[0]}`;
}

export function formatADToBS(adDateStr: string): string {
  return ADToBSString(adDateStr);
}

export function formatBSDate(adDate: Date): string {
  try {
    const bs = adToBS(adDate);
    return `${bs.year}/${String(bs.month).padStart(2, "0")}/${String(bs.day).padStart(2, "0")}`;
  } catch {
    return "";
  }
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

  // Previous month padding
  let prevYear = bsYear;
  let prevMonth = bsMonth - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear--; }
  const prevCalData = BS_CALENDAR[prevYear];
  const daysInPrevMonth = prevCalData ? prevCalData[prevMonth - 1] : 30;

  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const adDate = bsToAD(prevYear, prevMonth, d);
    days.push({
      day: d, month: prevMonth, year: prevYear,
      adDateStr: adDate.toISOString().split("T")[0],
      bsDateStr: `${prevYear}/${String(prevMonth).padStart(2,"0")}/${String(d).padStart(2,"0")}`,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const adDate = bsToAD(bsYear, bsMonth, d);
    days.push({
      day: d, month: bsMonth, year: bsYear,
      adDateStr: adDate.toISOString().split("T")[0],
      bsDateStr: `${bsYear}/${String(bsMonth).padStart(2,"0")}/${String(d).padStart(2,"0")}`,
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill 6 rows (42 cells)
  const remaining = 42 - days.length;
  let nextYear = bsYear;
  let nextMonth = bsMonth + 1;
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }

  for (let d = 1; d <= remaining; d++) {
    const adDate = bsToAD(nextYear, nextMonth, d);
    days.push({
      day: d, month: nextMonth, year: nextYear,
      adDateStr: adDate.toISOString().split("T")[0],
      bsDateStr: `${nextYear}/${String(nextMonth).padStart(2,"0")}/${String(d).padStart(2,"0")}`,
      isCurrentMonth: false,
    });
  }

  return days;
}
