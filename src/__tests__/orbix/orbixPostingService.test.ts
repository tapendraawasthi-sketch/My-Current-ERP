import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  buildIdempotencyKey,
  clearOrbixPostingIdempotencyForTests,
  executeOrbixConfirm,
} from "../../lib/ekhata/orbixPostingService";
import type { KhataConfirmationCard } from "../../lib/ekhata/types";

vi.mock("@/domains/purchase/postPurchaseTransaction", async () => {
  const actual = await vi.importActual<typeof import("@/domains/purchase/postPurchaseTransaction")>(
    "@/domains/purchase/postPurchaseTransaction",
  );
  return {
    ...actual,
    resolveInventoryItemForPurchase: vi.fn(async () => null),
    postPurchaseTransaction: vi.fn(),
  };
});

const sampleCard = (): KhataConfirmationCard => ({
  intent: "khata_expense",
  party: null,
  amount: 500,
  item: "Tea",
  date: "2026-07-12",
  raw_text: "expense tea 500",
  draft_id: "draft-exp",
  preview_hash: "hash-abc",
  preview_version: 1,
  idempotency_key: "idem-exp-1",
  journalLines: [
    {
      accountCode: "KH-EXP",
      accountName: "Expense",
      accountClass: "expense",
      debit: 500,
      credit: 0,
    },
    {
      accountCode: "KH-CASH",
      accountName: "Cash",
      accountClass: "asset",
      debit: 0,
      credit: 500,
    },
  ],
});

describe("executeOrbixConfirm gates", () => {
  beforeEach(() => {
    clearOrbixPostingIdempotencyForTests();
  });

  it("rejects Ask mode without posting", async () => {
    const result = await executeOrbixConfirm({
      requestId: "r1",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-abc",
      companyId: "co-1",
      orbixMode: "ask",
      idempotencyKey: "k1",
      confirmation: true,
      card: sampleCard(),
      userRole: "admin",
    });
    expect(result.response_type).toBe("permission_denied");
    expect(result.payload.error_code).toBe("mode_restriction");
  });

  it("rejects unauthorized role", async () => {
    const result = await executeOrbixConfirm({
      requestId: "r2",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-abc",
      companyId: "co-1",
      orbixMode: "accountant",
      idempotencyKey: "k2",
      confirmation: true,
      card: sampleCard(),
      userRole: "viewer",
    });
    expect(result.response_type).toBe("permission_denied");
    expect(result.payload.error_code).toBe("permission_denied");
  });

  it("rejects stale preview hash mismatch", async () => {
    const card = sampleCard();
    const result = await executeOrbixConfirm({
      requestId: "r3",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-OLD",
      companyId: "co-1",
      orbixMode: "accountant",
      idempotencyKey: "k3",
      confirmation: true,
      card,
      userRole: "admin",
    });
    expect(result.response_type).toBe("validation_error");
    expect(result.payload.error_code).toBe("stale_preview");
  });

  it("supports injected failure after validation", async () => {
    const result = await executeOrbixConfirm({
      requestId: "r4",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-abc",
      companyId: "co-1",
      orbixMode: "accountant",
      idempotencyKey: "k4",
      confirmation: true,
      card: sampleCard(),
      userRole: "admin",
      injectFailure: "after_validation",
    });
    expect(result.response_type).toBe("posting_failed");
    expect(result.payload.rolled_back).toBe(true);
  });

  it("builds stable idempotency keys", () => {
    const a = buildIdempotencyKey({ draftId: "d1", previewHash: "h1" });
    const b = buildIdempotencyKey({ draftId: "d1", previewHash: "h1" });
    expect(a).toBe(b);
  });

  it("requires inventory classification for purchase without seeded item", async () => {
    const purchaseCard: KhataConfirmationCard = {
      ...sampleCard(),
      intent: "khata_purchase",
      item: "Bike",
      amount: 50000,
      raw_text: "I bought a bike. 1, 50000 cash",
    };
    const result = await executeOrbixConfirm({
      requestId: "r5",
      conversationId: "c1",
      draftId: "draft-bike",
      draftVersion: 2,
      previewVersion: 2,
      previewHash: "hash-abc",
      companyId: "co-1",
      orbixMode: "accountant",
      idempotencyKey: "k5",
      confirmation: true,
      card: purchaseCard,
      userRole: "admin",
    });
    expect(result.response_type).toBe("validation_error");
    expect(result.payload.error_code).toBe("classification_required");
  });
});
