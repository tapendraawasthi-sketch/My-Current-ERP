/**
 * MAI-01 — Ask Mode presentation must not allow confirm/mutation controls.
 */
import { describe, expect, it } from "vitest";
import { getPresentationMeta, mayShowConfirmControl } from "@/features/orbix/presentation";
import type { OrbixResponse } from "@/lib/ekhata/orbixResponseTypes";

describe("MAI-01 orbix presentation policy cues", () => {
  it("mode_restriction never allows confirm", () => {
    const meta = getPresentationMeta({
      response_type: "mode_restriction",
    } as OrbixResponse);
    expect(meta.allowsConfirm).toBe(false);
    expect(meta.allowsMutation).toBe(false);
  });

  it("permission_denied never allows confirm", () => {
    const meta = getPresentationMeta({
      response_type: "permission_denied",
    } as OrbixResponse);
    expect(meta.allowsConfirm).toBe(false);
  });

  it("confirmation_required allowsConfirm for UI but posting still gated by executeOrbixConfirm", () => {
    const meta = getPresentationMeta({
      response_type: "confirmation_required",
    } as OrbixResponse);
    expect(meta.allowsConfirm).toBe(true);
    expect(meta.allowsMutation).toBe(false);
  });

  it("mayShowConfirmControl denies Ask Mode", () => {
    const meta = getPresentationMeta({
      response_type: "confirmation_required",
    } as OrbixResponse);
    expect(mayShowConfirmControl(meta, "ask")).toBe(false);
    expect(mayShowConfirmControl(meta, "accountant")).toBe(true);
  });
});
