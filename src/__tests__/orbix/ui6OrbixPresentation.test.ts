/**
 * Phase UI-6 — Orbix presentation / sync-label unit tests (no browser).
 */
import { describe, expect, it } from "vitest";
import {
  confirmButtonLabel,
  getPresentationMeta,
  syncStatusPresentation,
} from "@/features/orbix/presentation";
import type { OrbixResponse } from "@/lib/ekhata/orbixResponseTypes";

describe("syncStatusPresentation", () => {
  it("never invents synced for unknown", () => {
    expect(syncStatusPresentation(undefined).testId).not.toBe("synced");
    expect(syncStatusPresentation(null).testId).not.toBe("synced");
    expect(syncStatusPresentation("pending").testId).toBe("pending");
  });

  it("maps authoritative statuses", () => {
    expect(syncStatusPresentation("synced").testId).toBe("synced");
    expect(syncStatusPresentation("failed").testId).toBe("failed");
    expect(syncStatusPresentation("conflict").testId).toBe("conflict");
    expect(syncStatusPresentation("disabled").testId).toBe("local_only");
  });
});

describe("getPresentationMeta", () => {
  it("Ask Mode restriction cannot confirm or mutate", () => {
    const response = {
      schema_version: "1.0",
      response_type: "mode_restriction",
      status: "requires_input",
      display: { text: "Ask Mode", tone: "professional" },
      actions: [],
      payload: {
        requested_operation: "transaction_create",
        required_mode: "accountant",
        current_mode: "ask",
        can_preview: true,
        can_explain: true,
        original_request_preserved: true,
      },
    } as OrbixResponse;
    const meta = getPresentationMeta(response);
    expect(meta.allowsConfirm).toBe(false);
    expect(meta.allowsMutation).toBe(false);
    expect(meta.trust).toBe("restricted");
  });

  it("clarification cannot post", () => {
    const response = {
      schema_version: "1.0",
      response_type: "clarification_required",
      status: "requires_input",
      display: { text: "Need more", tone: "professional" },
      actions: [],
      payload: {
        draft_id: "d1",
        transaction_type: "sales",
        draft_status: "awaiting_clarification",
        captured_fields: [],
        missing_fields: [],
        ambiguous_fields: [],
        nothing_posted: true,
      },
    } as OrbixResponse;
    const meta = getPresentationMeta(response);
    expect(meta.allowsConfirm).toBe(false);
    expect(meta.trust).toBe("clarification");
  });

  it("posting_completed trust follows sync_status", () => {
    const base = {
      schema_version: "1.0" as const,
      response_type: "posting_completed" as const,
      status: "success" as const,
      display: { text: "Posted", tone: "professional" as const },
      actions: [],
      payload: {
        draft_id: "d1",
        posting_id: "p1",
        voucher_number: "JV-1",
        posted_at: new Date().toISOString(),
        idempotent_replay: false,
      },
    };
    expect(getPresentationMeta({ ...base, payload: { ...base.payload } } as OrbixResponse).trust).toBe(
      "pending_sync",
    );
    expect(
      getPresentationMeta({
        ...base,
        payload: { ...base.payload, sync_status: "synced" },
      } as OrbixResponse).trust,
    ).toBe("synced");
    expect(
      getPresentationMeta({
        ...base,
        payload: { ...base.payload, sync_status: "conflict" },
      } as OrbixResponse).trust,
    ).toBe("conflict");
  });
});

describe("confirmButtonLabel", () => {
  it("uses operation-specific labels", () => {
    expect(confirmButtonLabel("khata_cash_sale")).toBe("Post Sales Invoice");
    expect(confirmButtonLabel("customer_receipt")).toMatch(/Receive|Receipt/i);
    expect(confirmButtonLabel("supplier_payment")).toMatch(/Payment/i);
    expect(confirmButtonLabel("general_journal")).toMatch(/Journal/i);
  });

  it("does not use generic yes", () => {
    expect(confirmButtonLabel("khata_purchase").toLowerCase()).not.toBe("yes");
    expect(confirmButtonLabel("khata_purchase").toLowerCase()).not.toBe("ok");
  });
});
