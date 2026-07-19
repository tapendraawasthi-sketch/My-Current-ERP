import { describe, expect, it } from "vitest";
import {
  LAUNCH_MUTATION_ADR,
  PRODUCT_MUTATION_PATH,
  evaluateNodeKhataLaunchDeny,
} from "./launchMutationDeny.js";

describe("PR-B2 launch mutation Node deny", () => {
  it("allows non-overlap intents", () => {
    const r = evaluateNodeKhataLaunchDeny({
      intent: "khata_expense",
      channel: "orbix",
    });
    expect(r.deny).toBe(false);
    expect(r.draft_mutations).toBe(0);
  });

  it("allows overlap intents without launch markers (legacy khata)", () => {
    const r = evaluateNodeKhataLaunchDeny({
      intent: "khata_purchase",
      channel: "legacy_khata_app",
    });
    expect(r.deny).toBe(false);
  });

  it("denies overlap when launch_event_id set", () => {
    const r = evaluateNodeKhataLaunchDeny({
      intent: "khata_cash_sale",
      launch_event_id: "sales_invoice_draft",
    });
    expect(r.deny).toBe(true);
    expect(r.error_code).toBe("LAUNCH_MUTATION_NODE_KHATA_DENIED");
    expect(r.authority).toBe(LAUNCH_MUTATION_ADR);
    expect(r.product_mutation_path).toBe(PRODUCT_MUTATION_PATH);
    expect(r.draft_mutations).toBe(0);
  });

  it("denies overlap when orbix confirm token present", () => {
    const r = evaluateNodeKhataLaunchDeny({
      intent: "khata_purchase",
      confirm_token: "orbix-confirm-abc",
    });
    expect(r.deny).toBe(true);
  });

  it("denies overlap when product path declared Dexie", () => {
    const r = evaluateNodeKhataLaunchDeny({
      intent: "khata_credit_sale",
      product_mutation_path: PRODUCT_MUTATION_PATH,
    });
    expect(r.deny).toBe(true);
  });

  it("denies overlap when channel is orbix/ai", () => {
    expect(
      evaluateNodeKhataLaunchDeny({ intent: "khata_purchase", channel: "orbix" })
        .deny,
    ).toBe(true);
    expect(
      evaluateNodeKhataLaunchDeny({ intent: "khata_cash_sale", source: "ai" })
        .deny,
    ).toBe(true);
  });
});
