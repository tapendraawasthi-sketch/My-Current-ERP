// src/lib/currencyUtils.ts

export function convertCurrency(amount: number, fromRate: number, toRate: number): number {
  const safeAmount = Number(amount) || 0;
  if (!fromRate || fromRate <= 0 || !toRate || toRate <= 0) return 0;
  return Math.round((safeAmount / fromRate) * toRate * 100) / 100;
}

export function formatWithCurrency(amount: number, currency: any): string {
  const safeAmount = Number(amount) || 0;
  if (!currency) return `Rs. ${safeAmount.toFixed(2)}`;
  return `${currency.symbol} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount)}`;
}
