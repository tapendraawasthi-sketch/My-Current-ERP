/**
 * @deprecated Wave 1 (FI-021): period locks are stored in Dexie `periodLocks` (schema v26).
 * Use `src/lib/ledger/periodLockService.ts` for enforcement and `PeriodLockPage` for management.
 * This module remains for one-time localStorage → Dexie migration only.
 */
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

export const LEGACY_PERIOD_LOCKS_STORAGE_KEY = "sutra_period_locks";

function readLocks(): PeriodLock[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(LEGACY_PERIOD_LOCKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Returns true when legacy localStorage period locks exist and have not been cleared. */
export function hasLegacyPeriodLocksInLocalStorage(): boolean {
  return readLocks().some((lock) => lock.isUnlocked === false);
}

/** Count of active (not unlocked) legacy locks in localStorage. */
export function countLegacyPeriodLocksInLocalStorage(): number {
  return readLocks().filter((lock) => lock.isUnlocked === false).length;
}

export interface LegacyPeriodLockImportResult {
  imported: number;
  skipped: number;
  clearedLocalStorage: boolean;
}

/**
 * Imports active legacy localStorage period locks into Dexie `periodLocks`.
 * Safe to call multiple times — dedupes by normalized periodKey.
 */
export async function importLegacyPeriodLocksIntoDexie(
  db: { table: (name: string) => { toArray: () => Promise<unknown[]>; put: (row: unknown) => Promise<unknown> } },
  options: { clearLocalStorageAfterImport?: boolean } = {},
): Promise<LegacyPeriodLockImportResult> {
  const { clearLocalStorageAfterImport = true } = options;
  const legacy = readLocks().filter((lock) => lock.isUnlocked === false);
  if (legacy.length === 0) {
    return { imported: 0, skipped: 0, clearedLocalStorage: false };
  }

  const table = db.table("periodLocks");
  const existingRows = (await table.toArray()) as Array<{ periodKey?: string; lockedMonth?: string }>;
  const existingKeys = new Set<string>();

  for (const row of existingRows) {
    const raw = row.periodKey || row.lockedMonth;
    if (raw) {
      const parts = raw.split("-");
      if (parts.length >= 2) {
        existingKeys.add(`${Number(parts[0])}-${Number(parts[1])}`);
      }
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const lock of legacy) {
    const parts = lock.lockedMonth.split("-");
    const periodKey =
      parts.length >= 2 ? `${Number(parts[0])}-${Number(parts[1])}` : lock.lockedMonth;

    if (existingKeys.has(periodKey)) {
      skipped += 1;
      continue;
    }

    await table.put({
      id: lock.id,
      companyId: lock.companyId,
      fiscalYear: lock.fiscalYear,
      periodKey,
      lockedMonth: lock.lockedMonth,
      lockedAt: lock.lockedAt,
      lockedBy: lock.lockedBy,
      lockedByName: lock.lockedBy,
      lockReason: lock.lockReason || "Imported from legacy localStorage",
      isUnlocked: false,
      requiresPin: false,
    });

    existingKeys.add(periodKey);
    imported += 1;
  }

  let clearedLocalStorage = false;
  if (clearLocalStorageAfterImport && typeof localStorage !== "undefined") {
    const allHandled = imported + skipped === legacy.length;
    if (imported > 0 || (allHandled && skipped > 0)) {
      localStorage.removeItem(LEGACY_PERIOD_LOCKS_STORAGE_KEY);
      clearedLocalStorage = true;
    }
  }

  return { imported, skipped, clearedLocalStorage };
}

/** @deprecated Use Dexie periodLocks via PeriodLockPage. */
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
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LEGACY_PERIOD_LOCKS_STORAGE_KEY, JSON.stringify(locks));
    }
  } catch {
    /* still return in-memory lock */
  }

  return savedLock;
}

/** @deprecated Use Dexie periodLocks. */
export async function getPeriodLocks(companyId: string, fiscalYear: string): Promise<PeriodLock[]> {
  try {
    return readLocks()
      .filter((lock) => lock.companyId === companyId && lock.fiscalYear === fiscalYear)
      .sort((a, b) => a.lockedMonth.localeCompare(b.lockedMonth));
  } catch {
    return [];
  }
}

/** @deprecated Use periodLockService.isDateLocked with Dexie. */
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

/** @deprecated Use Dexie periodLocks. */
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

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LEGACY_PERIOD_LOCKS_STORAGE_KEY, JSON.stringify(locks));
  }
}

/** @deprecated Use Dexie periodLocks. */
export function getLockedMonths(companyId: string): string[] {
  try {
    return readLocks()
      .filter((lock) => lock.companyId === companyId && lock.isUnlocked === false)
      .map((lock) => lock.lockedMonth);
  } catch {
    return [];
  }
}

/** @deprecated Use assertPeriodUnlockedForPosting from src/lib/ledger. */
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
