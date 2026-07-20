// src/lib/currencyUtils.ts
import { formatCurrency } from "./utils";

export function convertCurrency(amount: number, fromRate: number, toRate: number): number {
  const safeAmount = Number(amount) || 0;
  if (!fromRate || fromRate <= 0 || !toRate || toRate <= 0) return 0;
  return Math.round((safeAmount / fromRate) * toRate * 100) / 100;
}

export function formatWithCurrency(amount: number, currency: { symbol?: string } | null | undefined): string {
  return formatCurrency(amount, { symbol: currency?.symbol || "Rs." });
}
