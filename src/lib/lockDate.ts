// src/lib/lockDate.ts
// Accounting Lock Date Validation — PDF §"Accounting Lock Date Validation and Temporal Integrity"

export interface LockDateConfig {
  hardLockDate?: string;   // ISO yyyy-mm-dd; reject everything <= this
  softLockDate?: string;   // ISO; warn (override w/ password) for <= this
  overridePassword?: string;
}

export type LockCheckResult =
  | { allowed: true; warning?: undefined }
  | { allowed: false; reason: "hard"; message: string }
  | { allowed: false; reason: "soft"; message: string; requiresPassword: true };

/**
 * Validates whether a transaction with `accountingDate` may be posted.
 * Hard lock is absolute. Soft lock requires the override password.
 */
export function checkLockDate(
  accountingDate: string,
  cfg: LockDateConfig,
  providedPassword?: string,
): LockCheckResult {
  const txTime = new Date(accountingDate).getTime();

  if (cfg.hardLockDate) {
    const hard = new Date(cfg.hardLockDate).getTime();
    if (txTime <= hard) {
      return {
        allowed: false,
        reason: "hard",
        message: `Period is hard-locked. Cannot post on or before ${cfg.hardLockDate}.`,
      };
    }
  }

  if (cfg.softLockDate) {
    const soft = new Date(cfg.softLockDate).getTime();
    if (txTime <= soft) {
      if (cfg.overridePassword && providedPassword === cfg.overridePassword) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "soft",
        message: `Period is soft-locked on/before ${cfg.softLockDate}. Override password required.`,
        requiresPassword: true,
      };
    }
  }

  return { allowed: true };
}
