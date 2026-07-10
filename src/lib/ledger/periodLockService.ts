import type { SutraERPDatabase } from "../db";
import { isW1FlagEnabled } from "../../platform/flags/w1Registry";

export interface PeriodLockViolation {
  date: string;
  periodKey: string;
  message: string;
}

type PeriodLockRow = {
  periodKey?: string;
  lockedMonth?: string;
  isUnlocked?: boolean;
};

let cacheDbVersion = 0;

/** Normalize YYYY-M or YYYY-MM to canonical `${year}-${month}` (no zero-padded month). */
export function normalizePeriodKey(raw: string): string {
  const parts = raw.trim().split("-");
  if (parts.length < 2) return raw.trim();
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return raw.trim();
  return `${year}-${month}`;
}

export function periodKeyFromDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for period lock check: ${date}`);
  }
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function rowPeriodKey(row: PeriodLockRow): string | null {
  const raw = row.periodKey || row.lockedMonth;
  if (!raw) return null;
  return normalizePeriodKey(raw);
}

function isActiveLock(row: PeriodLockRow): boolean {
  return row.isUnlocked !== true;
}

export function invalidatePeriodLockCache(): void {
  cacheDbVersion += 1;
}

export function notePeriodLockDbUpgrade(): void {
  invalidatePeriodLockCache();
}

async function loadActiveLocks(db: SutraERPDatabase): Promise<PeriodLockRow[]> {
  if (!db.tables.some((t) => t.name === "periodLocks")) {
    return [];
  }
  const rows: PeriodLockRow[] = await db.table("periodLocks").toArray();
  return rows.filter(isActiveLock);
}

export async function isDateLocked(date: string, db: SutraERPDatabase): Promise<boolean> {
  if (!isW1FlagEnabled("W1_PERIOD_LOCK_ENFORCE")) {
    return false;
  }
  const key = periodKeyFromDate(date);
  const locks = await loadActiveLocks(db);
  return locks.some((row) => rowPeriodKey(row) === key);
}

export async function checkPeriodLock(
  date: string,
  db: SutraERPDatabase,
): Promise<PeriodLockViolation | null> {
  const locked = await isDateLocked(date, db);
  if (!locked) return null;
  const periodKey = periodKeyFromDate(date);
  return {
    date,
    periodKey,
    message: `Period is locked for date ${date}. Unlock the period before posting.`,
  };
}

/** @deprecated Use enforcePostingPeriodLock from postingPeriodGuard.ts */
export async function assertPeriodUnlockedForPosting(
  date: string,
  db: SutraERPDatabase,
): Promise<void> {
  const { enforcePostingPeriodLock } = await import("./postingPeriodGuard");
  await enforcePostingPeriodLock(date, db);
}

/** @deprecated Use enforcePostingPeriodLock from postingPeriodGuard.ts */
export async function enforcePeriodLockForPosting(
  date: string,
  db: SutraERPDatabase,
): Promise<void> {
  const { enforcePostingPeriodLock } = await import("./postingPeriodGuard");
  await enforcePostingPeriodLock(date, db);
}

export function getPeriodLockCacheVersion(): number {
  return cacheDbVersion;
}
