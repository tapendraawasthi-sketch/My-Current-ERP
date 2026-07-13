/**
 * Classify sync failures and compute retry backoff with jitter.
 */

export type FailureClass = "retryable" | "permanent" | "conflict";

const RETRYABLE_CODES = new Set([
  "network_unavailable",
  "timeout",
  "temporary_server_error",
  "rate_limited",
  "remote_maintenance",
  "http_500",
  "http_502",
  "http_503",
  "http_429",
]);

const CONFLICT_CODES = new Set([
  "aggregate_version_conflict",
  "voucher_number_collision",
  "invoice_number_collision",
  "integrity_hash_mismatch",
  "duplicate_idempotency_key",
  "local_modified_after_remote_base",
]);

const PERMANENT_CODES = new Set([
  "invalid_schema",
  "authorization_denied",
  "company_mismatch",
  "unsupported_event_version",
  "unsupported_schema_version",
  "invalid_accounting_payload",
  "financial_year_mismatch",
]);

export function classifySyncFailure(codeOrMessage: string): FailureClass {
  const code = codeOrMessage.toLowerCase();
  if (CONFLICT_CODES.has(code) || code.includes("conflict")) return "conflict";
  if (PERMANENT_CODES.has(code)) return "permanent";
  if (RETRYABLE_CODES.has(code)) return "retryable";
  if (code.includes("network") || code.includes("timeout") || code.includes("fetch")) {
    return "retryable";
  }
  if (code.includes("401") || code.includes("403") || code.includes("auth")) {
    return "permanent";
  }
  if (code.includes("429") || code.includes("500") || code.includes("502") || code.includes("503")) {
    return "retryable";
  }
  return "retryable";
}

/** Bounded exponential backoff with jitter. attempt is 1-based. */
export function computeNextAttemptAt(attempt: number, baseMs = 1000, maxMs = 5 * 60_000): string {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1000, exp * 0.2));
  return new Date(Date.now() + exp + jitter).toISOString();
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function withSyncRetry<T>(
  operation: () => Promise<T>,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (classifySyncFailure(message) === "permanent") throw error;
      if (attempt < maxRetries) {
        const delayMs = BASE_DELAY_MS * attempt + Math.floor(Math.random() * 200);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
