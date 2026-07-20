import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FLAG_ARMED,
  LAUNCH_ASK_COMPANY_REPORTS_DISCLOSURES,
  LAUNCH_ASK_COMPANY_REPORTS_RELEASE_ADR,
  NEXT_20_DONE,
  PRODUCTION_APPROVED,
  ZERO_MUTATION,
  isLaunchAskCompanyReportsProductionApproved,
  launchAskCompanyReportsReleaseSnapshot,
} from "@/platform/release/launchAskCompanyReportsReleasePolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-C2 Ask company reports release package", () => {
  it("keeps flag off and production_approved false", () => {
    const snap = launchAskCompanyReportsReleaseSnapshot();
    expect(snap.authority).toBe(LAUNCH_ASK_COMPANY_REPORTS_RELEASE_ADR);
    expect(snap.authority).toBe("ADR_0092");
    expect(snap.step).toBe("PR-C2");
    expect(snap.capabilityRow).toBe("LAUNCH-ASK-COMPANY-REPORTS");
    expect(snap.flagArmed).toBe(false);
    expect(FLAG_ARMED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(snap.next20Done).toBe(false);
    expect(NEXT_20_DONE).toBe(false);
    expect(snap.zeroMutation).toBe(true);
    expect(ZERO_MUTATION).toBe(true);
    expect(snap.runtimeProductionApproved).toBe(false);
    expect(isLaunchAskCompanyReportsProductionApproved()).toBe(false);
    expect(snap.disclosures.length).toBeGreaterThanOrEqual(4);
    expect(LAUNCH_ASK_COMPANY_REPORTS_DISCLOSURES[0].toLowerCase()).toContain(
      "zero mutation",
    );
  });

  it("ships dossier and blocking ticket artifacts", () => {
    const dossier = join(
      ROOT,
      "docs/mokxya-ai/releases/LAUNCH_ASK_COMPANY_REPORTS_V1.md",
    );
    expect(existsSync(dossier)).toBe(true);
    const text = readFileSync(dossier, "utf8");
    expect(text).toContain("Rollback");
    expect(text).toContain("Monitoring");
    expect(text).toContain("production_approved=false");
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-c2/SIGN_NOTE.md"))).toBe(
      true,
    );
    expect(
      existsSync(join(ROOT, "artifacts/prod-ready-pr-c2/BLOCKING_TICKETS.md")),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, "artifacts/prod-ready-pr-c2/OWNER_SIGNOFF.md")),
    ).toBe(true);
    expect(
      existsSync(
        join(
          ROOT,
          "docs/mokxya-ai/baselines/PR_C2_LAUNCH_ASK_COMPANY_REPORTS_RELEASE_PACKAGE.md",
        ),
      ),
    ).toBe(true);
  });
});
