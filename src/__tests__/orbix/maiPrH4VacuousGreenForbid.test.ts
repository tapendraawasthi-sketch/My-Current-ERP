import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSERTION_WEAKENING_ALLOWED,
  GOVERNED_CONTRACT_MODULES,
  LEGACY_SCORERS_ALL_REWRITTEN,
  PRODUCTION_APPROVED,
  VACUOUS_GREEN_FORBID_ADR,
  VACUOUS_GREENS_ALLOWED,
  vacuousGreenForbidSnapshot,
} from "@/platform/hygiene/vacuousGreenForbidPolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-H4 vacuous green forbid", () => {
  it("keeps honesty flags false", () => {
    const snap = vacuousGreenForbidSnapshot();
    expect(snap.authority).toBe(VACUOUS_GREEN_FORBID_ADR);
    expect(snap.authority).toBe("ADR_0095");
    expect(snap.step).toBe("PR-H4");
    expect(snap.vacuousGreensAllowed).toBe(false);
    expect(VACUOUS_GREENS_ALLOWED).toBe(false);
    expect(snap.assertionWeakeningAllowed).toBe(false);
    expect(ASSERTION_WEAKENING_ALLOWED).toBe(false);
    expect(snap.legacyScorersAllRewritten).toBe(false);
    expect(LEGACY_SCORERS_ALL_REWRITTEN).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
    expect(GOVERNED_CONTRACT_MODULES.length).toBeGreaterThanOrEqual(5);
  });

  it("ships registry, artifacts, and governed contracts on disk", () => {
    const registry = join(
      ROOT,
      "docs/mokxya-ai/MAI_VACUOUS_GREEN_FORBID_REGISTRY.json",
    );
    expect(existsSync(registry)).toBe(true);
    const reg = JSON.parse(readFileSync(registry, "utf8"));
    expect(reg.authority).toBe("ADR_0095");
    expect(reg.honesty.vacuous_greens_allowed).toBe(false);
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-h4/RUN_STATUS.json"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "artifacts/prod-ready-pr-h4/SIGN_NOTE.md"))).toBe(
      true,
    );
    for (const path of GOVERNED_CONTRACT_MODULES) {
      expect(existsSync(join(ROOT, path))).toBe(true);
      const text = readFileSync(join(ROOT, path), "utf8");
      expect(text).toContain("No max(1, denominator)");
      expect(text).toContain("INVALID_REQUIRED_POPULATION");
    }
  });
});
