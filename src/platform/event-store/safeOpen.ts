import type Dexie from "dexie";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export const SafeOpenFailureCode = {
  TIMEOUT: "DB_OPEN_TIMEOUT",
  VERSION_ERROR: "VERSION_ERROR",
  UPGRADE_ERROR: "UPGRADE_ERROR",
  BLOCKED: "DB_BLOCKED",
  UNKNOWN: "DB_OPEN_UNKNOWN",
} as const;

export type SafeOpenFailureCode =
  (typeof SafeOpenFailureCode)[keyof typeof SafeOpenFailureCode];

export interface SafeOpenSuccess<TDb extends Dexie = Dexie> {
  ok: true;
  db: TDb;
  attempts: number;
}

export interface SafeOpenFailure {
  ok: false;
  code: SafeOpenFailureCode;
  message: string;
  cause?: unknown;
  attempts: number;
}

export type SafeOpenResult<TDb extends Dexie = Dexie> = SafeOpenSuccess<TDb> | SafeOpenFailure;

export class SafeOpenError extends Error {
  readonly code: SafeOpenFailureCode;
  readonly attempts: number;
  readonly cause?: unknown;

  constructor(failure: SafeOpenFailure) {
    super(failure.message);
    this.name = "SafeOpenError";
    this.code = failure.code;
    this.attempts = failure.attempts;
    this.cause = failure.cause;
  }
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 500;

export interface SafeOpenOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
}

export function isSafeOpenEnabled(): boolean {
  return (
    isMigrationFlagEnabled("MIGRATION_SAFE_OPEN_DB") ||
    isMigrationFlagEnabled("MIGRATION_EVENT_STORE")
  );
}

function classifyOpenError(error: unknown): SafeOpenFailureCode {
  const err = error as { name?: string; message?: string };
  if (err?.message === SafeOpenFailureCode.TIMEOUT) {
    return SafeOpenFailureCode.TIMEOUT;
  }
  if (err?.name === "VersionError") {
    return SafeOpenFailureCode.VERSION_ERROR;
  }
  if (err?.name === "UpgradeError") {
    return SafeOpenFailureCode.UPGRADE_ERROR;
  }
  if (err?.name === "DatabaseClosedError" || (err?.message || "").includes("blocked")) {
    return SafeOpenFailureCode.BLOCKED;
  }
  return SafeOpenFailureCode.UNKNOWN;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openWithTimeout<TDb extends Dexie>(
  db: TDb,
  timeoutMs: number,
): Promise<TDb> {
  await Promise.race([
    db.open(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(SafeOpenFailureCode.TIMEOUT)), timeoutMs),
    ),
  ]);
  return db;
}

export async function safeOpenDatabase<TDb extends Dexie>(
  db: TDb,
  options: SafeOpenOptions = {},
): Promise<SafeOpenResult<TDb>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (db.isOpen()) {
        return { ok: true, db, attempts: attempt };
      }
      const opened = await openWithTimeout(db, timeoutMs);
      return { ok: true, db: opened, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(backoffMs * attempt);
      }
    }
  }

  const code = classifyOpenError(lastError);
  const message =
    code === SafeOpenFailureCode.TIMEOUT
      ? "Database open timed out. Another tab may hold an older schema version. Automatic deletion is disabled."
      : code === SafeOpenFailureCode.VERSION_ERROR
        ? "Database version conflict detected. Export a backup and resolve the schema mismatch manually."
        : code === SafeOpenFailureCode.UPGRADE_ERROR
          ? "Database upgrade failed. Export a backup before retrying."
          : code === SafeOpenFailureCode.BLOCKED
            ? "Database is blocked by another connection. Close other tabs and retry."
            : "Database could not be opened.";

  return {
    ok: false,
    code,
    message,
    cause: lastError,
    attempts: maxAttempts,
  };
}
