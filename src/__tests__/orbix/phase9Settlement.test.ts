import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  seedSettlementE2ECompany,
  seedE2ESalesInvoice,
  seedE2EPurchaseInvoice,
  E2E_COMPANY_ID,
  E2E_CUSTOMER_ID,
  E2E_SUPPLIER_ID,
  E2E_USER_AUTHORIZED,
  E2E_FY_ID,
} from "@/domains/settlement/e2eSeed";
import { postReceiptTransaction } from "@/domains/settlement/postReceiptTransaction";
import { postPaymentTransaction } from "@/domains/settlement/postPaymentTransaction";
import { postContraTransaction } from "@/domains/settlement/postContraTransaction";
import { postJournalTransaction } from "@/domains/settlement/postJournalTransaction";
import { getOrCreateDocumentSettlementState } from "@/domains/settlement/settlementState";

async function prepareDb() {
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  await db.fiscalYears.put({
    ...DEFAULT_FISCAL_YEAR,
    id: DEFAULT_FISCAL_YEAR.id || "fy-default",
    isCurrent: true,
  } as any);
  await seedSettlementE2ECompany();
  await db.fiscalYears.put({
    id: E2E_FY_ID || "fy-e2e-settlement",
    name: "E2E settlement FY",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  return getDB();
}

describe("Phase 9 settlement domain", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("partial customer receipt + allocation rebuilds paid projection", async () => {
    const db = getDB();
    const inv = await seedE2ESalesInvoice({ grandTotal: 11300, date: "2026-07-12" });
    const state = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);

    const result = await postReceiptTransaction({
      commandId: "rcpt-partial-1",
      requestId: "rcpt-partial-1",
      idempotencyKey: "rcpt-partial-1-idem",
      companyId: E2E_COMPANY_ID,
      financialYearId: E2E_FY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      receipt: {
        receiptType: "customer_receipt",
        transactionDate: "2026-07-12",
        partyId: E2E_CUSTOMER_ID,
        cashOrBankAccountId: "acc-cash",
        amount: "5000.00",
        allocations: [
          {
            document_id: inv.id,
            amount: "5000.00",
            expected_settlement_version: state.settlementVersion,
          },
        ],
        currency: "NPR",
        narration: "Partial receipt",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;

    const after = await db.invoices.get(inv.id);
    expect(Number(after?.paidAmount)).toBe(5000);
    expect(after?.paymentStatus).toBe("partial");

    const allocs = await db.settlementAllocations
      .where("targetDocumentId")
      .equals(inv.id)
      .toArray();
    expect(allocs.some((a: any) => a.component === "principal")).toBe(true);

    const st = await db.documentSettlementState.get(inv.id);
    expect(st?.settlementVersion).toBe(state.settlementVersion + 1);
  });

  it("rejects over-allocation", async () => {
    const db = getDB();
    const inv = await seedE2ESalesInvoice({ grandTotal: 11300, date: "2026-07-12" });
    const state = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);

    const result = await postReceiptTransaction({
      commandId: "rcpt-over-1",
      requestId: "rcpt-over-1",
      idempotencyKey: "rcpt-over-1-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      receipt: {
        receiptType: "customer_receipt",
        transactionDate: "2026-07-12",
        partyId: E2E_CUSTOMER_ID,
        cashOrBankAccountId: "acc-cash",
        amount: "20000.00",
        allocations: [
          {
            document_id: inv.id,
            amount: "20000.00",
            expected_settlement_version: state.settlementVersion,
          },
        ],
        currency: "NPR",
      },
    });
    expect(result.type).toBe("posting_conflict");
    if (result.type === "posting_completed") return;
    expect(result.payload.error_code).toBe("over_allocation");
  });

  it("customer advance creates unapplied balance", async () => {
    const db = getDB();
    const result = await postReceiptTransaction({
      commandId: "rcpt-adv-1",
      requestId: "rcpt-adv-1",
      idempotencyKey: "rcpt-adv-1-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      receipt: {
        receiptType: "customer_advance_receipt",
        transactionDate: "2026-07-12",
        partyId: E2E_CUSTOMER_ID,
        cashOrBankAccountId: "acc-cash",
        amount: "3000.00",
        allocations: [],
        currency: "NPR",
        narration: "Advance",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;

    expect(result.payload.advance_ids?.length).toBeGreaterThan(0);
    const advances = await db.partyAdvances.toArray();
    expect(advances.some((a: any) => a.partyId === E2E_CUSTOMER_ID)).toBe(true);
    const unapplied = await db.unappliedBalances.toArray();
    expect(unapplied.some((u: any) => u.status === "open")).toBe(true);
  });

  it("supplier payment partial", async () => {
    const db = getDB();
    const inv = await seedE2EPurchaseInvoice({ grandTotal: 11300, date: "2026-07-12" });
    const state = await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);

    const result = await postPaymentTransaction({
      commandId: "pay-partial-1",
      requestId: "pay-partial-1",
      idempotencyKey: "pay-partial-1-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      payment: {
        paymentType: "supplier_payment",
        transactionDate: "2026-07-12",
        partyId: E2E_SUPPLIER_ID,
        cashOrBankAccountId: "acc-cash",
        amount: "4000.00",
        allocations: [
          {
            document_id: inv.id,
            amount: "4000.00",
            expected_settlement_version: state.settlementVersion,
          },
        ],
        currency: "NPR",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;

    const after = await db.invoices.get(inv.id);
    expect(Number(after?.paidAmount)).toBe(4000);
    expect(after?.paymentStatus).toBe("partial");
  });

  it("cash_to_bank contra", async () => {
    const result = await postContraTransaction({
      commandId: "contra-1",
      requestId: "contra-1",
      idempotencyKey: "contra-1-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      contra: {
        contraType: "cash_to_bank",
        transactionDate: "2026-07-12",
        fromAccountId: "acc-cash",
        toAccountId: "acc-bank-a",
        amount: "1500.00",
        currency: "NPR",
        narration: "Deposit cash",
      },
    });
    expect(result.type).toBe("posting_completed");
    if (result.type !== "posting_completed") return;
    expect(result.payload.contra_type).toBe("cash_to_bank");
    const db = getDB();
    const v = await db.vouchers.get(result.payload.voucher_id);
    expect(v?.type).toBe("contra");
    expect(v?.status).toBe("posted");
  });

  it("balanced journal posts", async () => {
    const result = await postJournalTransaction({
      commandId: "jnl-1",
      requestId: "jnl-1",
      idempotencyKey: "jnl-1-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      journal: {
        transactionDate: "2026-07-12",
        narration: "Rent accrual",
        allowRestrictedControlAccounts: true,
        lines: [
          { accountId: "acc-rent-expense", debit: "2000.00", credit: "0.00" },
          { accountId: "acc-outstanding-expense", debit: "0.00", credit: "2000.00" },
        ],
        currency: "NPR",
      },
    });
    expect(result.type).toBe("posting_completed");
  });

  it("unbalanced journal rejection", async () => {
    const result = await postJournalTransaction({
      commandId: "jnl-bad",
      requestId: "jnl-bad",
      idempotencyKey: "jnl-bad-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      journal: {
        transactionDate: "2026-07-12",
        allowRestrictedControlAccounts: true,
        lines: [
          { accountId: "acc-rent-expense", debit: "2000.00", credit: "0.00" },
          { accountId: "acc-outstanding-expense", debit: "0.00", credit: "1000.00" },
        ],
        currency: "NPR",
      },
    });
    expect(result.type).not.toBe("posting_completed");
    if (result.type === "posting_completed") return;
    expect(
      result.payload.error_code === "unbalanced_journal" ||
        result.payload.error_code === "journal_unbalanced" ||
        String(result.payload.safe_message || "").toLowerCase().includes("balance"),
    ).toBe(true);
  });

  it("idempotent replay returns same voucher", async () => {
    const cmd = {
      commandId: "rcpt-idem-1",
      requestId: "rcpt-idem-1",
      idempotencyKey: "rcpt-idem-shared",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant" as const,
      orbixMode: "accountant" as const,
      source: "test" as const,
      receipt: {
        receiptType: "other_receipt" as const,
        transactionDate: "2026-07-12",
        partyId: null,
        cashOrBankAccountId: "acc-cash",
        amount: "100.00",
        allocations: [],
        currency: "NPR",
        narration: "Idempotent",
      },
    };
    const first = await postReceiptTransaction(cmd);
    expect(first.type).toBe("posting_completed");
    const second = await postReceiptTransaction(cmd);
    expect(second.type).toBe("posting_completed");
    if (first.type === "posting_completed" && second.type === "posting_completed") {
      expect(second.payload.idempotent_replay).toBe(true);
      expect(second.payload.voucher_id).toBe(first.payload.voucher_id);
    }
  });

  it("rollback on injectFailure before_sync leaves no voucher", async () => {
    const db = getDB();
    const before = await db.vouchers.count();
    const result = await postReceiptTransaction({
      commandId: "rcpt-fail-sync",
      requestId: "rcpt-fail-sync",
      idempotencyKey: "rcpt-fail-sync-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      injectFailure: "before_sync",
      receipt: {
        receiptType: "other_receipt",
        transactionDate: "2026-07-12",
        cashOrBankAccountId: "acc-cash",
        amount: "250.00",
        allocations: [],
        currency: "NPR",
      },
    });
    expect(result.type).toBe("posting_failed");
    if (result.type === "posting_completed") return;
    expect(result.payload.rolled_back).toBe(true);
    expect(await db.vouchers.count()).toBe(before);
  });

  it("stale settlement version conflict", async () => {
    const db = getDB();
    const inv = await seedE2ESalesInvoice({ grandTotal: 11300, date: "2026-07-12" });
    await getOrCreateDocumentSettlementState(db, E2E_COMPANY_ID, inv.id);
    await db.documentSettlementState.put({
      id: inv.id,
      companyId: E2E_COMPANY_ID,
      settlementVersion: 2,
      updatedAt: new Date().toISOString(),
    });

    const result = await postReceiptTransaction({
      commandId: "rcpt-stale",
      requestId: "rcpt-stale",
      idempotencyKey: "rcpt-stale-idem",
      companyId: E2E_COMPANY_ID,
      userId: E2E_USER_AUTHORIZED,
      userRole: "accountant",
      orbixMode: "accountant",
      source: "test",
      receipt: {
        receiptType: "customer_receipt",
        transactionDate: "2026-07-12",
        partyId: E2E_CUSTOMER_ID,
        cashOrBankAccountId: "acc-cash",
        amount: "1000.00",
        allocations: [
          {
            document_id: inv.id,
            amount: "1000.00",
            expected_settlement_version: 0,
          },
        ],
        currency: "NPR",
      },
    });
    expect(result.type).toBe("posting_conflict");
    if (result.type === "posting_completed") return;
    expect(result.payload.error_code).toBe("stale_settlement_version");
  });
});
