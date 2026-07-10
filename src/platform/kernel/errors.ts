/** Canonical domain error codes (F2 command bus returns these). */

export const FiosErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  PERIOD_LOCKED: "PERIOD_LOCKED",
  UNBALANCED_VOUCHER: "UNBALANCED_VOUCHER",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE: "DUPLICATE",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL: "INTERNAL",
} as const;

export type FiosErrorCode = (typeof FiosErrorCode)[keyof typeof FiosErrorCode];

export class FiosDomainError extends Error {
  readonly code: FiosErrorCode;

  constructor(code: FiosErrorCode, message: string) {
    super(message);
    this.name = "FiosDomainError";
    this.code = code;
  }
}
