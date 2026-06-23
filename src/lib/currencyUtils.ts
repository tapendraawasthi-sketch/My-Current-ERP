import { ExchangeRate, Currency } from "./types";

/**
 * Convert amount from foreign currency to base currency
 */
export function convertToBaseCurrency(amount: number, exchangeRate: number): number {
  return Math.round(amount * exchangeRate * 100) / 100;
}

/**
 * Convert amount from base currency to foreign currency
 */
export function convertFromBaseCurrency(amount: number, exchangeRate: number): number {
  if (exchangeRate === 0) return 0;
  return Math.round((amount / exchangeRate) * 100) / 100;
}

/**
 * Calculate forex gain or loss
 * Positive = Gain, Negative = Loss
 */
export function calculateForexGainLoss(
  foreignAmount: number,
  originalRate: number,
  settlementRate: number,
): number {
  const originalBaseAmount = convertToBaseCurrency(foreignAmount, originalRate);
  const settlementBaseAmount = convertToBaseCurrency(foreignAmount, settlementRate);
  return Math.round((settlementBaseAmount - originalBaseAmount) * 100) / 100;
}

/**
 * Get exchange rate for a specific date
 * Falls back to most recent rate if exact date not found
 */
export function getExchangeRateForDate(
  exchangeRates: ExchangeRate[],
  currencyCode: string,
  date: string,
): ExchangeRate | null {
  const rates = exchangeRates
    .filter((r) => r.currencyCode === currencyCode && r.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date));

  return rates[0] || null;
}

/**
 * Format currency with symbol
 */
export function formatCurrencyWithSymbol(amount: number, currency: Currency): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${currency.symbol} ${formatted}`;
}

/**
 * Create forex gain/loss journal entry
 */
export function createForexGainLossEntry(
  gainLoss: number,
  invoiceNo: string,
  date: string,
  dateNepali: string,
  currencyCode: string,
  forexAccountId: string = "acc-forex-gain-loss",
) {
  const isGain = gainLoss > 0;
  const absAmount = Math.abs(gainLoss);

  return {
    date,
    dateNepali,
    narration: `Foreign exchange ${isGain ? "gain" : "loss"} on settlement of invoice ${invoiceNo} (${currencyCode})`,
    type: "journal" as const,
    status: "posted" as const,
    lines: [
      {
        accountId: forexAccountId,
        accountName: "Foreign Exchange Gain/Loss",
        debit: isGain ? 0 : absAmount,
        credit: isGain ? absAmount : 0,
        narration: `${isGain ? "Gain" : "Loss"} on ${currencyCode} settlement`,
      },
      {
        accountId: "acc-cash", // This should be the settlement account
        accountName: "Settlement Account",
        debit: isGain ? absAmount : 0,
        credit: isGain ? 0 : absAmount,
        narration: `Adjustment for forex ${isGain ? "gain" : "loss"}`,
      },
    ],
  };
}
