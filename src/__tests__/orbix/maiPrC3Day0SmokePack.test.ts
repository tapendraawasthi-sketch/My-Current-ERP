import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAY0_SMOKE_PACK_ADR,
  PACK_READY,
  PRODUCTION_APPROVED,
  SMOKE_PASS,
  SMOKE_STATUS,
  day0SmokePackSnapshot,
  isDay0SmokePass,
} from "@/platform/release/day0SmokePackPolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-C3 Day-0 smoke pack", () => {
  it("keeps smoke NOT_RUN and pass false", () => {
    const snap = day0SmokePackSnapshot();
    expect(snap.authority).toBe(DAY0_SMOKE_PACK_ADR);
    expect(snap.authority).toBe("ADR_0093");
    expect(snap.step).toBe("PR-C3-PACK");
    expect(snap.packReady).toBe(true);
    expect(PACK_READY).toBe(true);
    expect(snap.smokeStatus).toBe("NOT_RUN");
    expect(SMOKE_STATUS).toBe("NOT_RUN");
    expect(snap.smokePass).toBe(false);
    expect(SMOKE_PASS).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(isDay0SmokePass()).toBe(false);
  });

  it("ships checklist and report template", () => {
    const report = join(
      ROOT,
      "docs/mokxya-ai/releases/DAY0_PRODUCTION_SMOKE_V1.md",
    );
    expect(existsSync(report)).toBe(true);
    const text = readFileSync(report, "utf8");
    expect(text).toContain("NOT_RUN");
    expect(text).toContain("Rollback");
    expect(
      existsSync(join(ROOT, "artifacts/prod-ready-pr-c3/SMOKE_CHECKLIST.md")),
    ).toBe(true);
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-c3/SIGN_NOTE.md"))).toBe(
      true,
    );
  });
});
