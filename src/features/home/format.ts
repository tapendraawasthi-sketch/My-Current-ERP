import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardFreshness, FavourabilityHint } from "./types";

export function formatHomeAmount(
  value: number | null | undefined,
  currencySymbol = "Rs.",
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return formatCurrency(value, {
    symbol: currencySymbol,
    negativeStyle: "parens",
  });
}

export function formatHomeCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return String(Math.round(Number(value)));
}

/** Prefer company symbol when present; fall back to formatCurrency semantics. */
export function resolveCurrencySymbol(company: {
  currencySymbol?: string;
  defaultCurrency?: string;
} | null): string {
  if (company?.currencySymbol) return company.currencySymbol;
  if (company?.defaultCurrency === "NPR" || !company?.defaultCurrency) return "Rs.";
  return company.defaultCurrency;
}

export function freshnessLabel(f: DashboardFreshness): string {
  switch (f) {
    case "fresh":
      return "Current";
    case "refreshing":
      return "Refreshing";
    case "stale":
      return "May be outdated";
    case "local_only":
      return "Local only";
    case "partial":
      return "Partial data";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

export function metricTone(
  favourability: FavourabilityHint,
  value: number | null,
): "neutral" | "favourable" | "unfavourable" {
  if (value === null || favourability === "neutral") return "neutral";
  if (favourability === "balanced_is_favourable") {
    return value === 0 ? "favourable" : "unfavourable";
  }
  if (favourability === "higher_is_favourable") {
    return value >= 0 ? "favourable" : "unfavourable";
  }
  if (favourability === "lower_is_unfavourable") {
    return value > 0 ? "unfavourable" : "favourable";
  }
  return "neutral";
}

export { formatCurrency, formatNumber };
