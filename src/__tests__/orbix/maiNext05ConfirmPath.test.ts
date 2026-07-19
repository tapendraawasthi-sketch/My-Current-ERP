import { describe, expect, it, beforeEach } from "vitest";
import {
  clearConfirmTokensForTests,
  confirmPathHonestySnapshot,
  consumeConfirmToken,
  mintConfirmToken,
  nlAssentMayPost,
  postingSuccessHasReceipt,
  validateConfirmToken,
  CONFIRM_PATH_ADR,
  NL_ASSENT_POSTS,
  PRODUCT_MUTATION_PATH,
} from "@/lib/ekhata/confirmPathAuthority";
import {
  clearOrbixPostingIdempotencyForTests,
  executeOrbixConfirm,
} from "@/lib/ekhata/orbixPostingService";
import type { KhataConfirmationCard } from "@/lib/ekhata/types";

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

describe("NEXT-05 confirm path honesty", () => {
  beforeEach(() => {
    clearConfirmTokensForTests();
    clearOrbixPostingIdempotencyForTests();
  });

  it("declares Model B token honesty snapshot", () => {
    const snap = confirmPathHonestySnapshot();
    expect(snap.authority).toBe(CONFIRM_PATH_ADR);
    expect(snap.productMutationPath).toBe(PRODUCT_MUTATION_PATH);
    expect(snap.nlAssentPosts).toBe(false);
    expect(NL_ASSENT_POSTS).toBe(false);
    expect(snap.aiConfirmOecIsAuthority).toBe(false);
    expect(nlAssentMayPost("yes")).toBe(false);
    expect(nlAssentMayPost("हो")).toBe(false);
  });

  it("denies missing confirm token", async () => {
    const result = await executeOrbixConfirm({
      requestId: "r-missing",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-abc",
      companyId: "co-1",
      orbixMode: "accountant",
      idempotencyKey: "k-missing",
      confirmation: true,
      card: sampleCard(),
      userRole: "admin",
    });
    expect(result.response_type).toBe("validation_error");
    expect(result.payload.error_code).toBe("confirm_token_required");
  });

  it("denies wrong tenant / company", async () => {
    const token = mintConfirmToken({
      companyId: "co-1",
      draftId: "draft-exp",
      previewHash: "hash-abc",
    });
    const result = await executeOrbixConfirm({
      requestId: "r-tenant",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-abc",
      companyId: "co-OTHER",
      orbixMode: "accountant",
      idempotencyKey: "k-tenant",
      confirmation: true,
      confirmToken: token,
      card: { ...sampleCard(), confirm_token: token },
      userRole: "admin",
    });
    expect(result.response_type).toBe("validation_error");
    expect(result.payload.error_code).toBe("confirm_token_tenant_mismatch");
  });

  it("fails token reuse", () => {
    const token = mintConfirmToken({
      companyId: "co-1",
      draftId: "draft-exp",
      previewHash: "hash-abc",
    });
    const bind = {
      companyId: "co-1",
      draftId: "draft-exp",
      previewHash: "hash-abc",
    };
    expect(consumeConfirmToken(token, bind).ok).toBe(true);
    const reuse = validateConfirmToken(token, bind);
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.error_code).toBe("confirm_token_reuse");
  });

  it("requires receipt surfaces for success claims", () => {
    expect(
      postingSuccessHasReceipt({
        posting_id: "req-1",
        voucher_number: "JV-1",
      }),
    ).toBe(true);
    expect(
      postingSuccessHasReceipt({
        posting_id: "req-1",
      }),
    ).toBe(false);
  });

  it("does not burn token on mode restriction", async () => {
    const token = mintConfirmToken({
      companyId: "co-1",
      draftId: "draft-exp",
      previewHash: "hash-abc",
    });
    const result = await executeOrbixConfirm({
      requestId: "r-mode",
      conversationId: "c1",
      draftId: "draft-exp",
      draftVersion: 2,
      previewVersion: 1,
      previewHash: "hash-abc",
      companyId: "co-1",
      orbixMode: "ask",
      idempotencyKey: "k-mode",
      confirmation: true,
      confirmToken: token,
      card: { ...sampleCard(), confirm_token: token },
      userRole: "admin",
    });
    expect(result.payload.error_code).toBe("mode_restriction");
    expect(
      validateConfirmToken(token, {
        companyId: "co-1",
        draftId: "draft-exp",
        previewHash: "hash-abc",
      }).ok,
    ).toBe(true);
  });
});
