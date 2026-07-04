// @ts-nocheck
/**
 * Foreign Exchange Utility Functions
 * Handles rate lookup, conversion, and gain/loss computation
 */

export interface ExchangeRateRecord {
  currencyCode: string;
  date: string;
  midRate: number;
  buyRate: number;
  sellRate: number;
}

/**
 * Get the effective exchange rate for a currency on a given date.
 * Falls back to the most recent rate before the date.
 */
export function getEffectiveRate(
  rates: ExchangeRateRecord[],
  currencyCode: string,
  date: string,
): ExchangeRateRecord | null {
  const filtered = rates
    .filter((r) => r.currencyCode === currencyCode && r.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return filtered[0] || null;
}

/**
 * Convert foreign currency amount to base currency (NPR).
 * @param foreignAmount – amount in foreign currency
 * @param midRate – units of base currency per 1 foreign currency unit
 */
export function toBase(foreignAmount: number, midRate: number): number {
  return Math.round(foreignAmount * midRate * 100) / 100;
}

/**
 * Convert base currency amount to foreign currency.
 */
export function toForeign(baseAmount: number, midRate: number): number {
  if (!midRate) return 0;
  return Math.round((baseAmount / midRate) * 100) / 100;
}

/**
 * Compute realized FX gain/loss when a foreign-currency transaction is settled.
 * Gain = (settlement rate - transaction rate) × foreign amount
 * Positive = gain (for AR / asset), negative = loss.
 */
export function computeRealizedGainLoss(
  foreignAmount: number,
  rateAtTransaction: number,
  rateAtSettlement: number,
): number {
  return Math.round((rateAtSettlement - rateAtTransaction) * foreignAmount * 100) / 100;
}

/**
 * Compute unrealized FX gain/loss on open balances at period end.
 * Revalues all open foreign-currency balances at the closing rate.
 */
export function computeUnrealizedGainLoss(
  foreignAmount: number,
  rateAtTransaction: number,
  rateAtRevaluation: number,
): number {
  return Math.round((rateAtRevaluation - rateAtTransaction) * foreignAmount * 100) / 100;
}

/** Format a number as a currency string with sign */
export function fmtFX(n: number, symbol = ""): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}${symbol}${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Common world currencies relevant to Nepal trade */
export const COMMON_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QR" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SR" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD" },
];
