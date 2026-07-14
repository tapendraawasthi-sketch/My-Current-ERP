/**
 * Phase UI-5 — Home workspace / quick-action / format unit tests (no browser).
 */
import { describe, expect, it } from "vitest";
import { getDefaultPermissionsForRole } from "@/lib/permissions";
import {
  resolveWorkspaces,
  WORKSPACE_METRICS,
} from "@/features/home/roleWorkspace";
import {
  selectQuickActions,
  QUICK_ACTION_REGISTRY,
} from "@/features/home/quickActions";
import { formatHomeAmount } from "@/features/home/format";

describe("resolveWorkspaces", () => {
  it("maps owner", () => {
    expect(resolveWorkspaces("owner").primary).toBe("owner");
    expect(resolveWorkspaces("owner").all).toEqual(["owner"]);
  });

  it("maps accountant", () => {
    expect(resolveWorkspaces("accountant").primary).toBe("accountant");
  });

  it("maps cashier", () => {
    expect(resolveWorkspaces("cashier").primary).toBe("cashier");
  });

  it("maps banking", () => {
    expect(resolveWorkspaces("banking").primary).toBe("banking");
  });

  it("maps inventory", () => {
    expect(resolveWorkspaces("inventory").primary).toBe("inventory");
  });

  it("maps auditor", () => {
    expect(resolveWorkspaces("auditor").primary).toBe("auditor");
  });

  it("maps admin to administrator", () => {
    expect(resolveWorkspaces("admin").primary).toBe("administrator");
    expect(resolveWorkspaces("administrator").primary).toBe("administrator");
  });

  it("maps viewer / unknown to restricted", () => {
    expect(resolveWorkspaces("viewer").primary).toBe("restricted");
    expect(resolveWorkspaces("").primary).toBe("restricted");
  });

  it("maps combined multi-hint roles", () => {
    const ws = resolveWorkspaces("accountant+cashier");
    expect(ws.primary).toBe("combined");
    expect(ws.all).toEqual(expect.arrayContaining(["accountant", "cashier"]));
    expect(ws.label).toBe("Combined workspace");
  });
});

describe("selectQuickActions", () => {
  it("cashier gets sale and receipt when create is allowed", () => {
    // getDefaultPermissionsForRole has no cashier case; accountant template grants create.
    const profile = getDefaultPermissionsForRole("accountant", "u-cashier");
    const actions = selectQuickActions(["cashier"], profile, false);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("new_sale");
    expect(ids).toContain("receive_money");
  });

  it("auditor defaults yield no requireCreate actions; ask_orbix present", () => {
    const profile = getDefaultPermissionsForRole("auditor", "u-auditor");
    const actions = selectQuickActions(["auditor"], profile, false);
    expect(actions.every((a) => !a.requireCreate)).toBe(true);
    expect(actions.some((a) => a.id === "ask_orbix")).toBe(true);
  });

  it("ask_orbix present for owner defaults", () => {
    const profile = getDefaultPermissionsForRole("manager", "u-owner");
    const actions = selectQuickActions(["owner"], profile, true);
    expect(actions.some((a) => a.id === "ask_orbix")).toBe(true);
  });
});

describe("WORKSPACE_METRICS permissions (cashier)", () => {
  it("cashier metric list does not include net_result", () => {
    expect(WORKSPACE_METRICS.cashier).not.toContain("net_result");
    expect(WORKSPACE_METRICS.cashier).not.toContain("inventory_value");
    expect(WORKSPACE_METRICS.cashier).toContain("todays_sales");
  });
});

describe("formatHomeAmount", () => {
  it("null / undefined / NaN → em dash", () => {
    expect(formatHomeAmount(null)).toBe("—");
    expect(formatHomeAmount(undefined)).toBe("—");
    expect(formatHomeAmount(Number.NaN)).toBe("—");
  });

  it("negative uses parentheses", () => {
    expect(formatHomeAmount(-1234.5)).toMatch(/\(.*\)/);
    expect(formatHomeAmount(-10, "Rs.")).toContain("Rs.");
  });
});

describe("QUICK_ACTION_REGISTRY navigation-only contract", () => {
  it("every action has a page navigation target and no mutation flags", () => {
    for (const action of QUICK_ACTION_REGISTRY) {
      expect(action.page, action.id).toBeTruthy();
      expect(typeof action.page).toBe("string");
      const record = action as unknown as Record<string, unknown>;
      expect(record.posts).toBeUndefined();
      expect(record.mutate).toBeUndefined();
      expect(record.commit).toBeUndefined();
      expect(record.postVoucher).toBeUndefined();
      expect(record.mutation).toBeUndefined();
    }
  });
});
