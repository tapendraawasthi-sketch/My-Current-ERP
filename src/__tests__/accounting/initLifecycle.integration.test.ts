import { describe, expect, it } from "vitest";
import {
  INIT_APP_TIMEOUT_MS,
  recoverableDataLoadPatch,
  readyInitPatch,
  resolveInitFailureState,
} from "@/lib/ledger/initLifecycle";
import { clearW1FlagOverrides, setW1FlagOverride } from "@/platform/flags/w1Registry";

describe("init lifecycle integration", () => {
  it("uses a single startup timeout constant (15s)", () => {
    expect(INIT_APP_TIMEOUT_MS).toBe(15000);
  });

  it("maps fatal init failures to fatal-error lifecycle", () => {
    clearW1FlagOverrides();
    setW1FlagOverride("W1_FAIL_CLOSED_INIT", true);
    const failure = resolveInitFailureState(new Error("SUTRA_INIT_TIMEOUT"));
    expect(failure.initLifecycle).toBe("fatal-error");
    expect(failure.isDbReady).toBe(false);
    expect(failure.authStage).toBe("error");
  });

  it("readyInitPatch marks ready with isDbReady true", () => {
    const patch = readyInitPatch();
    expect(patch.initLifecycle).toBe("ready");
    expect(patch.isDbReady).toBe(true);
    expect(patch.isInitializing).toBe(false);
  });

  it("recoverableDataLoadPatch keeps isDbReady true with recoverable-error lifecycle", () => {
    const patch = recoverableDataLoadPatch();
    expect(patch.initLifecycle).toBe("recoverable-error");
    expect(patch.isDbReady).toBe(true);
    expect(patch.dataLoadWarning).toMatch(/could not be loaded/i);
  });

  it("legacy permissive init returns ready lifecycle when flag is off", () => {
    clearW1FlagOverrides();
    setW1FlagOverride("W1_FAIL_CLOSED_INIT", false);
    const failure = resolveInitFailureState(new Error("IndexedDB blocked"));
    expect(failure.initLifecycle).toBe("ready");
    expect(failure.isDbReady).toBe(true);
  });
});
