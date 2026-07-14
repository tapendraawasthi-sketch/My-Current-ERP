import { describe, expect, it } from "vitest";
import {
  lifecycleLabel,
  postActionLabel,
  syncStatusToLifecycle,
} from "@/features/transactions/status";

describe("UI-7 transaction status", () => {
  it("never invents synced from unknown", () => {
    expect(syncStatusToLifecycle(undefined)).toBe("posted_local");
    expect(syncStatusToLifecycle(null)).toBe("posted_local");
    expect(syncStatusToLifecycle("pending")).toBe("pending");
  });

  it("maps sync statuses distinctly", () => {
    expect(syncStatusToLifecycle("synced")).toBe("synced");
    expect(syncStatusToLifecycle("conflict")).toBe("conflict");
    expect(syncStatusToLifecycle("failed")).toBe("failed");
    expect(lifecycleLabel("conflict")).toMatch(/Conflict/i);
    expect(lifecycleLabel("pending")).not.toMatch(/Synced/i);
  });

  it("uses operation-specific post labels", () => {
    expect(postActionLabel("sales")).toBe("Post Sales Invoice");
    expect(postActionLabel("purchase")).toBe("Post Purchase Invoice");
    expect(postActionLabel("receipt")).toBe("Record Receipt");
    expect(postActionLabel("payment")).toBe("Record Payment");
    expect(postActionLabel("contra")).toBe("Post Contra");
    expect(postActionLabel("journal")).toBe("Post Journal Entry");
    expect(postActionLabel("sales", true)).toBe("Posting…");
  });
});
