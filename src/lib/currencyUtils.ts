// src/lib/currencyUtils.ts

export function convertCurrency(
  amount: number,
  fromRate: number,
  toRate: number
): number {
  if (fromRate === 0) return 0;
  return Math.round((amount / fromRate) * toRate * 100) / 100;
}

export function formatWithCurrency(amount: number, currency: any): string {
  if (!currency) return `Rs. ${amount.toFixed(2)}`;
  return `${currency.symbol} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}
