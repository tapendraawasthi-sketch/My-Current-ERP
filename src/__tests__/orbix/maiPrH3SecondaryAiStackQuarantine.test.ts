import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELETION_IN_THIS_SHIP,
  DISPOSITION,
  GAP_P1_001_CLOSED,
  PRIMARY_CHAT_ROUTE,
  PRODUCTION_APPROVED,
  SECONDARY_AI_STACK_QUARANTINE_ADR,
  secondaryAiStackQuarantineSnapshot,
} from "@/platform/release/secondaryAiStackQuarantinePolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-H3 secondary AI stack quarantine", () => {
  it("keeps quarantine non-prod and gap not closed", () => {
    const snap = secondaryAiStackQuarantineSnapshot();
    expect(snap.authority).toBe(SECONDARY_AI_STACK_QUARANTINE_ADR);
    expect(snap.authority).toBe("ADR_0094");
    expect(snap.step).toBe("PR-H3");
    expect(snap.disposition).toBe(DISPOSITION);
    expect(snap.primaryChatRoute).toBe(PRIMARY_CHAT_ROUTE);
    expect(snap.deletionInThisShip).toBe(false);
    expect(DELETION_IN_THIS_SHIP).toBe(false);
    expect(snap.gapP1001Closed).toBe(false);
    expect(GAP_P1_001_CLOSED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("ships registry and artifacts", () => {
    const reg = join(
      ROOT,
      "docs/mokxya-ai/MAI_SECONDARY_AI_STACK_QUARANTINE_REGISTRY.json",
    );
    expect(existsSync(reg)).toBe(true);
    const data = JSON.parse(readFileSync(reg, "utf8"));
    expect(data.deletion_in_this_ship).toBe(false);
    expect(data.gap_p1_001.closed).toBe(false);
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-h3/SIGN_NOTE.md"))).toBe(
      true,
    );
  });
});
