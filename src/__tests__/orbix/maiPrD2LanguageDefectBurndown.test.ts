import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSERTION_WEAKENING_ALLOWED,
  DEFECTS_COLLECTED,
  LANGUAGE_DEFECT_BURNDOWN_ADR,
  PACK_READY,
  PRODUCTION_APPROVED,
  languageDefectBurndownSnapshot,
} from "@/platform/release/languageDefectBurndownPolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-D2 language defect burn-down pack", () => {
  it("keeps pack ready without claiming defects collected", () => {
    const snap = languageDefectBurndownSnapshot();
    expect(snap.authority).toBe(LANGUAGE_DEFECT_BURNDOWN_ADR);
    expect(snap.step).toBe("PR-D2");
    expect(snap.packReady).toBe(true);
    expect(PACK_READY).toBe(true);
    expect(snap.defectsCollected).toBe(false);
    expect(DEFECTS_COLLECTED).toBe(false);
    expect(snap.assertionWeakeningAllowed).toBe(false);
    expect(ASSERTION_WEAKENING_ALLOWED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("ships procedure and artifacts", () => {
    const doc = join(
      ROOT,
      "docs/mokxya-ai/releases/LANGUAGE_DEFECT_BURNDOWN_V1.md",
    );
    expect(existsSync(doc)).toBe(true);
    const text = readFileSync(doc, "utf8");
    expect(text.toLowerCase()).toContain("weaken");
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-d2/SIGN_NOTE.md"))).toBe(
      true,
    );
  });
});
