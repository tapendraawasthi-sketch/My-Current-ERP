import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FLAG_ARMED,
  LAUNCH_SALES_PURCHASE_ARM_ADR,
  LAUNCH_SALES_PURCHASE_DISCLOSURES,
  LAUNCH_SALES_PURCHASE_RELEASE_ADR,
  NEXT_20_DONE,
  OWNER_SIGNED,
  PRODUCTION_APPROVED,
  isLaunchSalesPurchaseProductionApproved,
  launchSalesPurchaseReleaseSnapshot,
} from "@/platform/release/launchSalesPurchaseReleasePolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-C1 launch sales/purchase release package", () => {
  it("reflects armed row after PR-C1-ARM", () => {
    const snap = launchSalesPurchaseReleaseSnapshot();
    expect(snap.authority).toBe(LAUNCH_SALES_PURCHASE_RELEASE_ADR);
    expect(snap.armAuthority).toBe(LAUNCH_SALES_PURCHASE_ARM_ADR);
    expect(snap.flagArmed).toBe(true);
    expect(FLAG_ARMED).toBe(true);
    expect(snap.productionApproved).toBe(true);
    expect(PRODUCTION_APPROVED).toBe(true);
    expect(snap.next20Done).toBe(true);
    expect(NEXT_20_DONE).toBe(true);
    expect(snap.ownerSigned).toBe(true);
    expect(OWNER_SIGNED).toBe(true);
    expect(isLaunchSalesPurchaseProductionApproved()).toBe(true);
    expect(snap.disclosures.length).toBeGreaterThanOrEqual(4);
    expect(LAUNCH_SALES_PURCHASE_DISCLOSURES[1].toLowerCase()).toContain("does not post");
  });

  it("ships dossier, sign-off SIGNED, and arm ADR", () => {
    const dossier = join(
      ROOT,
      "docs/mokxya-ai/releases/LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md",
    );
    expect(existsSync(dossier)).toBe(true);
    const signoff = readFileSync(
      join(ROOT, "artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md"),
      "utf8",
    );
    expect(signoff).toContain("SIGNED");
    expect(
      existsSync(
        join(ROOT, "docs/mokxya-ai/decisions/ADR_0100_PR_C1_ARM_SALES_PURCHASE.md"),
      ),
    ).toBe(true);
  });
});
