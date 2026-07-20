import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FLAG_ARMED,
  LAUNCH_SALES_PURCHASE_DISCLOSURES,
  LAUNCH_SALES_PURCHASE_RELEASE_ADR,
  NEXT_20_DONE,
  PRODUCTION_APPROVED,
  isLaunchSalesPurchaseProductionApproved,
  launchSalesPurchaseReleaseSnapshot,
} from "@/platform/release/launchSalesPurchaseReleasePolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-C1 launch sales/purchase release package", () => {
  it("keeps flag off and production_approved false", () => {
    const snap = launchSalesPurchaseReleaseSnapshot();
    expect(snap.authority).toBe(LAUNCH_SALES_PURCHASE_RELEASE_ADR);
    expect(snap.authority).toBe("ADR_0090");
    expect(snap.step).toBe("PR-C1");
    expect(snap.capabilityRow).toBe("LAUNCH-ACCOUNTANT-SALES-PURCHASE");
    expect(snap.flagArmed).toBe(false);
    expect(FLAG_ARMED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(snap.next20Done).toBe(false);
    expect(NEXT_20_DONE).toBe(false);
    expect(snap.runtimeProductionApproved).toBe(false);
    expect(isLaunchSalesPurchaseProductionApproved()).toBe(false);
    expect(snap.disclosures.length).toBeGreaterThanOrEqual(4);
    expect(LAUNCH_SALES_PURCHASE_DISCLOSURES[1].toLowerCase()).toContain("does not post");
  });

  it("ships dossier and blocking ticket artifacts", () => {
    const dossier = join(
      ROOT,
      "docs/mokxya-ai/releases/LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md",
    );
    expect(existsSync(dossier)).toBe(true);
    const text = readFileSync(dossier, "utf8");
    expect(text).toContain("Rollback");
    expect(text).toContain("Monitoring");
    expect(text).toContain("production_approved=false");
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-c1/SIGN_NOTE.md"))).toBe(
      true,
    );
    expect(
      existsSync(join(ROOT, "artifacts/prod-ready-pr-c1/BLOCKING_TICKETS.md")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md")),
    ).toBe(true);
  });
});
