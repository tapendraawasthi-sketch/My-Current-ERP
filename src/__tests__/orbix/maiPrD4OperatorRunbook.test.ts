import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAY0_SMOKE_PASS,
  OPERATOR_RUNBOOK_ADR,
  PACK_READY,
  POST_LAUNCH_STABLE,
  PRODUCTION_APPROVED,
  operatorRunbookSnapshot,
} from "@/platform/release/operatorRunbookPolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-D4 operator runbook pack", () => {
  it("keeps pack ready without claiming post-launch stable", () => {
    const snap = operatorRunbookSnapshot();
    expect(snap.authority).toBe(OPERATOR_RUNBOOK_ADR);
    expect(snap.authority).toBe("ADR_0096");
    expect(snap.step).toBe("PR-D4");
    expect(snap.packReady).toBe(true);
    expect(PACK_READY).toBe(true);
    expect(snap.postLaunchStable).toBe(false);
    expect(POST_LAUNCH_STABLE).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(snap.day0SmokePass).toBe(false);
    expect(DAY0_SMOKE_PASS).toBe(false);
  });

  it("ships runbook and artifacts", () => {
    const runbook = join(
      ROOT,
      "docs/mokxya-ai/releases/OPERATOR_RUNBOOK_LAUNCH_V1.md",
    );
    expect(existsSync(runbook)).toBe(true);
    const text = readFileSync(runbook, "utf8");
    expect(text).toContain("Rollback");
    expect(text.toLowerCase()).toContain("abstain");
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-d4/SIGN_NOTE.md"))).toBe(
      true,
    );
  });
});
