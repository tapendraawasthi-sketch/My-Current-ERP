import { getDB } from "@/lib/db";

export interface PeriodLockViolation {
  date: string;
  periodKey: string;
  message: string;
}

function periodKeyFromDate(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

export async function isDateLocked(date: string): Promise<boolean> {
  try {
    const db = getDB();
    if (!db.tables.some((t) => t.name === "periodLocks")) return false;
    const key = periodKeyFromDate(date);
    const locks: Array<{ periodKey?: string }> = await db.table("periodLocks").toArray();
    return locks.some((l) => l.periodKey === key);
  } catch {
    return false;
  }
}

export async function checkPeriodLock(date: string): Promise<PeriodLockViolation | null> {
  const locked = await isDateLocked(date);
  if (!locked) return null;
  const periodKey = periodKeyFromDate(date);
  return {
    date,
    periodKey,
    message: `Period is locked for date ${date}`,
  };
}
