import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FULL_TSC_GREEN_CLAIMED,
  HYGIENE_GATE_ADR,
  INVOICE_PRINT_SYNTAX_FIXED,
  PRODUCTION_APPROVED,
  VACUOUS_GREENS_ALLOWED,
  hygieneGateSnapshot,
} from "@/platform/hygiene/hygieneGatePolicy";

const ROOT = join(__dirname, "../../..");

describe("PR-B6 hygiene gate", () => {
  it("declares honest freeze and InvoicePrint syntax fixed", () => {
    const snap = hygieneGateSnapshot();
    expect(snap.authority).toBe(HYGIENE_GATE_ADR);
    expect(snap.authority).toBe("ADR_0089");
    expect(snap.step).toBe("PR-B6");
    expect(snap.invoicePrintSyntaxFixed).toBe(true);
    expect(INVOICE_PRINT_SYNTAX_FIXED).toBe(true);
    expect(snap.fullTscGreenClaimed).toBe(false);
    expect(FULL_TSC_GREEN_CLAIMED).toBe(false);
    expect(snap.vacuousGreensAllowed).toBe(false);
    expect(VACUOUS_GREENS_ALLOWED).toBe(false);
    expect(snap.gapP1005RegisterStatus).toBe("REDUCED");
    expect(snap.gapP2004RegisterStatus).toBe("REDUCED");
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("ships runnable CI substitute scripts", () => {
    expect(existsSync(join(ROOT, "scripts/run_prod_ready_hygiene.sh"))).toBe(true);
    expect(existsSync(join(ROOT, "scripts/run_prod_ready_hygiene.ps1"))).toBe(true);
    expect(existsSync(join(ROOT, "scripts/run_prod_ready_orbix_vitest.mjs"))).toBe(true);
    expect(
      existsSync(join(ROOT, "erp_bot/scripts/run_prod_ready_honesty_pytest.py")),
    ).toBe(true);
    expect(existsSync(join(ROOT, ".github/workflows/prod-ready-hygiene.yml"))).toBe(
      true,
    );
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["test:prod-ready-honesty"]).toBeTruthy();
    expect(pkg.scripts["test:prod-ready-orbix"]).toBeTruthy();
    expect(pkg.scripts["test:e2e:orbix-launch-slice"]).toBeTruthy();
  });
});
