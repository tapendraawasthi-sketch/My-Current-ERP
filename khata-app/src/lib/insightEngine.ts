import { isVatMessageSuppressed } from "./featureFlags";

export interface InsightItem {
  id: string;
  type: "daily_total" | "unpaid_udhaar" | "weekly_trend" | "growth_ladder";
  message: string;
  party_name?: string | null;
}

export function pickVisibleInsights(insights: InsightItem[]): InsightItem[] {
  const filtered = insights.filter((item) => {
    if (item.type === "growth_ladder" && isVatMessageSuppressed()) {
      return false;
    }
    return true;
  });
  const daily = filtered.find((item) => item.type === "daily_total");
  const others = filtered.filter((item) => item.type !== "daily_total");
  const picked = daily ? [daily] : [];
  for (const item of others) {
    if (picked.length >= 2) break;
    picked.push(item);
  }
  return picked.slice(0, 2);
}
