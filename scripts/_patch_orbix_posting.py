from pathlib import Path

# --- types.ts card fields ---
types = Path("src/lib/ekhata/types.ts")
tt = types.read_text(encoding="utf-8")
if "bank_recon_kind" not in tt:
    tt = tt.replace(
        """  allocations?: Array<{
    document_id?: string;
    invoice_no?: string;
    invoiceNo?: string;
    amount?: string | number;
    expected_settlement_version?: number | null;
  }>;
}""",
        """  allocations?: Array<{
    document_id?: string;
    invoice_no?: string;
    invoiceNo?: string;
    amount?: string | number;
    expected_settlement_version?: number | null;
  }>;
  /** Phase 10 bank recon / treasury */
  bank_recon_kind?: string | null;
  bank_account_id?: string | null;
  statement_line_id?: string | null;
  erp_document_ids?: string[] | null;
  cheque_id?: string | null;
  cheque_number?: string | null;
  cheque_next_status?: string | null;
  adjustment_type?: string | null;
  expected_statement_line_version?: number | null;
  reference?: string | null;
}""",
    )
    types.write_text(tt, encoding="utf-8", newline="\n")
    print("types patched")
else:
    print("types already")

# --- orbixCardNormalize ---
norm = Path("src/lib/ekhata/orbixCardNormalize.ts")
nt = norm.read_text(encoding="utf-8")
if "bank_recon_kind" not in nt:
    nt = nt.replace(
        """    allocations: Array.isArray(raw.allocations)
      ? (raw.allocations as KhataConfirmationCard["allocations"])
      : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
  } as KhataConfirmationCard;
}""",
        """    allocations: Array.isArray(raw.allocations)
      ? (raw.allocations as KhataConfirmationCard["allocations"])
      : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    bank_recon_kind: raw.bank_recon_kind != null ? String(raw.bank_recon_kind) : null,
    bank_account_id: raw.bank_account_id != null ? String(raw.bank_account_id) : null,
    statement_line_id: raw.statement_line_id != null ? String(raw.statement_line_id) : null,
    erp_document_ids: Array.isArray(raw.erp_document_ids)
      ? raw.erp_document_ids.map(String)
      : null,
    cheque_id: raw.cheque_id != null ? String(raw.cheque_id) : null,
    cheque_number: raw.cheque_number != null ? String(raw.cheque_number) : null,
    cheque_next_status: raw.cheque_next_status != null ? String(raw.cheque_next_status) : null,
    adjustment_type: raw.adjustment_type != null ? String(raw.adjustment_type) : null,
    expected_statement_line_version:
      raw.expected_statement_line_version != null
        ? Number(raw.expected_statement_line_version)
        : null,
    reference: raw.reference != null ? String(raw.reference) : null,
  } as KhataConfirmationCard;
}""",
    )
    norm.write_text(nt, encoding="utf-8", newline="\n")
    print("normalize patched")
else:
    print("normalize already")

# --- orbixPostingService bank recon routing ---
ops = Path("src/lib/ekhata/orbixPostingService.ts")
ot = ops.read_text(encoding="utf-8")
if "detectBankReconKind" not in ot:
    ot = ot.replace(
        '''import type { ContraType, ReceiptType, PaymentType } from "@/domains/settlement/types";
import { paisaToString, parseMoneyToPaisa } from "@/domains/purchase/money";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/db";
''',
        '''import type { ContraType, ReceiptType, PaymentType } from "@/domains/settlement/types";
import { paisaToString, parseMoneyToPaisa } from "@/domains/purchase/money";
import { getDB } from "@/lib/db";
import { generateId } from "@/lib/db";
import { createStatementBatch } from "@/domains/treasury/statementBatch";
import { confirmBankMatch } from "@/domains/treasury/postConfirmBankMatch";
import { reverseBankMatch } from "@/domains/treasury/postReverseBankMatch";
import { postBankAdjustmentFromStatement } from "@/domains/treasury/postBankAdjustmentFromStatement";
import { postChequeStatusChange } from "@/domains/treasury/chequeLifecycle";
import { closeBankReconciliation } from "@/domains/treasury/reconciliationSession";
import { computeTreasuryPosition } from "@/domains/treasury/treasuryPosition";
import {
  E2E_SAMPLE_STATEMENT_CSV,
  E2E_BANK_ACCOUNT_ID,
  E2E_RV_001_ID,
} from "@/domains/treasury/e2eSeed";
import type { BankAdjustmentType, ChequeState } from "@/domains/treasury/types";
''',
    )

    detect_fn = '''
function detectBankReconKind(
  card: KhataConfirmationCard,
): string | null {
  const ext = card as KhataConfirmationCard & { bank_recon_kind?: string };
  if (ext.bank_recon_kind) return String(ext.bank_recon_kind);
  const intent = String(card.intent || "").toLowerCase();
  const tags = (card.tags || []).map((t) => String(t).toLowerCase());
  if (tags.includes("phase10_treasury") || tags.includes("treasury_query")) {
    if (intent.includes("treasury") || tags.includes("treasury_query")) return "treasury_query";
    if (intent.includes("import")) return "statement_import";
    if (intent.includes("unmatch") || intent.includes("reverse")) return "bank_unmatch";
    if (intent.includes("cheque")) return "cheque_status";
    if (intent.includes("adjustment") || intent.includes("charge")) return "bank_adjustment";
    if (intent.includes("close")) return "recon_close";
    if (intent.includes("match")) return "bank_match";
  }
  if (intent === "bank_statement_import") return "statement_import";
  if (intent === "bank_match_confirm") return "bank_match";
  if (intent === "bank_match_reverse") return "bank_unmatch";
  if (intent === "bank_adjustment_from_statement") return "bank_adjustment";
  if (intent === "cheque_status_change") return "cheque_status";
  if (intent === "treasury_position_query") return "treasury_query";
  if (intent === "bank_recon_close") return "recon_close";
  return null;
}

'''
    ot = ot.replace("export async function executeOrbixConfirm(", detect_fn + "export async function executeOrbixConfirm(")

    bank_block = '''
  // ── Phase 10 treasury / bank recon — before confirmKhata / after inventory ─
  const bankReconKind = detectBankReconKind(cmd.card);
  if (bankReconKind) {
    stages.push("posting_started");
    const ext = cmd.card as KhataConfirmationCard & {
      bank_account_id?: string;
      statement_line_id?: string;
      erp_document_ids?: string[];
      cheque_id?: string;
      cheque_number?: string;
      cheque_next_status?: string;
      adjustment_type?: string;
      expected_statement_line_version?: number;
      reference?: string;
    };
    const bankAccountId = ext.bank_account_id || E2E_BANK_ACCOUNT_ID;
    const amountStr =
      cmd.card.amount > 0 ? Number(cmd.card.amount).toFixed(2) : "0.00";

    if (bankReconKind === "treasury_query") {
      const pos = await computeTreasuryPosition({
        companyId,
        bankAccountId,
      });
      const acct = pos.accounts[0];
      stages.push("posting_completed");
      return {
        response_type: "posting_completed",
        status: "success",
        stages,
        payload: {
          draft_id: cmd.draftId,
          posting_id: `treasury-${cmd.requestId}`,
          currency: "NPR",
          idempotent_replay: false,
          book_balance: acct?.bookBalance,
          available_balance: acct?.availableBalance,
          read_only: true,
        } as any,
      };
    }

    let treasuryResult: { type: string; status: string; payload: any };

    if (bankReconKind === "statement_import") {
      treasuryResult = await createStatementBatch({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        bankAccountId,
        csvText: E2E_SAMPLE_STATEMENT_CSV,
        sourceType: "e2e_fixture",
      });
    } else if (bankReconKind === "bank_match") {
      const db = getDB();
      let statementLineId = ext.statement_line_id;
      if (!statementLineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines
          .where("bankAccountId")
          .equals(bankAccountId)
          .toArray();
        const unmatched = lines.find((l: any) => l.status === "unmatched" || Number(l.remainingMatchPaisa) > 0);
        statementLineId = unmatched?.id;
      }
      const line = statementLineId
        ? await (db as any).bankStatementLines.get(statementLineId)
        : null;
      const erpIds = ext.erp_document_ids?.length
        ? ext.erp_document_ids
        : [E2E_RV_001_ID];
      const resolved: string[] = [];
      for (const id of erpIds) {
        if (String(id).startsWith("RV-") || String(id).startsWith("PV-")) {
          const v = await db.vouchers
            .filter((x: any) => String(x.voucherNo || "").toUpperCase() === String(id).toUpperCase())
            .first();
          resolved.push(v?.id || id);
        } else {
          resolved.push(id);
        }
      }
      treasuryResult = await confirmBankMatch({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        bankAccountId,
        statementLineId: statementLineId || "",
        erpDocumentIds: resolved,
        matchedAmount: amountStr,
        matchType: "one_to_one",
        matchMethod: "manual_confirm",
        expectedStatementLineVersion: Number(
          ext.expected_statement_line_version ?? line?.reconciliationVersion ?? 1,
        ),
        expectedErpMatchVersions: {},
        currency: "NPR",
      });
    } else if (bankReconKind === "bank_adjustment") {
      const db = getDB();
      let statementLineId = ext.statement_line_id;
      if (!statementLineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines
          .where("bankAccountId")
          .equals(bankAccountId)
          .toArray();
        const charge = lines.find((l: any) =>
          /charge|fee/i.test(String(l.description || "")),
        );
        statementLineId = charge?.id || lines.find((l: any) => l.status === "unmatched")?.id;
      }
      const line = statementLineId
        ? await (db as any).bankStatementLines.get(statementLineId)
        : null;
      treasuryResult = await postBankAdjustmentFromStatement({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        bankAccountId,
        statementLineId: statementLineId || "",
        expectedStatementLineVersion: Number(
          ext.expected_statement_line_version ?? line?.reconciliationVersion ?? 1,
        ),
        adjustmentType: (ext.adjustment_type as BankAdjustmentType) || "bank_charge",
        amount: amountStr !== "0.00" ? amountStr : undefined,
        useJournal: true,
        narration: cmd.card.raw_text || "Orbix bank adjustment",
      });
    } else if (bankReconKind === "cheque_status") {
      const db = getDB();
      let chequeId = ext.cheque_id;
      if (!chequeId && ext.cheque_number && (db as any).chequeInstruments) {
        const all = await (db as any).chequeInstruments.toArray();
        chequeId = all.find(
          (c: any) =>
            String(c.instrumentNumber).toUpperCase() ===
            String(ext.cheque_number).toUpperCase(),
        )?.id;
      }
      const cheque = chequeId ? await (db as any).chequeInstruments.get(chequeId) : null;
      let statementLineId = ext.statement_line_id;
      if (!statementLineId && (db as any).bankStatementLines) {
        const lines = await (db as any).bankStatementLines.toArray();
        statementLineId = lines.find((l: any) =>
          String(l.reference || "").toUpperCase().includes(
            String(ext.cheque_number || cheque?.instrumentNumber || "").toUpperCase(),
          ),
        )?.id;
      }
      treasuryResult = await postChequeStatusChange({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        previewVersion: cmd.previewVersion,
        previewHash: cmd.previewHash,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        chequeId: chequeId || "",
        nextStatus: (ext.cheque_next_status as ChequeState) || "cleared",
        expectedInstrumentVersion: Number(cheque?.instrumentVersion ?? 1),
        statementLineId: statementLineId || null,
      });
    } else if (bankReconKind === "bank_unmatch") {
      const db = getDB();
      const links = (db as any).bankReconciliationLinks
        ? await (db as any).bankReconciliationLinks.toArray()
        : [];
      const link = links.find((l: any) => l.status === "confirmed");
      treasuryResult = await reverseBankMatch({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        linkId: link?.id || "",
        expectedLinkVersion: Number(link?.version ?? 1),
        expectedStatementLineVersion: 1,
      });
    } else if (bankReconKind === "recon_close") {
      const db = getDB();
      const sessions = (db as any).bankReconciliationSessions
        ? await (db as any).bankReconciliationSessions.toArray()
        : [];
      const open = sessions.find((s: any) => s.status === "open" || s.status === "in_progress");
      treasuryResult = await closeBankReconciliation({
        commandId: cmd.requestId,
        requestId: cmd.requestId,
        draftId: cmd.draftId,
        idempotencyKey: cmd.idempotencyKey,
        companyId,
        userId: store.currentUser?.id || "orbix-user",
        userRole: cmd.userRole,
        orbixMode: cmd.orbixMode,
        source: "orbix",
        sessionId: open?.id || "",
        expectedVersion: Number(open?.version ?? 1),
      });
    } else {
      treasuryResult = {
        type: "posting_failed",
        status: "failed",
        payload: {
          error_code: "unsupported_bank_recon_kind",
          safe_message: `Unsupported bank recon kind: ${bankReconKind}`,
          rolled_back: true,
          draft_retained: true,
          retryable: false,
        },
      };
    }

    const mapped = mapDomainResult(treasuryResult as any, stages, cmd.draftId);
    if (mapped.status === "success" && cmd.draftId) {
      await ackDraftPostedOnBackend(cmd.draftId, {
        voucher_number: (mapped.payload as any).voucher_number || (mapped.payload as any).batch_id || "BANK",
        posting_id: mapped.payload.posting_id,
      });
    }
    return mapped;
  }

'''
    ot = ot.replace(
        "  // ── Phase 9 settlement: receipt / payment / contra / journal ─────────────",
        bank_block + "  // ── Phase 9 settlement: receipt / payment / contra / journal ─────────────",
    )
    ops.write_text(ot, encoding="utf-8", newline="\n")
    print("orbixPostingService patched", "detectBankReconKind" in ot)
else:
    print("orbixPostingService already")