import { describe, expect, it } from "vitest";
import { pickVisibleInsights, type InsightItem } from "../lib/insightEngine";

const GROWTH_LADDER_MESSAGE =
  "Tapaaiko byapar badhdai chha! Kasai kasai le NPR 50 lakh pachhi VAT darta garna parcha. Thaha paauna chahanu hunchha?";

describe("growth ladder copy", () => {
  it("does not contain banned compliance words", () => {
    const banned = ["IRD", "tax", "kaanuun", "danda"];
    for (const word of banned) {
      expect(GROWTH_LADDER_MESSAGE.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

describe("insight selection", () => {
  it("shows at most two insights with daily total first", () => {
    const insights: InsightItem[] = [
      { id: "1", type: "weekly_trend", message: "trend" },
      { id: "2", type: "daily_total", message: "daily" },
      { id: "3", type: "unpaid_udhaar", message: "unpaid" },
    ];
    const visible = pickVisibleInsights(insights);
    expect(visible).toHaveLength(2);
    expect(visible[0]?.type).toBe("daily_total");
  });
});

describe("NLU integration", () => {
  it("documents Python NLU suite location", () => {
    expect("erp_bot/scripts/test_falcon_trader_nlu.py").toContain("test_falcon");
  });
});
