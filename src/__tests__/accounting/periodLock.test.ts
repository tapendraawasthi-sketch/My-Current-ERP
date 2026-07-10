import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { SutraERPDatabase } from "@/lib/db";
import {
  enforcePostingPeriodLock,
  isPeriodLockedError,
  PeriodLockedError,
} from "@/lib/ledger/postingPeriodGuard";
import {
  invalidatePeriodLockCache,
  isDateLocked,
  normalizePeriodKey,
  periodKeyFromDate,
} from "@/lib/ledger/periodLockService";
import { clearW1FlagOverrides, setW1FlagOverride } from "@/platform/flags/w1Registry";

describe("periodLockService", () => {
  let db: SutraERPDatabase;

  beforeEach(async () => {
    clearW1FlagOverrides();
    setW1FlagOverride("W1_PERIOD_LOCK_ENFORCE", true);
    await Dexie.delete("SutraERPDatabase");
    db = new SutraERPDatabase();
    await db.open();
    invalidatePeriodLockCache();
  });

  it("normalizes zero-padded and non-padded month keys", () => {
    expect(normalizePeriodKey("2025-07")).toBe("2025-7");
    expect(normalizePeriodKey("2025-7")).toBe("2025-7");
  });

  it("returns unlocked when no locks exist", async () => {
    expect(await isDateLocked("2025-07-15", db)).toBe(false);
  });

  it("detects locked period by periodKey", async () => {
    await db.periodLocks.add({
      id: "lock-1",
      periodKey: "2025-7",
      lockedAt: new Date().toISOString(),
      isUnlocked: false,
    });
    invalidatePeriodLockCache();

    expect(await isDateLocked("2025-07-20", db)).toBe(true);
    expect(periodKeyFromDate("2025-07-20")).toBe("2025-7");
  });

  it("ignores unlocked rows", async () => {
    await db.periodLocks.add({
      id: "lock-2",
      periodKey: "2025-8",
      lockedAt: new Date().toISOString(),
      isUnlocked: true,
    });
    invalidatePeriodLockCache();

    expect(await isDateLocked("2025-08-10", db)).toBe(false);
  });

  it("no-ops enforcement when W1_PERIOD_LOCK_ENFORCE is false", async () => {
    await db.periodLocks.add({
      id: "lock-3",
      periodKey: "2025-9",
      lockedAt: new Date().toISOString(),
      isUnlocked: false,
    });
    invalidatePeriodLockCache();
    setW1FlagOverride("W1_PERIOD_LOCK_ENFORCE", false);

    await expect(enforcePostingPeriodLock("2025-09-05", db)).resolves.toBeUndefined();
  });

  it("throws when posting into a locked period", async () => {
    await db.periodLocks.add({
      id: "lock-4",
      periodKey: "2025-10",
      lockedAt: new Date().toISOString(),
      isUnlocked: false,
    });
    invalidatePeriodLockCache();

    await expect(enforcePostingPeriodLock("2025-10-01", db)).rejects.toSatisfy((err: unknown) =>
      isPeriodLockedError(err),
    );
  });

  it("throws PeriodLockedError when periodLocks table is missing", async () => {
    const stubDb = {
      tables: [{ name: "vouchers" }],
    } as never;
    await expect(enforcePostingPeriodLock("2025-10-01", stubDb)).rejects.toSatisfy(
      (err: unknown) => err instanceof PeriodLockedError,
    );
  });
});
