import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ERROR_BUDGET_INCIDENT_LOOP_ADR,
  FOURTEEN_DAY_STABLE,
  PACK_READY,
  PRODUCTION_APPROVED,
  WEEKLY_REVIEWS_EXECUTED,
  errorBudgetIncidentLoopSnapshot,
} from "@/platform/release/errorBudgetIncidentLoopPolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-D1 error budget incident loop pack", () => {
  it("keeps pack ready without claiming 14-day stable", () => {
    const snap = errorBudgetIncidentLoopSnapshot();
    expect(snap.authority).toBe(ERROR_BUDGET_INCIDENT_LOOP_ADR);
    expect(snap.step).toBe("PR-D1");
    expect(snap.packReady).toBe(true);
    expect(PACK_READY).toBe(true);
    expect(snap.fourteenDayStable).toBe(false);
    expect(FOURTEEN_DAY_STABLE).toBe(false);
    expect(snap.weeklyReviewsExecuted).toBe(false);
    expect(WEEKLY_REVIEWS_EXECUTED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("ships loop doc and artifacts", () => {
    const doc = join(
      ROOT,
      "docs/mokxya-ai/releases/ERROR_BUDGET_INCIDENT_LOOP_V1.md",
    );
    expect(existsSync(doc)).toBe(true);
    const text = readFileSync(doc, "utf8");
    expect(text).toContain("Weekly loop");
    expect(text).toContain("P0");
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-d1/SIGN_NOTE.md"))).toBe(
      true,
    );
  });
});
