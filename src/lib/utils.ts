// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | string | undefined | null, decimals = 2): string {
  const num = Number(value);
  if (isNaN(num)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCurrency(
  value: number | string | undefined | null,
  symbol = "Rs.",
  decimals = 2
): string {
  return `${symbol} ${formatNumber(value, decimals)}`;
}

export function numberToWords(num: number, currency = "Rupees"): string {
  if (!num || isNaN(num)) return `Zero ${currency} Only`;
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertHundreds(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 !== 0 ? " " + convertHundreds(n % 100) : "")
    );
  }

  const integer = Math.floor(Math.abs(num));
  const decimal = Math.round((Math.abs(num) - integer) * 100);

  let words = "";
  if (integer === 0) {
    words = "Zero";
  } else {
    const crore = Math.floor(integer / 10000000);
    const lakh = Math.floor((integer % 10000000) / 100000);
    const thousand = Math.floor((integer % 100000) / 1000);
    const remainder = integer % 1000;

    if (crore > 0) words += convertHundreds(crore) + " Crore ";
    if (lakh > 0) words += convertHundreds(lakh) + " Lakh ";
    if (thousand > 0) words += convertHundreds(thousand) + " Thousand ";
    if (remainder > 0) words += convertHundreds(remainder);
    words = words.trim();
  }

  let result = `${words} ${currency}`;
  if (decimal > 0) result += ` and ${convertHundreds(decimal)} Paisa`;
  result += " Only";

  return num < 0 ? `Negative ${result}` : result;
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

export const dateToAD = () => "";
export const parseFlexibleDate = () => new Date();
