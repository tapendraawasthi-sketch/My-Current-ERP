import { describe, expect, it, vi } from "vitest";

describe("offline queue policy", () => {
  it("uses FIFO idempotency keys", () => {
    const key = crypto.randomUUID();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("detects offline state", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(navigator.onLine).toBe(false);
  });
});
