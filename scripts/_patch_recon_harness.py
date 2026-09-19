from pathlib import Path

# Patch reconciliation.ts finding codes + light bank scan
rec = Path("src/platform/sync/reconciliation.ts")
rt = rec.read_text(encoding="utf-8")
if "duplicate_statement_batch" not in rt:
    rt = rt.replace(
        '| "remote_event_mismatch";',
        '''| "remote_event_mismatch"
  | "duplicate_statement_batch"
  | "overmatched_statement_line"
  | "stale_statement_line_version"
  | "orphan_bank_reconciliation_link"
  | "statement_line_without_batch"
  | "bank_session_nonzero_difference"
  | "invalid_cheque_state"
  | "cheque_without_clear_evidence";''',
    )
    # insert bank scan before final summary
    insert = '''
  // Phase 10 — light bank / treasury scan when tables exist
  const bankBatches = (db as any).bankStatementBatches
    ? await (db as any).bankStatementBatches.toArray()
    : [];
  const bankLines = (db as any).bankStatementLines
    ? await (db as any).bankStatementLines.toArray()
    : [];
  const bankLinks = (db as any).bankReconciliationLinks
    ? await (db as any).bankReconciliationLinks.toArray()
    : [];
  const bankSessions = (db as any).bankReconciliationSessions
    ? await (db as any).bankReconciliationSessions.toArray()
    : [];
  const cheques = (db as any).chequeInstruments
    ? await (db as any).chequeInstruments.toArray()
    : [];

  if (bankBatches.length || bankLines.length) {
    const hashGroups = new Map<string, any[]>();
    for (const b of bankBatches) {
      if (String(b.companyId) !== companyId) continue;
      if (b.status === "superseded" || b.status === "rejected") continue;
      const key = `${b.bankAccountId}|${b.sourceHash}`;
      const arr = hashGroups.get(key) || [];
      arr.push(b);
      hashGroups.set(key, arr);
    }
    for (const [, group] of hashGroups) {
      if (group.length > 1) {
        pushFinding(findings, {
          code: "duplicate_statement_batch",
          severity: "error",
          message: `Duplicate statement sourceHash for bank account ${group[0].bankAccountId}`,
          entityId: String(group[0].id),
          details: { batchIds: group.map((g: any) => g.id) },
        });
      }
    }

    const batchIds = new Set(bankBatches.map((b: any) => b.id));
    for (const line of bankLines) {
      if (String(line.companyId) !== companyId) continue;
      if (line.batchId && !batchIds.has(line.batchId)) {
        pushFinding(findings, {
          code: "statement_line_without_batch",
          severity: "warning",
          message: `Statement line ${line.id} references missing batch`,
          entityId: String(line.id),
        });
      }
      if (Number(line.remainingMatchPaisa) < 0) {
        pushFinding(findings, {
          code: "overmatched_statement_line",
          severity: "error",
          message: `Statement line ${line.id} remainingMatchPaisa is negative`,
          entityId: String(line.id),
          actual: line.remainingMatchPaisa,
        });
      }
    }

    for (const link of bankLinks) {
      if (String(link.companyId) !== companyId) continue;
      if (link.status === "confirmed") {
        const line = bankLines.find((l: any) => l.id === link.statementLineId);
        if (!line) {
          pushFinding(findings, {
            code: "orphan_bank_reconciliation_link",
            severity: "warning",
            message: `Confirmed link ${link.id} has no statement line`,
            entityId: String(link.id),
          });
        }
      }
    }

    for (const s of bankSessions) {
      if (String(s.companyId) !== companyId) continue;
      if ((s.status === "open" || s.status === "in_progress") && Math.abs(Number(s.differencePaisa || 0)) > 1) {
        pushFinding(findings, {
          code: "bank_session_nonzero_difference",
          severity: "info",
          message: `Open recon session ${s.id} has nonzero difference`,
          entityId: String(s.id),
          actual: s.differencePaisa,
        });
      }
    }

    for (const c of cheques) {
      if (String(c.companyId) !== companyId) continue;
      if (c.status === "cleared" && !c.clearedStatementLineId) {
        pushFinding(findings, {
          code: "cheque_without_clear_evidence",
          severity: "warning",
          message: `Cleared cheque ${c.instrumentNumber || c.id} missing statement evidence`,
          entityId: String(c.id),
        });
      }
    }
  }

'''
    marker = "  const errors = findings.filter((f) => f.severity === \"error\").length;"
    if marker not in rt:
        raise SystemExit("reconciliation marker missing")
    rt = rt.replace(marker, insert + marker)
    rec.write_text(rt, encoding="utf-8", newline="\n")
    print("reconciliation patched")
else:
    print("reconciliation already")

# Patch bootstrap harness
boot = Path("src/e2e/bootstrapUiQaHarness.ts")
bt = boot.read_text(encoding="utf-8")
if "seedPhase10TreasuryDocs" not in bt:
    bt = bt.replace(
        '''from "@/domains/settlement/e2eSeed";
import { postReceiptTransaction } from "@/domains/settlement/postReceiptTransaction";
import { postPaymentTransaction } from "@/domains/settlement/postPaymentTransaction";
import { getOrCreateDocumentSettlementState } from "@/domains/settlement/settlementState";
import { computeDocumentOutstanding } from "@/domains/settlement/outstandingBalance";
''',
        '''from "@/domains/settlement/e2eSeed";
import { postReceiptTransaction } from "@/domains/settlement/postReceiptTransaction";
import { postPaymentTransaction } from "@/domains/settlement/postPaymentTransaction";
import { getOrCreateDocumentSettlementState } from "@/domains/settlement/settlementState";
import { computeDocumentOutstanding } from "@/domains/settlement/outstandingBalance";
import {
  seedTreasuryE2ECompany,
  E2E_BANK_ACCOUNT_ID,
  E2E_SAMPLE_STATEMENT_CSV,
  E2E_CHEQUE_CLEARED_ID,
  E2E_RV_001_ID,
} from "@/domains/treasury/e2eSeed";
import { createStatementBatch } from "@/domains/treasury/statementBatch";
import { confirmBankMatch } from "@/domains/treasury/postConfirmBankMatch";
import { computeTreasuryPosition } from "@/domains/treasury/treasuryPosition";
''',
    )
    bt = bt.replace(
        '''      seedPhase9SettlementDocs: () => Promise<{
        invoiceIds: Record<string, string>;
        settlementVersions: Record<string, number>;
        companyId: string;
      }>;
      getSettlementSnapshot: () => Promise<Record<string, unknown>>;
''',
        '''      seedPhase9SettlementDocs: () => Promise<{
        invoiceIds: Record<string, string>;
        settlementVersions: Record<string, number>;
        companyId: string;
      }>;
      seedPhase10TreasuryDocs: () => Promise<{
        companyId: string;
        bankAccountId: string;
        sampleCsv: string;
      }>;
      getTreasurySnapshot: () => Promise<Record<string, unknown>>;
      importE2EStatement: (opts?: { supersedeDuplicate?: boolean }) => Promise<Record<string, unknown>>;
      postE2EBankMatch: (opts: {
        reference?: string;
        amount: string;
        expectedVersion?: number;
        statementLineId?: string;
        erpDocumentId?: string;
      }) => Promise<Record<string, unknown>>;
      getSettlementSnapshot: () => Promise<Record<string, unknown>>;
      pullRemoteEvents?: () => Promise<Record<string, unknown>>;
''',
    )
    # insert implementations after seedPhase9SettlementDocs return
    impl = '''
    async seedPhase10TreasuryDocs() {
      await ensureOrbixSchema();
      const seeded = await seedTreasuryE2ECompany();
      await applyE2EUserState("accountant");
      useEKhataStore.getState().newChat();
      if (!window.__orbixE2E!.assertSafeCompany()) {
        throw new Error("Refuse seedPhase10TreasuryDocs — company not E2E after seed");
      }
      await window.__orbixE2E!.reloadFromDexie();
      return {
        companyId: seeded.companyId,
        bankAccountId: seeded.bankAccountId,
        sampleCsv: seeded.sampleCsv,
      };
    },
    async getTreasurySnapshot() {
      const db = getDB();
      const batches = (db as any).bankStatementBatches
        ? await (db as any).bankStatementBatches.toArray()
        : [];
      const lines = (db as any).bankStatementLines
        ? await (db as any).bankStatementLines.toArray()
        : [];
      const links = (db as any).bankReconciliationLinks
        ? await (db as any).bankReconciliationLinks.toArray()
        : [];
      const cheque = (db as any).chequeInstruments
        ? await (db as any).chequeInstruments.get(E2E_CHEQUE_CLEARED_ID)
        : null;
      let position: Record<string, unknown> | null = null;
      try {
        const pos = await computeTreasuryPosition({
          companyId: E2E_COMPANY_ID,
          bankAccountId: E2E_BANK_ACCOUNT_ID,
        });
        position = pos.accounts[0]
          ? {
              bookBalance: pos.accounts[0].bookBalance,
              availableBalance: pos.accounts[0].availableBalance,
            }
          : null;
      } catch {
        position = null;
      }
      return {
        batchCount: batches.length,
        lineCount: lines.length,
        linkCount: links.filter((l: any) => l.status === "confirmed").length,
        chequeClearedStatus: cheque?.status || null,
        position,
      };
    },
    async importE2EStatement(opts = {}) {
      const result = await createStatementBatch({
        commandId: `e2e-import-${Date.now()}`,
        requestId: `e2e-import-${Date.now()}`,
        idempotencyKey: `e2e-import-${Date.now()}`,
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        bankAccountId: E2E_BANK_ACCOUNT_ID,
        csvText: E2E_SAMPLE_STATEMENT_CSV,
        sourceType: "e2e_fixture",
        supersedeDuplicate: opts.supersedeDuplicate,
      });
      await window.__orbixE2E!.reloadFromDexie();
      return result as unknown as Record<string, unknown>;
    },
    async postE2EBankMatch(opts) {
      const db = getDB();
      let lineId = opts.statementLineId;
      if (!lineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines.toArray();
        const ref = String(opts.reference || "RV-E2E-001").toUpperCase();
        const hit = lines.find(
          (l: any) => String(l.reference || "").toUpperCase() === ref,
        );
        lineId = hit?.id;
      }
      const line = lineId ? await (db as any).bankStatementLines.get(lineId) : null;
      let erpId = opts.erpDocumentId || E2E_RV_001_ID;
      if (opts.reference && String(opts.reference).startsWith("RV-")) {
        const v = await db.vouchers
          .filter(
            (x: any) =>
              String(x.voucherNo || "").toUpperCase() ===
              String(opts.reference).toUpperCase(),
          )
          .first();
        if (v?.id) erpId = v.id;
      }
      const result = await confirmBankMatch({
        commandId: `e2e-match-${Date.now()}`,
        requestId: `e2e-match-${Date.now()}`,
        idempotencyKey: `e2e-match-${Date.now()}-${opts.expectedVersion ?? "auto"}`,
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "test",
        bankAccountId: E2E_BANK_ACCOUNT_ID,
        statementLineId: lineId || "",
        erpDocumentIds: [erpId],
        matchedAmount: opts.amount,
        matchType: "one_to_one",
        matchMethod: "manual_confirm",
        expectedStatementLineVersion: Number(
          opts.expectedVersion ?? line?.reconciliationVersion ?? 1,
        ),
        expectedErpMatchVersions: {},
        currency: "NPR",
      });
      await window.__orbixE2E!.reloadFromDexie();
      return {
        type: result.type,
        error_code: (result as any).payload?.error_code,
        conflict_category: (result as any).payload?.conflict_category,
        ...(result.type === "posting_completed" ? result.payload : {}),
      } as Record<string, unknown>;
    },
    async pullRemoteEvents() {
      const client = getEventSyncClient();
      if (typeof (client as any).pull === "function") {
        return (await (client as any).pull()) as Record<string, unknown>;
      }
      if (typeof (client as any).pullRemote === "function") {
        return (await (client as any).pullRemote()) as Record<string, unknown>;
      }
      return { ok: false, reason: "pull_not_available" };
    },
'''
    marker = "    async getSettlementSnapshot() {"
    if marker not in bt:
        raise SystemExit("getSettlementSnapshot marker missing")
    bt = bt.replace(marker, impl + "\n    async getSettlementSnapshot() {")
    boot.write_text(bt, encoding="utf-8", newline="\n")
    print("bootstrap patched")
else:
    print("bootstrap already")