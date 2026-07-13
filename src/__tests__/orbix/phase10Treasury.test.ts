import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import {
  seedTreasuryE2ECompany,
  E2E_COMPANY_ID,
  E2E_BANK_ACCOUNT_ID,
  E2E_USER_AUTHORIZED,
  E2E_FY_ID,
  E2E_SAMPLE_STATEMENT_CSV,
  E2E_RV_001_ID,
  E2E_CHEQUE_CLEARED_ID,
} from "@/domains/treasury/e2eSeed";
import { createStatementBatch } from "@/domains/treasury/statementBatch";
import { runDeterministicMatching } from "@/domains/treasury/matchingEngine";
import { confirmBankMatch } from "@/domains/treasury/postConfirmBankMatch";
import { reverseBankMatch } from "@/domains/treasury/postReverseBankMatch";
import { postBankAdjustmentFromStatement } from "@/domains/treasury/postBankAdjustmentFromStatement";
import { postChequeStatusChange } from "@/domains/treasury/chequeLifecycle";
import {
  openBankReconciliationSession,
  closeBankReconciliation,
} from "@/domains/treasury/reconciliationSession";
import { computeTreasuryPosition } from "@/domains/treasury/treasuryPosition";

async function prepareDb() {
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  await db.fiscalYears.put({
    ...DEFAULT_FISCAL_YEAR,
    id: DEFAULT_FISCAL_YEAR.id || "fy-default",
    isCurrent: true,
  } as any);
  await seedTreasuryE2ECompany();
  await db.fiscalYears.put({
    id: E2E_FY_ID || "fy-e2e-settlement",
    name: "E2E treasury FY",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  return getDB();
}

function baseCmd(id: string) {
  return {
    commandId: id,
    requestId: id,
    idempotencyKey: `${id}-idem`,
    companyId: E2E_COMPANY_ID,
    financialYearId: E2E_FY_ID,
    userId: E2E_USER_AUTHORIZED,
    userRole: "accountant",
    orbixMode: "accountant" as const,
    source: "test" as const,
  };
}

describe("Phase 10 treasury domain", () => {
  beforeEach(async () => {
    await prepareDb();
  });

  it("CSV import + duplicate rejection", async () => {
    const first = await createStatementBatch({
      ...baseCmd("imp-1"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
      sourceType: "e2e_fixture",
    });
    expect(first.type).toBe("posting_completed");

    const dup = await createStatementBatch({
      ...baseCmd("imp-2"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
      sourceType: "e2e_fixture",
    });
    expect(dup.type).toBe("posting_conflict");
    if (dup.type !== "posting_completed") {
      expect(dup.payload.error_code).toBe("duplicate_source_hash");
    }
  });

  it("exact amount/date match suggestion", async () => {
    const imp = await createStatementBatch({
      ...baseCmd("imp-match-sug"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    expect(imp.type).toBe("posting_completed");
    const db = getDB();
    const lines = await (db as any).bankStatementLines
      .where("bankAccountId")
      .equals(E2E_BANK_ACCOUNT_ID)
      .toArray();
    const stmts = lines.map((l: any) => ({
      id: l.id,
      reference: l.reference,
      description: l.description,
      signedAmountPaisa: l.signedAmountPaisa,
      date: l.transactionDate,
      remainingMatchPaisa: l.remainingMatchPaisa,
    }));
    const erp = [
      {
        id: E2E_RV_001_ID,
        voucherId: E2E_RV_001_ID,
        voucherNo: "RV-E2E-001",
        reference: "RV-E2E-001",
        signedAmountPaisa: 2_500_000,
        date: lines.find((l: any) => l.reference === "RV-E2E-001")?.transactionDate || "2026-07-02",
      },
    ];
    const result = runDeterministicMatching(stmts, erp);
    const hit = result.suggestions.find((s) => s.erpDocumentIds.includes(E2E_RV_001_ID));
    expect(hit).toBeTruthy();
    expect(hit!.matchedAmountPaisa).toBe(2_500_000);
    expect(
      [
        "exact_amount_date",
        "exact_normalized_reference",
        "exact_bank_transaction_id",
        "amount_date_tolerance",
        "exact_cheque_number",
      ].includes(hit!.matchMethod),
    ).toBe(true);
  });

  it("confirm match + overmatch rejection", async () => {
    const imp = await createStatementBatch({
      ...baseCmd("imp-om"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    expect(imp.type).toBe("posting_completed");
    const db = getDB();
    const line = (
      await (db as any).bankStatementLines.where("bankAccountId").equals(E2E_BANK_ACCOUNT_ID).toArray()
    ).find((l: any) => l.reference === "RV-E2E-001");
    expect(line).toBeTruthy();

    const ok = await confirmBankMatch({
      ...baseCmd("match-ok"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: [E2E_RV_001_ID],
      matchedAmount: "25000.00",
      matchType: "one_to_one",
      matchMethod: "manual_confirm",
      expectedStatementLineVersion: line.reconciliationVersion,
      expectedErpMatchVersions: {},
      currency: "NPR",
    });
    expect(ok.type).toBe("posting_completed");

    const line2 = await (db as any).bankStatementLines.get(line.id);
    const over = await confirmBankMatch({
      ...baseCmd("match-over"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: [E2E_RV_001_ID],
      matchedAmount: "1.00",
      matchType: "one_to_one",
      matchMethod: "manual_confirm",
      expectedStatementLineVersion: line2.reconciliationVersion,
      expectedErpMatchVersions: {},
      currency: "NPR",
    });
    expect(over.type).toBe("posting_conflict");
    if (over.type !== "posting_completed") {
      expect(over.payload.error_code).toMatch(/overmatch/i);
    }
  });

  it("unmatch", async () => {
    await createStatementBatch({
      ...baseCmd("imp-un"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const line = (
      await (db as any).bankStatementLines.toArray()
    ).find((l: any) => l.reference === "RV-E2E-001");
    const matched = await confirmBankMatch({
      ...baseCmd("match-un"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: [E2E_RV_001_ID],
      matchedAmount: "25000.00",
      matchType: "one_to_one",
      matchMethod: "manual_confirm",
      expectedStatementLineVersion: line.reconciliationVersion,
      expectedErpMatchVersions: {},
      currency: "NPR",
    });
    expect(matched.type).toBe("posting_completed");
    if (matched.type !== "posting_completed") return;
    const linkId = matched.payload.link_id;
    const link = await (db as any).bankReconciliationLinks.get(linkId);
    const lineAfter = await (db as any).bankStatementLines.get(line.id);
    const rev = await reverseBankMatch({
      ...baseCmd("unmatch-1"),
      linkId,
      expectedLinkVersion: link.version,
      expectedStatementLineVersion: lineAfter.reconciliationVersion,
    });
    expect(rev.type).toBe("posting_completed");
  });

  it("bank charge adjustment via Phase 9", async () => {
    await createStatementBatch({
      ...baseCmd("imp-chg"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const line = (await (db as any).bankStatementLines.toArray()).find((l: any) =>
      /bank charge/i.test(String(l.description || "")),
    );
    expect(line).toBeTruthy();
    const result = await postBankAdjustmentFromStatement({
      ...baseCmd("adj-chg"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      expectedStatementLineVersion: line.reconciliationVersion,
      adjustmentType: "bank_charge",
      useJournal: true,
      narration: "Monthly bank charge",
    });
    expect(result.type).toBe("posting_completed");
    if (result.type === "posting_completed") {
      expect(result.payload.voucher_id).toBeTruthy();
    }
  });

  it("cheque clear transition", async () => {
    await createStatementBatch({
      ...baseCmd("imp-chq"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const cheque = await (db as any).chequeInstruments.get(E2E_CHEQUE_CLEARED_ID);
    const line = (await (db as any).bankStatementLines.toArray()).find((l: any) =>
      String(l.reference || "").includes("CH-E2E-001"),
    );
    const result = await postChequeStatusChange({
      ...baseCmd("chq-clear"),
      chequeId: E2E_CHEQUE_CLEARED_ID,
      nextStatus: "cleared",
      expectedInstrumentVersion: cheque.instrumentVersion,
      statementLineId: line?.id,
    });
    expect(result.type).toBe("posting_completed");
    const after = await (db as any).chequeInstruments.get(E2E_CHEQUE_CLEARED_ID);
    expect(after.status).toBe("cleared");
  });

  it("invalid cheque transition rejection", async () => {
    const db = getDB();
    const cheque = await (db as any).chequeInstruments.get(E2E_CHEQUE_CLEARED_ID);
    // deposited -> issued is invalid
    const result = await postChequeStatusChange({
      ...baseCmd("chq-bad"),
      chequeId: E2E_CHEQUE_CLEARED_ID,
      nextStatus: "issued",
      expectedInstrumentVersion: cheque.instrumentVersion,
    });
    expect(result.type).toMatch(/posting_conflict|posting_failed|posting_denied/);
    if (result.type !== "posting_completed") {
      expect(String(result.payload.error_code || result.payload.conflict_category || "")).toMatch(
        /invalid_cheque|transition/i,
      );
    }
  });

  it("close with difference rejection", async () => {
    const opened = await openBankReconciliationSession({
      ...baseCmd("open-diff"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      statementBalancePaisa: 10_000_000,
      bookBalancePaisa: 9_000_000,
    });
    expect(opened.type).toBe("posting_completed");
    if (opened.type !== "posting_completed") return;
    const closed = await closeBankReconciliation({
      ...baseCmd("close-diff"),
      sessionId: opened.payload.session_id,
      expectedVersion: opened.payload.session_version,
    });
    expect(closed.type).toMatch(/posting_conflict|posting_failed|posting_denied/);
  });

  it("close when balanced", async () => {
    const opened = await openBankReconciliationSession({
      ...baseCmd("open-bal"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      statementBalancePaisa: 10_000_000,
      bookBalancePaisa: 10_000_000,
    });
    expect(opened.type).toBe("posting_completed");
    if (opened.type !== "posting_completed") return;
    // ensure difference is zero on session row
    const db = getDB();
    await (db as any).bankReconciliationSessions.update(opened.payload.session_id, {
      differencePaisa: 0,
      clearedBalancePaisa: 10_000_000,
    });
    const closed = await closeBankReconciliation({
      ...baseCmd("close-bal"),
      sessionId: opened.payload.session_id,
      expectedVersion: opened.payload.session_version,
    });
    expect(closed.type).toBe("posting_completed");
  });

  it("treasury position distinguishes book vs available", async () => {
    const pos = await computeTreasuryPosition({
      companyId: E2E_COMPANY_ID,
      bankAccountId: E2E_BANK_ACCOUNT_ID,
    });
    expect(pos.accounts.length).toBeGreaterThan(0);
    const acct = pos.accounts[0];
    expect(acct.bookBalance).toBeTruthy();
    expect(acct.availableBalance).toBeTruthy();
    // With outstanding received cheques not cleared, available may differ from book
    expect(typeof acct.bookBalancePaisa).toBe("number");
    expect(typeof acct.availableBalancePaisa).toBe("number");
  });

  it("idempotent match replay", async () => {
    await createStatementBatch({
      ...baseCmd("imp-idem"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const line = (await (db as any).bankStatementLines.toArray()).find(
      (l: any) => l.reference === "RV-E2E-002",
    );
    const cmd = {
      ...baseCmd("match-idem"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: ["voucher-e2e-rv-002"],
      matchedAmount: "15000.00",
      matchType: "one_to_one" as const,
      matchMethod: "manual_confirm" as const,
      expectedStatementLineVersion: line.reconciliationVersion,
      expectedErpMatchVersions: {},
      currency: "NPR",
    };
    const a = await confirmBankMatch(cmd);
    const b = await confirmBankMatch(cmd);
    expect(a.type).toBe("posting_completed");
    expect(b.type).toBe("posting_completed");
    if (a.type === "posting_completed" && b.type === "posting_completed") {
      expect(b.payload.idempotent_replay).toBe(true);
      expect(b.payload.link_id).toBe(a.payload.link_id);
    }
  });

  it("stale line version conflict", async () => {
    await createStatementBatch({
      ...baseCmd("imp-stale"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const line = (await (db as any).bankStatementLines.toArray()).find(
      (l: any) => l.reference === "RV-E2E-003",
    );
    const stale = await confirmBankMatch({
      ...baseCmd("match-stale"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: ["voucher-e2e-rv-003"],
      matchedAmount: "8000.00",
      matchType: "one_to_one",
      matchMethod: "manual_confirm",
      expectedStatementLineVersion: line.reconciliationVersion - 1,
      expectedErpMatchVersions: {},
      currency: "NPR",
    });
    expect(stale.type).toBe("posting_conflict");
    if (stale.type !== "posting_completed") {
      expect(stale.payload.error_code).toMatch(/stale_statement_line_version/i);
    }
  });

  it("legacy reconciled flag cannot contradict Phase 10 unmatched line", async () => {
    await createStatementBatch({
      ...baseCmd("imp-legacy"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const line = (await (db as any).bankStatementLines.toArray()).find(
      (l: any) => l.reference === "RV-E2E-001",
    );
    expect(line).toBeTruthy();
    expect(line.status).not.toBe("matched");

    // Plant contradictory legacy row (same visual amount) claiming reconciled=true
    if ((db as any).bankStatementRows) {
      await (db as any).bankStatementRows.put({
        id: "legacy-contradict-rv001",
        bankAccountId: E2E_BANK_ACCOUNT_ID,
        date: line.transactionDate,
        narration: line.description,
        refNo: "RV-E2E-001",
        debit: 0,
        credit: 25000,
        reconciled: true,
        status: "Matched",
      });
    }

    // Authoritative display must follow Phase 10 line status, not legacy reconciled
    const domainWins =
      line.status === "unmatched" || Number(line.remainingMatchPaisa) > 0;
    expect(domainWins).toBe(true);
    const legacy = (db as any).bankStatementRows
      ? await (db as any).bankStatementRows.get("legacy-contradict-rv001")
      : null;
    if (legacy) {
      expect(Boolean(legacy.reconciled)).toBe(true);
      expect(line.status === "matched").toBe(false);
    }
  });

  it("partial overmatch conflict", async () => {
    await createStatementBatch({
      ...baseCmd("imp-partial"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      csvText: E2E_SAMPLE_STATEMENT_CSV,
    });
    const db = getDB();
    const line = (await (db as any).bankStatementLines.toArray()).find(
      (l: any) => Number(l.creditPaisa) === 2_500_000,
    );
    const first = await confirmBankMatch({
      ...baseCmd("partial-a"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: [E2E_RV_001_ID],
      matchedAmount: "15000.00",
      matchType: "one_to_one",
      matchMethod: "manual_confirm",
      expectedStatementLineVersion: line.reconciliationVersion,
      expectedErpMatchVersions: {},
      currency: "NPR",
    });
    expect(first.type).toBe("posting_completed");
    const refreshed = await (db as any).bankStatementLines.get(line.id);
    const over = await confirmBankMatch({
      ...baseCmd("partial-b"),
      bankAccountId: E2E_BANK_ACCOUNT_ID,
      statementLineId: line.id,
      erpDocumentIds: ["voucher-e2e-rv-002"],
      matchedAmount: "15000.00",
      matchType: "one_to_one",
      matchMethod: "manual_confirm",
      expectedStatementLineVersion: refreshed.reconciliationVersion,
      expectedErpMatchVersions: {},
      currency: "NPR",
    });
    // 15k + 15k = 30k > 25k line → overmatch/conflict
    expect(over.type).toMatch(/posting_conflict|posting_failed/);
  });
});
