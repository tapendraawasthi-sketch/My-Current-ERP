import { describe, expect, it } from "vitest";
import {
  BUSINESS_NATURES,
  applyNatureToCompanySettings,
  getNatureProfile,
  isBusinessNatureId,
} from "../../lib/businessNature";
import { filterNavForRole } from "../../components/shell/shellNavVisibility";

describe("businessNature catalog", () => {
  it("lists 40 Nepal business natures", () => {
    expect(BUSINESS_NATURES).toHaveLength(40);
    expect(isBusinessNatureId("retail_trading")).toBe(true);
    expect(isBusinessNatureId("not-a-nature")).toBe(false);
  });

  it("applies retail flags including POS", () => {
    const next = applyNatureToCompanySettings({ name: "Demo" }, "retail_trading");
    expect(next.businessNature).toBe("retail_trading");
    expect(next.enablePOS).toBe(true);
    expect(next.enableInventory).toBe(true);
  });

  it("hides POS for professional services in nav", () => {
    const nav = filterNavForRole("admin", {
      businessNature: "professional_services",
      enableInventory: false,
      enablePOS: false,
    });
    const pages = nav.flatMap((g) => g.items.map((i) => i.page));
    expect(pages).not.toContain("pos-billing");
    expect(pages).toContain("settings");
    expect(pages).toContain("company-features");
  });

  it("keeps settings reachable for finance natures", () => {
    const profile = getNatureProfile("microfinance");
    expect(profile.nav.hiddenGroups).toContain("inventory");
    const nav = filterNavForRole("owner", {
      businessNature: "microfinance",
      ...profile.features,
    });
    expect(nav.some((g) => g.id === "administration")).toBe(true);
  });
});
