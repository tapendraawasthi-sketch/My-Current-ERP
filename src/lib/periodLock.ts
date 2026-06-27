export interface PeriodLock {
  id: string;
  companyId: string;
  fiscalYear: string;
  lockedMonth: string;
  lockedBy: string;
  lockedAt: string;
  lockReason: string;
  isUnlocked: boolean;
  unlockedBy?: string;
  unlockedAt?: string;
  unlockReason?: string;
}

const STORAGE_KEY = "sutra_period_locks";

function readLocks(): PeriodLock[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocks(locks: PeriodLock[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locks));
  } catch {
    // Never throw from storage write helper.
  }
}

export async function savePeriodLock(
  lock: Omit<PeriodLock, "id" | "lockedAt" | "isUnlocked">,
): Promise<PeriodLock> {
  const savedLock: PeriodLock = {
    ...lock,
    id: crypto.randomUUID(),
    lockedAt: new Date().toISOString(),
    isUnlocked: false,
  };

  try {
    const locks = readLocks();
    locks.push(savedLock);
    writeLocks(locks);
  } catch {
    // Still return the in-memory lock object.
  }

  return savedLock;
}

export async function getPeriodLocks(
  companyId: string,
  fiscalYear: string,
): Promise<PeriodLock[]> {
  try {
    return readLocks()
      .filter((lock) => lock.companyId === companyId && lock.fiscalYear === fiscalYear)
      .sort((a, b) => a.lockedMonth.localeCompare(b.lockedMonth));
  } catch {
    return [];
  }
}

export function isMonthLocked(companyId: string, bsMonthStr: string): boolean {
  try {
    return readLocks().some(
      (lock) =>
        lock.companyId === companyId &&
        lock.lockedMonth === bsMonthStr &&
        lock.isUnlocked === false,
    );
  } catch {
    return false;
  }
}

export async function unlockPeriod(
  lockId: string,
  unlockedBy: string,
  unlockReason: string,
): Promise<void> {
  const locks = readLocks();
  const index = locks.findIndex((lock) => lock.id === lockId);

  if (index === -1) {
    throw new Error("Lock not found");
  }

  locks[index] = {
    ...locks[index],
    isUnlocked: true,
    unlockedBy,
    unlockedAt: new Date().toISOString(),
    unlockReason,
  };

  writeLocks(locks);
}

export function getLockedMonths(companyId: string): string[] {
  try {
    return readLocks()
      .filter((lock) => lock.companyId === companyId && lock.isUnlocked === false)
      .map((lock) => lock.lockedMonth);
  } catch {
    return [];
  }
}

export function validateVoucherDate(
  date: string,
  companyId: string,
): { valid: boolean; reason?: string } {
  try {
    const month = date.slice(0, 7);

    if (isMonthLocked(companyId, month)) {
      return {
        valid: false,
        reason: `This period (${month}) is locked. Please unlock to enter vouchers.`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: true };
  }
}
