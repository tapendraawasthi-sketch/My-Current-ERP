import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEAD_PARALLEL_AI_QUARANTINE_ADR,
  DELETION_IN_THIS_SHIP,
  GAP_P1_001_CLOSED,
  GAP_P3_001_CLOSED,
  PRIMARY_CHAT_ROUTE,
  PRODUCTION_APPROVED,
  QUARANTINED_FALCON_ORPHAN_UI,
  deadParallelAiQuarantineSnapshot,
} from "@/platform/hygiene/deadParallelAiQuarantinePolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-H3 dead parallel AI quarantine", () => {
  it("keeps quarantine honesty (no delete / no CLOSED gaps / no prod approve)", () => {
    const snap = deadParallelAiQuarantineSnapshot();
    expect(snap.authority).toBe(DEAD_PARALLEL_AI_QUARANTINE_ADR);
    expect(snap.authority).toBe("ADR_0094");
    expect(snap.step).toBe("PR-H3");
    expect(snap.primaryChatRoute).toBe(PRIMARY_CHAT_ROUTE);
    expect(snap.deletionInThisShip).toBe(false);
    expect(DELETION_IN_THIS_SHIP).toBe(false);
    expect(snap.gapP1001Closed).toBe(false);
    expect(GAP_P1_001_CLOSED).toBe(false);
    expect(snap.gapP3001Closed).toBe(false);
    expect(GAP_P3_001_CLOSED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(QUARANTINED_FALCON_ORPHAN_UI.length).toBe(3);
  });

  it("ships registry, artifacts, and orphan Falcon files on disk", () => {
    const registry = join(
      ROOT,
      "docs/mokxya-ai/MAI_SECONDARY_AI_STACK_QUARANTINE_REGISTRY.json",
    );
    expect(existsSync(registry)).toBe(true);
    const reg = JSON.parse(readFileSync(registry, "utf8"));
    expect(reg.authority).toBe("ADR_0094");
    expect(reg.deletion_in_this_ship).toBe(false);
    expect(reg.falcon_orphan_ui.length).toBeGreaterThanOrEqual(3);
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-h3/RUN_STATUS.json"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-h3/SIGN_NOTE.md"))).toBe(
      true,
    );
    for (const path of QUARANTINED_FALCON_ORPHAN_UI) {
      expect(existsSync(join(ROOT, path))).toBe(true);
    }
  });
});
