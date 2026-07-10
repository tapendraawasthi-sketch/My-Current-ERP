import { beforeEach, describe, expect, it } from "vitest";
import { resolveInitFailureState } from "@/lib/ledger/initFailurePolicy";
import { clearW1FlagOverrides, setW1FlagOverride } from "@/platform/flags/w1Registry";

describe("initFailurePolicy", () => {
  beforeEach(() => {
    clearW1FlagOverrides();
  });

  it("uses legacy permissive init when W1_FAIL_CLOSED_INIT is false", () => {
    setW1FlagOverride("W1_FAIL_CLOSED_INIT", false);
    const result = resolveInitFailureState(new Error("IndexedDB blocked"));
    expect(result.authStage).toBe("no-company");
    expect(result.isDbReady).toBe(true);
    expect(result.initLifecycle).toBe("ready");
    expect(result.initError).toBeNull();
  });

  it("blocks startup when W1_FAIL_CLOSED_INIT is true", () => {
    setW1FlagOverride("W1_FAIL_CLOSED_INIT", true);
    const result = resolveInitFailureState(new Error("IndexedDB blocked"));
    expect(result.authStage).toBe("error");
    expect(result.isDbReady).toBe(false);
    expect(result.initLifecycle).toBe("fatal-error");
    expect(result.initError?.message).toContain("IndexedDB blocked");
    expect(result.initError?.code).toBe("Error");
  });

  it("preserves unknown errors with default message", () => {
    setW1FlagOverride("W1_FAIL_CLOSED_INIT", true);
    const result = resolveInitFailureState(undefined);
    expect(result.authStage).toBe("error");
    expect(result.initError?.message).toBe("Application initialization failed.");
  });
});
