import { getDB } from "@/lib/db";
import {
  checkPeriodLock as checkPeriodLockWithDb,
  isDateLocked as isDateLockedWithDb,
  type PeriodLockViolation,
} from "@/lib/ledger/periodLockService";

export type { PeriodLockViolation };

/** Domain-engine entry: resolves Dexie from getDB(). */
export async function isDateLocked(date: string): Promise<boolean> {
  return isDateLockedWithDb(date, getDB());
}

/** Domain-engine entry: resolves Dexie from getDB(). */
export async function checkPeriodLock(date: string): Promise<PeriodLockViolation | null> {
  return checkPeriodLockWithDb(date, getDB());
}

export {
  assertPeriodUnlockedForPosting,
  enforcePeriodLockForPosting,
  invalidatePeriodLockCache,
  normalizePeriodKey,
  periodKeyFromDate,
} from "@/lib/ledger/periodLockService";
