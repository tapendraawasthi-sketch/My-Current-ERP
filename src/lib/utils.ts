// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null): string {
  const num = Number(amount ?? 0);
  if (isNaN(num)) return "Rs. 0.00";
  const formatted = Math.abs(num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `Rs. -${formatted}` : `Rs. ${formatted}`;
}

export function formatNumber(num: number | string | undefined | null, decimals = 2): string {
  const n = Number(num ?? 0);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function money(amount: number | string | undefined | null): string {
  return formatCurrency(amount);
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
