import type { SutraERPDatabase } from "../db";
import { isW1FlagEnabled } from "../../platform/flags/w1Registry";
import {
  checkPeriodLock,
  type PeriodLockViolation,
} from "./periodLockService";

/** Thrown when posting is blocked by an active fiscal period lock. */
export class PeriodLockedError extends Error {
  readonly code = "PERIOD_LOCKED";

  constructor(public readonly violation: PeriodLockViolation) {
    super(violation.message);
    this.name = "PeriodLockedError";
  }
}

export function isPeriodLockedError(err: unknown): err is PeriodLockedError {
  return err instanceof PeriodLockedError;
}

function assertPeriodLockSchemaReady(db: SutraERPDatabase): void {
  if (!isW1FlagEnabled("W1_PERIOD_LOCK_ENFORCE")) return;
  if (db.tables.some((t) => t.name === "periodLocks")) return;
  throw new PeriodLockedError({
    date: "",
    periodKey: "",
    message:
      "Period lock enforcement is unavailable because the local database has not completed migration to schema v26.",
  });
}

/**
 * Single enforcement entry point for all posted voucher / invoice / journal writes.
 * Respects W1_PERIOD_LOCK_ENFORCE (no-op when flag is false).
 */
export async function enforcePostingPeriodLock(
  date: string,
  db: SutraERPDatabase,
): Promise<void> {
  if (!isW1FlagEnabled("W1_PERIOD_LOCK_ENFORCE")) return;
  assertPeriodLockSchemaReady(db);
  const violation = await checkPeriodLock(date, db);
  if (violation) {
    throw new PeriodLockedError(violation);
  }
}

/** Enforces period lock when document status is posted (or becomes posted). */
export async function enforcePostingPeriodLockIfPosted(
  doc: { status?: string; date?: string },
  db: SutraERPDatabase,
): Promise<void> {
  if ((doc.status || "draft") !== "posted") return;
  if (!doc.date) {
    throw new Error("Posted financial document requires a date for period lock enforcement.");
  }
  await enforcePostingPeriodLock(doc.date, db);
}
