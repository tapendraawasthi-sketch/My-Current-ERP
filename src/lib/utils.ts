// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Single options object for ERP money display (STEP 6.1). */
export type MoneyNegativeStyle = "minus-prefix" | "parens";

export interface MoneyFormatOptions {
  /** Prefix symbol. Default `"Rs."`. */
  symbol?: string;
  /** Fraction digits. Default `2`. */
  decimals?: number;
  /**
   * Negative presentation when a symbol is shown:
   * - `minus-prefix` → `Rs. -1,234.00` (default; backward compatible)
   * - `parens` → `Rs. (1,234.00)` (statements / Home KPIs)
   */
  negativeStyle?: MoneyNegativeStyle;
  /** Grouping locale. Default `"en-IN"` (lakh/crore-friendly). */
  locale?: string;
  /** When false, omit the symbol. Default true for `formatCurrency`. */
  showSymbol?: boolean;
}

export const MONEY_FORMAT_DEFAULTS: Required<
  Pick<MoneyFormatOptions, "symbol" | "decimals" | "negativeStyle" | "locale" | "showSymbol">
> = {
  symbol: "Rs.",
  decimals: 2,
  negativeStyle: "minus-prefix",
  locale: "en-IN",
  showSymbol: true,
};

function resolveMoneyOptions(opts?: MoneyFormatOptions): Required<
  Pick<MoneyFormatOptions, "symbol" | "decimals" | "negativeStyle" | "locale" | "showSymbol">
> {
  return { ...MONEY_FORMAT_DEFAULTS, ...opts };
}

function formatGroupedAbs(abs: number, decimals: number, locale: string): string {
  return abs.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function applyNegative(absText: string, negative: boolean, style: MoneyNegativeStyle): string {
  if (!negative) return absText;
  return style === "parens" ? `(${absText})` : `-${absText}`;
}

/**
 * Format a currency amount. Pass a symbol string or full options.
 * @example formatCurrency(1250.5) // "Rs. 1,250.50"
 * @example formatCurrency(-10, { negativeStyle: "parens" }) // "Rs. (10.00)"
 * @example formatCurrency(10, "NPR") // "NPR 10.00"
 */
export function formatCurrency(
  amount: number | string | undefined | null,
  opts?: MoneyFormatOptions | string,
): string {
  const options = resolveMoneyOptions(typeof opts === "string" ? { symbol: opts } : opts);
  const num = Number(amount ?? 0);
  const zeroBody = formatGroupedAbs(0, options.decimals, options.locale);
  if (Number.isNaN(num)) {
    return options.showSymbol ? `${options.symbol} ${zeroBody}` : zeroBody;
  }
  const absText = formatGroupedAbs(Math.abs(num), options.decimals, options.locale);
  const signed = applyNegative(absText, num < 0, options.negativeStyle);
  if (!options.showSymbol) return signed;
  if (num < 0 && options.negativeStyle === "minus-prefix") {
    // Preserve historical shape: "Rs. -1,234.00" (symbol, then signed body)
    return `${options.symbol} ${signed}`;
  }
  if (num < 0 && options.negativeStyle === "parens") {
    return `${options.symbol} ${signed}`;
  }
  return `${options.symbol} ${absText}`;
}

/**
 * Format a plain number (no currency symbol).
 * Second arg may be decimal count (legacy) or MoneyFormatOptions.
 */
export function formatNumber(
  num: number | string | undefined | null,
  decimalsOrOpts: number | MoneyFormatOptions = 2,
): string {
  const options =
    typeof decimalsOrOpts === "number"
      ? resolveMoneyOptions({ decimals: decimalsOrOpts, showSymbol: false })
      : resolveMoneyOptions({ ...decimalsOrOpts, showSymbol: false });
  const n = Number(num ?? 0);
  if (Number.isNaN(n)) return formatGroupedAbs(0, options.decimals, options.locale);
  const absText = formatGroupedAbs(Math.abs(n), options.decimals, options.locale);
  return applyNegative(absText, n < 0, options.negativeStyle);
}

/** Compact KPI amounts: Cr / L / K with the same options object. */
export function formatCompactCurrency(
  amount: number | string | undefined | null,
  opts?: MoneyFormatOptions | string,
): string {
  const options = resolveMoneyOptions(typeof opts === "string" ? { symbol: opts } : opts);
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return formatCurrency(0, options);
  const abs = Math.abs(num);
  let body: string;
  if (abs >= 10_000_000) body = `${(abs / 10_000_000).toFixed(2)}Cr`;
  else if (abs >= 100_000) body = `${(abs / 100_000).toFixed(2)}L`;
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}K`;
  else body = formatGroupedAbs(abs, options.decimals, options.locale);
  const signed = applyNegative(body, num < 0, options.negativeStyle);
  if (!options.showSymbol) return signed;
  return `${options.symbol} ${signed}`;
}

export function money(amount: number | string | undefined | null, opts?: MoneyFormatOptions | string): string {
  return formatCurrency(amount, opts);
}

export function round2(num: number | string | undefined | null): number {
  return Math.round((Number(num) || 0) * 100) / 100;
}

export function numberToWords(num: number, suffix = "Rupees Only"): string {
  if (num === 0) return `Zero ${suffix}`;
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function say(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + say(n % 100) : "");
  }

  let n = Math.floor(Math.abs(num));
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thou = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;

  const parts: string[] = [];
  if (crore) parts.push(say(crore) + " Crore");
  if (lakh) parts.push(say(lakh) + " Lakh");
  if (thou) parts.push(say(thou) + " Thousand");
  if (rest) parts.push(say(rest));

  return parts.join(" ") + " " + suffix;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

export function dateToAD(date: Date | string): string {
  if (!date) return new Date().toISOString().split("T")[0];
  if (typeof date === "string") return date.split("T")[0];
  return date.toISOString().split("T")[0];
}

export function parseFlexibleDate(value: string | Date | undefined | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Returns the number of decimal places to use for profit/balance sheet reports.
 * Reads from localStorage key "cfg_decimal_places" with fallback of 2.
 */
export function getProfitDecimalPlaces(): number {
  try {
    const raw = localStorage.getItem("cfg_decimal_places");
    if (raw !== null) {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0 && n <= 6) return n;
    }
  } catch {}
  return 2;
}
