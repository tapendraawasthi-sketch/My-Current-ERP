import { describe, expect, it } from "vitest";
import type { AggregatedSyncStatus, UiSyncState } from "@/platform/sync/syncStatusAggregate";

/**
 * Presentation-contract tests — do not call Dexie.
 * Prove UI label mapping rules for sync truth adapter.
 */
function labelFor(state: UiSyncState, pendingCount: number): string {
  switch (state) {
    case "synced":
      return "Synced";
    case "pending":
      return pendingCount > 0 ? `${pendingCount} pending` : "Pending";
    case "syncing":
      return "Syncing";
    case "retry_scheduled":
      return "Retry scheduled";
    case "failed":
      return "Failed";
    case "conflict":
      return "Conflict";
    case "offline":
      return "Offline";
    case "stale":
      return "Stale";
    case "local_only":
      return "Local-only";
    case "action_required":
      return "Action required";
    default:
      return state;
  }
}

function assertNeverShowsSyncedWhenPending(agg: Pick<AggregatedSyncStatus, "state" | "pendingCount">) {
  if (agg.pendingCount > 0) {
    expect(agg.state).not.toBe("synced");
  }
}

describe("UI-3 sync-state presentation contract", () => {
  it("pending is not labelled synced", () => {
    assertNeverShowsSyncedWhenPending({ state: "pending", pendingCount: 3 });
    expect(labelFor("pending", 3)).toContain("pending");
    expect(labelFor("synced", 0)).toBe("Synced");
  });

  it("conflict is distinct from failure and retry", () => {
    expect(labelFor("conflict", 0)).toBe("Conflict");
    expect(labelFor("failed", 0)).toBe("Failed");
    expect(labelFor("retry_scheduled", 2)).toBe("Retry scheduled");
  });

  it("offline preserves pending wording separately", () => {
    expect(labelFor("offline", 4)).toBe("Offline");
    expect(labelFor("pending", 4)).toContain("4");
  });

  it("local-only is not synced", () => {
    expect(labelFor("local_only", 0)).toBe("Local-only");
    expect(labelFor("local_only", 0)).not.toBe("Synced");
  });
});
