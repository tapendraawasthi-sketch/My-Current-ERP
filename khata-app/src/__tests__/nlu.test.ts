import { describe, expect, it } from "vitest";

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

describe("NLU acceptance sentences", () => {
  it("placeholder integration — run erp_bot/scripts/test_falcon_trader_nlu.py in CI", () => {
    expect(true).toBe(true);
  });
});
