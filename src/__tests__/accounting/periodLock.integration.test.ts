import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { SutraERPDatabase } from "@/lib/db";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";
import { invalidatePeriodLockCache } from "@/lib/ledger/periodLockService";
import {
  importLegacyPeriodLocksIntoDexie,
  LEGACY_PERIOD_LOCKS_STORAGE_KEY,
} from "@/lib/periodLock";
import { clearW1FlagOverrides, setW1FlagOverride } from "@/platform/flags/w1Registry";

describe("periodLock integration", () => {
  let db: SutraERPDatabase;

  beforeEach(async () => {
    clearW1FlagOverrides();
    setW1FlagOverride("W1_PERIOD_LOCK_ENFORCE", true);
    localStorage.removeItem(LEGACY_PERIOD_LOCKS_STORAGE_KEY);
    await Dexie.delete("SutraERPDatabase");
    db = new SutraERPDatabase();
    await db.open();
    invalidatePeriodLockCache();
  });

  it("imports legacy localStorage locks into Dexie and enforces posting", async () => {
    localStorage.setItem(
      LEGACY_PERIOD_LOCKS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-1",
          companyId: "main",
          fiscalYear: "2081/82",
          lockedMonth: "2025-07",
          lockedBy: "admin",
          lockedAt: new Date().toISOString(),
          lockReason: "legacy",
          isUnlocked: false,
        },
      ]),
    );

    const result = await importLegacyPeriodLocksIntoDexie(db, {
      clearLocalStorageAfterImport: true,
    });
    expect(result.imported).toBe(1);
    invalidatePeriodLockCache();

    const rows = await db.periodLocks.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].periodKey).toBe("2025-7");

    await expect(enforcePostingPeriodLock("2025-07-12", db)).rejects.toThrow(/Period is locked/);
    await expect(enforcePostingPeriodLock("2025-08-12", db)).resolves.toBeUndefined();
  });

  it("allows posting after lock row is removed", async () => {
    await db.periodLocks.add({
      id: "live-lock",
      periodKey: "2026-1",
      lockedAt: new Date().toISOString(),
      isUnlocked: false,
    });
    invalidatePeriodLockCache();

    await expect(enforcePostingPeriodLock("2026-01-15", db)).rejects.toThrow();

    await db.periodLocks.delete("live-lock");
    invalidatePeriodLockCache();

    await expect(enforcePostingPeriodLock("2026-01-15", db)).resolves.toBeUndefined();
  });

  it("clears localStorage when legacy rows are skipped as duplicates", async () => {
    localStorage.setItem(
      LEGACY_PERIOD_LOCKS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-dup",
          companyId: "main",
          fiscalYear: "2081/82",
          lockedMonth: "2025-07",
          lockedBy: "admin",
          lockedAt: new Date().toISOString(),
          lockReason: "legacy",
          isUnlocked: false,
        },
      ]),
    );

    await db.periodLocks.add({
      id: "existing",
      periodKey: "2025-7",
      lockedAt: new Date().toISOString(),
      isUnlocked: false,
    });

    const result = await importLegacyPeriodLocksIntoDexie(db, {
      clearLocalStorageAfterImport: true,
    });
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.clearedLocalStorage).toBe(true);
    expect(localStorage.getItem(LEGACY_PERIOD_LOCKS_STORAGE_KEY)).toBeNull();
  });
});
