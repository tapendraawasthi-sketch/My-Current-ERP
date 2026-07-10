import { describe, expect, it } from "vitest";
import { resolveInitFailureState } from "@/lib/ledger/initFailurePolicy";
import { isW1FlagEnabled, setW1FlagOverride, clearW1FlagOverrides } from "@/platform/flags/w1Registry";

describe("init integration", () => {
  it("default Wave 1 flags enable fail-closed init and period lock enforcement", () => {
    clearW1FlagOverrides();
    expect(isW1FlagEnabled("W1_FAIL_CLOSED_INIT")).toBe(true);
    expect(isW1FlagEnabled("W1_PERIOD_LOCK_ENFORCE")).toBe(true);
  });

  it("fail-closed init leaves writes disabled via isDbReady=false", () => {
    clearW1FlagOverrides();
    setW1FlagOverride("W1_FAIL_CLOSED_INIT", true);
    const failure = resolveInitFailureState(new Error("DB open failed"));
    expect(failure.isDbReady).toBe(false);
    expect(failure.authStage).toBe("error");
    expect(failure.initLifecycle).toBe("fatal-error");
  });
});
