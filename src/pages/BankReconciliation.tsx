// src/pages/BankReconciliation.tsx
// @ts-nocheck
import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Select, NepaliDatePicker, Button } from "../components/ui";
import { PageHeader, Button as DsButton } from "@/design-system";
import {
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  Plus,
  Printer,
  CheckCircle,
  Upload,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  CheckCircle2,
  Info,
  Smartphone,
} from "lucide-react";
import toast from "@/lib/appToast";
import { formatNumber, generateId } from "../lib/utils";
import { formatADToBS } from "../lib/nepaliDate";
import {
  runMatchingEngine,
  createManualMatch,
  computeReconciliationSummary,
  BookEntry,
  StatementEntry,
  MatchPair,
  MatchConfidence,
} from "../lib/bankMatchingEngine";
import {
  confirmMatchViaTreasury,
  postAdjustmentViaTreasury,
  closeSessionViaTreasury,
  openSessionViaTreasury,
} from "@/domains/treasury/uiAdapters";
import { getDB } from "@/lib/db";
import { useBranchFilter } from "../hooks/useBranchFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = "bank" | "digital";
type DigitalMode = "esewa" | "khalti" | "connectips";

const CONFIDENCE_COLORS: Record<MatchConfidence, string> = {
  HIGH: "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)] border-[var(--ds-status-success)]/40",
  MEDIUM: "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)] border-[var(--ds-status-warning)]/40",
  LOW: "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)] border-[var(--ds-status-danger)]/40",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBookEntries(vouchers: any[], accountId: string): BookEntry[] {
  const entries: BookEntry[] = [];
  vouchers.forEach((v) => {
    if (v.status !== "posted") return;
    v.lines?.forEach((line: any, idx: number) => {
      if (line.accountId !== accountId) return;
      const dr = Number(line.drAmount ?? line.debit ?? 0);
      const cr = Number(line.crAmount ?? line.credit ?? 0);
      const amount = dr > 0 ? dr : cr;
      if (amount === 0) return;
      entries.push({
        id: `${v.id}-${idx}`,
        date: v.date,
        amount,
        description: v.narration || v.voucherNo || "",
        voucherId: v.id,
        voucherNo: v.voucherNo,
        type: dr > 0 ? "debit" : "credit",
        refNo: v.referenceNo || v.chequeNo || line.chequeNo || "",
        partyName: v.partyName || "",
      });
    });
  });
  return entries;
}

function buildStatementEntries(
  bankStatements: any[],
  accountId: string,
  dateFrom: string,
  dateTo: string,
): StatementEntry[] {
  return (bankStatements as any[])
    .filter((bs) => {
      if (bs.bankAccountId !== accountId && bs.ledgerAccountId !== accountId) return false;
      // Phase 10 domain lines: unmatched / remaining > 0. Never trust contradictory legacy reconciled flag when domain status exists.
      const hasDomainStatus = bs.status != null || bs.remainingMatchPaisa != null;
      if (hasDomainStatus) {
        const remaining = Number(bs.remainingMatchPaisa ?? -1);
        const unmatched =
          bs.status === "unmatched" ||
          bs.status === "partial" ||
          remaining > 0 ||
          (bs.status !== "matched" && bs.status !== "Matched" && remaining !== 0);
        if (!unmatched && remaining === 0) return false;
        if (bs.status === "matched" || bs.status === "Matched") return false;
      } else if (bs.reconciled) {
        return false;
      }
      if (dateFrom && (bs.date || bs.transactionDate) < dateFrom) return false;
      if (dateTo && (bs.date || bs.transactionDate) > dateTo) return false;
      return true;
    })
    .map((bs) => ({
      id: bs.id,
      date: bs.date || bs.transactionDate,
      description: bs.narration || bs.description || "",
      refNo: bs.chequeNo || bs.refNo || bs.reference || "",
      debit: Number(bs.debit ?? (bs.debitPaisa != null ? Number(bs.debitPaisa) / 100 : 0)),
      credit: Number(bs.credit ?? (bs.creditPaisa != null ? Number(bs.creditPaisa) / 100 : 0)),
      balance: Number(bs.balance ?? (bs.balancePaisa != null ? Number(bs.balancePaisa) / 100 : 0)),
      bankFormat: bs.bankFormat,
    }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ confidence: MatchConfidence; reason: string }> = ({
  confidence,
  reason,
}) => (
  <span
    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[12px] font-bold uppercase cursor-help ${CONFIDENCE_COLORS[confidence]}`}
    title={reason}
  >
    {confidence}
  </span>
);

const AmountChip: React.FC<{ amount: number; type: "debit" | "credit" }> = ({ amount, type }) => (
  <span
    className={`font-mono font-bold text-[12px] ${type === "debit" ? "text-emerald-700" : "text-red-600"}`}
  >
    {type === "debit" ? "+" : "−"} Rs.{formatNumber(amount)}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BankReconciliation() {
  const {
    accounts,
    vouchers,
    bankStatements,
    companySettings,
    currentUser,
    addVoucher,
    updateBankStatements,
    saveAuditLog,
    setCurrentPage,
  } = useStore();

  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bank");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [digitalMode, setDigitalMode] = useState<DigitalMode>("esewa");
  /** Phase 10 authoritative statement lines (wins over legacy store.bankStatements). */
  const [domainStatementLines, setDomainStatementLines] = useState<any[]>([]);

  // ── Reconciliation state ──────────────────────────────────────────────────
  const [matchedPairs, setMatchedPairs] = useState<MatchPair[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedStmtId, setSelectedStmtId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // ── Create-voucher modal state ─────────────────────────────────────────────
  const [voucherModal, setVoucherModal] = useState<{
    stmtEntry: StatementEntry;
    type: "journal" | "payment" | "receipt";
    counterAccountId: string;
    narration: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDB();
        const lines = (db as any).bankStatementLines
          ? await (db as any).bankStatementLines.toArray()
          : [];
        const banks = (db as any).bankAccounts
          ? await (db as any).bankAccounts.toArray()
          : [];
        const ledgerByBank = new Map(
          (banks || []).map((b: any) => [String(b.id), String(b.ledgerAccountId || "")]),
        );
        const enriched = (Array.isArray(lines) ? lines : []).map((l: any) => ({
          ...l,
          ledgerAccountId: ledgerByBank.get(String(l.bankAccountId)) || l.ledgerAccountId,
          authority: "phase10_bankStatementLines",
        }));
        if (!cancelled) setDomainStatementLines(enriched);
      } catch {
        if (!cancelled) setDomainStatementLines([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchedPairs.length, hasRun]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const bankAccounts = useMemo(
    () =>
      accounts.filter(
        (a: any) => !a.isGroup && (a.group === "Bank Accounts" || a.group === "Bank OD Accounts"),
      ),
    [accounts],
  );

  const allAccounts = useMemo(() => accounts.filter((a: any) => !a.isGroup), [accounts]);

  const scopedVouchers = useMemo(
    () => (vouchers || []).filter((v: any) => matchBranch(v?.branchId)),
    [vouchers, matchBranch, branchFilter],
  );

  const allBookEntries = useMemo(
    () => (selectedAccountId ? buildBookEntries(scopedVouchers, selectedAccountId) : []),
    [scopedVouchers, selectedAccountId],
  );

  const statementSource = useMemo(() => {
    if (domainStatementLines.length > 0) return domainStatementLines;
    return (bankStatements || []).map((r: any) => ({
      ...r,
      authority: "legacy_bankStatements_fallback",
    }));
  }, [domainStatementLines, bankStatements]);

  const allStmtEntries = useMemo(
    () =>
      selectedAccountId
        ? buildStatementEntries(statementSource, selectedAccountId, dateFrom, dateTo)
        : [],
    [statementSource, selectedAccountId, dateFrom, dateTo],
  );

  // Already-matched IDs
  const matchedBookIds = useMemo(
    () => new Set(matchedPairs.map((p) => p.bookEntry.id)),
    [matchedPairs],
  );
  const matchedStmtIds = useMemo(
    () => new Set(matchedPairs.map((p) => p.statementEntry.id)),
    [matchedPairs],
  );

  const unmatchedBook = useMemo(
    () => allBookEntries.filter((b) => !matchedBookIds.has(b.id)),
    [allBookEntries, matchedBookIds],
  );

  const unmatchedStmt = useMemo(
    () => allStmtEntries.filter((s) => !matchedStmtIds.has(s.id)),
    [allStmtEntries, matchedStmtIds],
  );

  // Book running balance
  const bankAccount = accounts.find((a: any) => a.id === selectedAccountId);
  const bookBalance = useMemo(() => {
    const opening = (bankAccount?.openingBalanceDr ?? 0) - (bankAccount?.openingBalanceCr ?? 0);
    return allBookEntries.reduce(
      (sum, b) => (b.type === "debit" ? sum + b.amount : sum - b.amount),
      opening,
    );
  }, [allBookEntries, bankAccount]);

  const summary = useMemo(
    () => computeReconciliationSummary(allBookEntries, unmatchedBook, allStmtEntries, bookBalance),
    [allBookEntries, unmatchedBook, allStmtEntries, bookBalance],
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAutoMatch = () => {
    if (!selectedAccountId) {
      toast.error("Select a bank account first.");
      return;
    }
    const { matched } = runMatchingEngine(unmatchedBook, unmatchedStmt);
    if (matched.length === 0) {
      toast("No new matches found.", { icon: "ℹ️" });
      return;
    }
    setMatchedPairs((prev) => [...prev, ...matched]);
    setHasRun(true);
    toast.success(`${matched.length} pair(s) auto-matched!`);
  };

  const handleManualMatch = () => {
    if (!selectedBookId || !selectedStmtId) {
      toast.error("Select one entry from each side to match.");
      return;
    }
    const book = unmatchedBook.find((b) => b.id === selectedBookId);
    const stmt = unmatchedStmt.find((s) => s.id === selectedStmtId);
    if (!book || !stmt) {
      toast.error("Could not find selected entries.");
      return;
    }

    setMatchedPairs((prev) => [...prev, createManualMatch(book, stmt)]);
    setSelectedBookId(null);
    setSelectedStmtId(null);
    toast.success("Manually matched!");
  };

  const handleUnmatch = (bookId: string) => {
    setMatchedPairs((prev) => prev.filter((p) => p.bookEntry.id !== bookId));
  };

  const handleSave = async () => {
    if (matchedPairs.length === 0) {
      toast.error("Nothing to save.");
      return;
    }
    try {
      const db = getDB();
      let confirmed = 0;
      for (const p of matchedPairs) {
        const line = await (db as any).bankStatementLines?.get?.(p.statementEntry.id);
        const version = Number(line?.reconciliationVersion ?? 1);
        const amount = Number(p.statementEntry.debit || p.statementEntry.credit || p.bookEntry.amount || 0);
        const result = await confirmMatchViaTreasury({
          ledgerOrBankAccountId: selectedAccountId,
          statementLineId: p.statementEntry.id,
          erpDocumentIds: [p.bookEntry.voucherId],
          matchedAmount: amount,
          expectedStatementLineVersion: version,
          explanation: p.matchReason || "Manual UI match",
        });
        if (result.type !== "posting_completed") {
          toast.error(result.payload?.safe_message || "Match failed");
          return;
        }
        confirmed += 1;
      }
      await saveAuditLog?.({
        id: generateId(),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || "system",
        action: "BANK_RECONCILIATION_SAVED",
        module: "banking",
        recordId: selectedAccountId,
        recordType: "bank-account",
        details: JSON.stringify({
          matched: confirmed,
          period: `${dateFrom} to ${dateTo}`,
          authority: "confirmBankMatch",
        }),
      });
      toast.success(`Reconciliation saved — ${confirmed} pairs.`);
      setMatchedPairs([]);
      setHasRun(false);
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    }
  };

  const handleCloseReconciliation = async () => {
    try {
      const statementBalancePaisa = Math.round(Number(summary?.statementBalance || 0) * 100);
      const bookBalancePaisa = Math.round(Number(bookBalance || 0) * 100);
      const opened = await openSessionViaTreasury({
        ledgerOrBankAccountId: selectedAccountId,
        periodStart: dateFrom,
        periodEnd: dateTo,
        statementBalancePaisa,
        bookBalancePaisa,
      });
      if (opened.type !== "posting_completed") {
        toast.error(opened.payload?.safe_message || "Could not open session");
        return;
      }
      const closed = await closeSessionViaTreasury({
        sessionId: opened.payload.session_id,
        expectedVersion: opened.payload.session_version,
      });
      if (closed.type !== "posting_completed") {
        toast.error(closed.payload?.safe_message || "Close rejected (difference?)");
        return;
      }
      toast.success("Reconciliation session closed.");
    } catch (err: any) {
      toast.error("Close failed: " + err.message);
    }
  };

  // ── Create voucher from statement line ─────────────────────────────────────

  const openCreateVoucher = (stmt: StatementEntry) => {
    setVoucherModal({
      stmtEntry: stmt,
      type: "journal",
      counterAccountId: "",
      narration: stmt.description,
    });
  };

  const handleCreateVoucher = async () => {
    if (!voucherModal) return;
    const { stmtEntry: stmt, type, counterAccountId, narration } = voucherModal;
    if (!counterAccountId) {
      toast.error("Select a counter account.");
      return;
    }

    try {
      const isDebit = stmt.debit > 0;
      const amount = isDebit ? stmt.debit : stmt.credit;
      const db = getDB();
      const line = await (db as any).bankStatementLines?.get?.(stmt.id);
      const version = Number(line?.reconciliationVersion ?? 1);
      const adjustmentType = isDebit ? "bank_charge" : "bank_interest";
      const result = await postAdjustmentViaTreasury({
        ledgerOrBankAccountId: selectedAccountId,
        statementLineId: stmt.id,
        expectedStatementLineVersion: version,
        adjustmentType,
        amount,
        offsetAccountId: counterAccountId,
        useJournal: type === "journal",
        narration,
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Adjustment failed");
        return;
      }
      const vId = result.payload.voucher_id;
      const newBookEntry: BookEntry = {
        id: `${vId}-0`,
        date: stmt.date,
        amount,
        description: narration,
        voucherId: vId,
        voucherNo: result.payload.voucher_number,
        type: isDebit ? "credit" : "debit",
      };
      setMatchedPairs((prev) => [...prev, createManualMatch(newBookEntry, stmt)]);
      setVoucherModal(null);
      toast.success("Adjustment posted via Phase 9 and linked to statement.");
    } catch (err: any) {
      toast.error("Failed to create voucher: " + err.message);
    }
  };

  // ── Digital payment commission voucher ────────────────────────────────────

  const handleCreateCommissionVoucher = async (stmt: StatementEntry, invoiceAmount: number) => {
    const commissionAcct = accounts.find(
      (a: any) =>
        a.name.toLowerCase().includes("commission") || a.name.toLowerCase().includes("bank charge"),
    );
    if (!commissionAcct) {
      toast.error('Add a "Commission Expense" or "Bank Charges" account first.');
      return;
    }
    const settlementAmt = stmt.credit;
    const commission = invoiceAmount - settlementAmt;
    if (commission <= 0) {
      toast.error("No commission difference to post.");
      return;
    }

    try {
      const db = getDB();
      const line = await (db as any).bankStatementLines?.get?.(stmt.id);
      const version = Number(line?.reconciliationVersion ?? 1);
      const result = await postAdjustmentViaTreasury({
        ledgerOrBankAccountId: selectedAccountId,
        statementLineId: stmt.id,
        expectedStatementLineVersion: version,
        adjustmentType: "bank_charge",
        amount: commission,
        offsetAccountId: commissionAcct.id,
        useJournal: true,
        narration: `${digitalMode.toUpperCase()} commission on ${stmt.description}`,
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Commission adjustment failed");
        return;
      }
      toast.success(`Commission voucher created: Rs.${formatNumber(commission)}`);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

  const printReport = () => {
    const company = companySettings?.companyNameEn || companySettings?.name || "Company";
    const accName = bankAccount?.name || "—";
    const asOnDate = dateTo || new Date().toISOString().split("T")[0];

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Bank Reconciliation Statement</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: var(--ds-action-primary); margin: 0; padding: 16px; }
  h1 { text-align: center; font-size: 15px; margin: 0 0 2px; }
  .company { text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 12px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 12px; font-size: 10px; }
  .meta span { display: block; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: var(--ds-action-primary); text-align: left; padding: 4px 6px; font-size: 10px; border: 1px solid var(--ds-action-primary); }
  td { padding: 3px 6px; border: 1px solid var(--ds-action-primary); }
  .section-head { background: var(--ds-action-primary); font-weight: bold; padding: 4px 6px; }
  .total { font-weight: bold; border-top: 2px solid var(--ds-action-primary); }
  .diff-ok { color: green; }
  .diff-bad { color: red; }
  .footer { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; }
  .footer div { border-top: 1px solid var(--ds-action-primary); padding-top: 4px; text-align: center; font-size: 10px; }
  @media print { body { padding: 8px; } }
</style>
</head>
<body>
<div class="company">${company}</div>
<h1>Bank Reconciliation Statement</h1>
<div class="meta">
  <span><b>Bank Account:</b> ${accName}</span>
  <span><b>Account No.:</b> ${bankAccount?.accountNo || "—"}</span>
  <span><b>Bank Name:</b> ${bankAccount?.bankName || "—"}</span>
  <span><b>As on Date:</b> ${asOnDate}</span>
  <span><b>Period:</b> ${dateFrom || "—"} to ${dateTo || "—"}</span>
</div>

<table>
  <tr><td class="section-head" colspan="2">Balance as per Bank Statement</td></tr>
  <tr><td>Closing Balance (Bank Statement)</td><td style="text-align:right">Rs. ${formatNumber(summary.statementClosingBalance)}</td></tr>

  <tr><td class="section-head" colspan="2">Less: Uncleared Cheques / Payments Issued</td></tr>
  ${summary.unclearedCheques
    .map(
      (x) => `
  <tr>
    <td style="padding-left:16px">${x.entry.date} — ${x.entry.description} (${x.entry.voucherNo})</td>
    <td style="text-align:right">(${formatNumber(x.amount)})</td>
  </tr>`,
    )
    .join("")}
  ${summary.unclearedCheques.length === 0 ? '<tr><td colspan="2" style="padding-left:16px;color:var(--ds-action-primary)">None</td></tr>' : ""}

  <tr><td class="section-head" colspan="2">Add: Deposits in Transit / Uncleared Receipts</td></tr>
  ${summary.depositsInTransit
    .map(
      (x) => `
  <tr>
    <td style="padding-left:16px">${x.entry.date} — ${x.entry.description} (${x.entry.voucherNo})</td>
    <td style="text-align:right">${formatNumber(x.amount)}</td>
  </tr>`,
    )
    .join("")}
  ${summary.depositsInTransit.length === 0 ? '<tr><td colspan="2" style="padding-left:16px;color:var(--ds-action-primary)">None</td></tr>' : ""}

  <tr class="total">
    <td>Adjusted Balance as per Bank Statement</td>
    <td style="text-align:right">Rs. ${formatNumber(summary.adjustedStatementBalance)}</td>
  </tr>
  <tr class="total">
    <td>Balance as per Books</td>
    <td style="text-align:right">Rs. ${formatNumber(summary.bookBalance)}</td>
  </tr>
  <tr class="total">
    <td>Difference (should be zero)</td>
    <td style="text-align:right;${summary.isReconciled ? "color:green" : "color:red"}">
      Rs. ${formatNumber(summary.difference)} ${summary.isReconciled ? "✓ Reconciled" : "✗ Difference exists"}
    </td>
  </tr>
</table>

<div class="footer">
  <div>Prepared by<br><br>${currentUser?.name || "_______________"}</div>
  <div>Date<br><br>${new Date().toLocaleDateString()}</div>
  <div>Checked by<br><br>_______________</div>
</div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  // ── Panel entry card helpers ──────────────────────────────────────────────

  const BookEntryCard: React.FC<{ entry: BookEntry }> = ({ entry }) => {
    const isSelected = selectedBookId === entry.id;
    return (
      <div
        onClick={() => setSelectedBookId(isSelected ? null : entry.id)}
        className={`p-2.5 rounded-lg border cursor-pointer transition-all select-none
          ${
            isSelected
              ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
              : "border-[var(--ds-border-default)] bg-white hover:bg-[var(--ds-action-primary)]"
          }`}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="text-[12px] text-gray-500 font-mono">{entry.date}</div>
            <div
              className="text-[12px] font-semibold text-gray-800 truncate"
              title={entry.description}
            >
              {entry.description || "No narration"}
            </div>
            <div className="text-[12px] text-gray-500">{entry.voucherNo}</div>
          </div>
          <AmountChip amount={entry.amount} type={entry.type} />
        </div>
        {entry.refNo && (
          <div className="text-[12px] text-gray-400 mt-0.5 font-mono">Ref: {entry.refNo}</div>
        )}
      </div>
    );
  };

  const StmtEntryCard: React.FC<{ entry: StatementEntry; onCreateVoucher?: () => void }> = ({
    entry,
    onCreateVoucher,
  }) => {
    const isSelected = selectedStmtId === entry.id;
    const stmtType = entry.credit > 0 ? "credit" : "debit";
    const amount = entry.credit > 0 ? entry.credit : entry.debit;
    return (
      <div
        className={`p-2.5 rounded-lg border transition-all select-none
          ${
            isSelected
              ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
              : "border-[var(--ds-border-default)] bg-white hover:bg-[var(--ds-action-primary)]"
          }`}
      >
        <div
          className="flex justify-between items-start gap-2 cursor-pointer"
          onClick={() => setSelectedStmtId(isSelected ? null : entry.id)}
        >
          <div className="min-w-0">
            <div className="text-[12px] text-gray-500 font-mono">{entry.date}</div>
            <div
              className="text-[12px] font-semibold text-gray-800 truncate"
              title={entry.description}
            >
              {entry.description || "No narration"}
            </div>
            {entry.refNo && (
              <div className="text-[12px] text-gray-400 font-mono">Ref: {entry.refNo}</div>
            )}
          </div>
          <AmountChip amount={amount} type={stmtType} />
        </div>
        {onCreateVoucher && (
          <div className="mt-1.5 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateVoucher();
              }}
              className="flex items-center gap-1 h-6 px-2 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary)] border border-[var(--ds-border-default)] rounded text-[12px] font-bold text-gray-600 transition-colors"
            >
              <Plus className="h-2.5 w-2.5" /> Create Voucher
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Match bank statement"
        description="Match books to bank and wallets"
        primaryAction={
          <DsButton
            variant="primary"
            size="small"
            onClick={handleSave}
            disabled={matchedPairs.length === 0}
            startIcon={<CheckCircle className="h-3.5 w-3.5" aria-hidden />}
          >
            Save reconciliation
          </DsButton>
        }
        secondaryActions={[
          <DsButton
            key="auto"
            variant="secondary"
            size="small"
            onClick={handleAutoMatch}
            startIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          >
            Auto match
          </DsButton>,
          <DsButton
            key="manual"
            variant="secondary"
            size="small"
            onClick={handleManualMatch}
            disabled={!selectedBookId || !selectedStmtId}
            startIcon={<LinkIcon className="h-3.5 w-3.5" aria-hidden />}
          >
            Match selected
          </DsButton>,
        ]}
        overflowActions={[
          { label: "Close session", onSelect: handleCloseReconciliation },
          { label: "Print report", onSelect: printReport },
          {
            label: "Import statement",
            onSelect: () => setCurrentPage("bank-statement-import"),
          },
        ]}
      />

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[var(--ds-border-default)] bg-white px-4 shrink-0">
        {(
          [
            { id: "bank", label: "Bank" },
            { id: "digital", label: "eSewa · Khalti · ConnectIPS" },
          ] as { id: ActiveTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 text-[13px] font-semibold border-b-2 transition-colors
              ${
                activeTab === tab.id
                  ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex items-end gap-3 px-4 py-3 bg-white border-b border-[var(--ds-border-default)] shrink-0 flex-wrap">
        {branchOptions.length > 0 && (
          <div className="w-44">
            <Select
              label="Branch"
              value={branchFilter}
              onChange={(val) => setBranchFilter(val)}
              options={[
                { value: "all", label: "All branches" },
                ...branchOptions.map((b) => ({
                  value: b.id,
                  label: b.name || b.code || b.id,
                })),
              ]}
            />
          </div>
        )}
        <div className="w-56">
          <Select
            label="Bank Account"
            value={selectedAccountId}
            onChange={(val) => {
              setSelectedAccountId(val);
              setMatchedPairs([]);
            }}
            options={bankAccounts.map((a: any) => ({ value: a.id, label: a.name }))}
          />
        </div>
        <div className="w-40">
          <NepaliDatePicker label="From Date" value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="w-40">
          <NepaliDatePicker label="To Date" value={dateTo} onChange={setDateTo} />
        </div>
        {activeTab === "digital" && (
          <div className="w-44">
            <Select
              label="Digital Platform"
              value={digitalMode}
              onChange={(val) => setDigitalMode(val as DigitalMode)}
              options={[
                { value: "esewa", label: "eSewa" },
                { value: "khalti", label: "Khalti" },
                { value: "connectips", label: "ConnectIPS" },
              ]}
            />
          </div>
        )}
      </div>

      {/* ── Main 3-panel area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {!selectedAccountId ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Select a bank account to begin reconciliation</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_280px_1fr] h-full gap-0 overflow-hidden">
            {/* LEFT: Unmatched Book Entries */}
            <div className="flex flex-col h-full overflow-hidden border-r border-[var(--ds-border-default)]">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--ds-action-primary)] shrink-0">
                <div>
                  <h3 className="text-[13px] font-semibold text-white">📒 Book Entries</h3>
                  <p className="text-[12px] text-gray-400">{unmatchedBook.length} unmatched</p>
                </div>
                {selectedBookId && (
                  <span className="text-[12px] bg-blue-500 text-white px-2 py-0.5 rounded-full">
                    1 selected
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[var(--ds-action-primary)]">
                {unmatchedBook.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400">
                    <CheckCircle2 className="h-8 w-8 mb-1 text-green-400" />
                    <p className="text-[12px]">All book entries matched!</p>
                  </div>
                ) : (
                  unmatchedBook.map((entry) => <BookEntryCard key={entry.id} entry={entry} />)
                )}
              </div>
            </div>

            {/* CENTER: Matched Pairs */}
            <div className="flex flex-col h-full overflow-hidden border-r border-[var(--ds-border-default)]">
              <div className="px-3 py-2 bg-[var(--ds-action-primary)] shrink-0">
                <h3 className="text-[13px] font-semibold text-white">Matched pairs</h3>
                <p className="text-[12px] text-green-200">{matchedPairs.length} pair(s)</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[var(--ds-action-primary)]">
                {matchedPairs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400 px-3">
                    <LinkIcon className="h-7 w-7 mb-1 opacity-30" />
                    <p className="text-[12px]">
                      Run Auto Match or select one entry from each panel and click Match Selected
                    </p>
                  </div>
                ) : (
                  matchedPairs.map((pair) => (
                    <div
                      key={pair.bookEntry.id}
                      className="bg-white border border-green-300 rounded-lg p-2 shadow-sm"
                    >
                      {/* Book side */}
                      <div className="pb-1.5 border-b border-dashed border-gray-200 mb-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] font-bold text-gray-400 uppercase">Book</span>
                          <AmountChip amount={pair.bookEntry.amount} type={pair.bookEntry.type} />
                        </div>
                        <div className="text-[12px] font-semibold text-gray-700 truncate">
                          {pair.bookEntry.description}
                        </div>
                        <div className="text-[12px] text-gray-400 font-mono">
                          {pair.bookEntry.date} · {pair.bookEntry.voucherNo}
                        </div>
                      </div>
                      {/* Statement side */}
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] font-bold text-gray-400 uppercase">
                            Statement
                          </span>
                          <AmountChip
                            amount={
                              pair.statementEntry.credit > 0
                                ? pair.statementEntry.credit
                                : pair.statementEntry.debit
                            }
                            type={pair.statementEntry.credit > 0 ? "credit" : "debit"}
                          />
                        </div>
                        <div className="text-[12px] font-semibold text-gray-700 truncate">
                          {pair.statementEntry.description}
                        </div>
                        <div className="text-[12px] text-gray-400 font-mono">
                          {pair.statementEntry.date}
                        </div>
                      </div>
                      {/* Confidence + Unmatch */}
                      <div className="flex items-center justify-between mt-1.5">
                        <ConfidenceBadge confidence={pair.confidence} reason={pair.matchReason} />
                        <button
                          onClick={() => handleUnmatch(pair.bookEntry.id)}
                          className="flex items-center gap-0.5 text-[12px] text-red-500 hover:text-red-700 font-bold"
                        >
                          <Unlink className="h-2.5 w-2.5" /> Unmatch
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Manual match button */}
              {selectedBookId && selectedStmtId && (
                <div className="shrink-0 p-2 bg-blue-50 border-t border-blue-200">
                  <button
                    onClick={handleManualMatch}
                    className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> Match Selected Pair
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: Unmatched Statement Entries */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--ds-action-primary)] shrink-0">
                <div>
                  <h3 className="text-[12px] font-semibold text-white">Bank statement</h3>
                  <p className="text-[12px] text-gray-400">{unmatchedStmt.length} unmatched</p>
                </div>
                {selectedStmtId && (
                  <span className="text-[12px] bg-blue-500 text-white px-2 py-0.5 rounded-full">
                    1 selected
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[var(--ds-action-primary)]">
                {unmatchedStmt.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400">
                    <CheckCircle2 className="h-8 w-8 mb-1 text-green-400" />
                    <p className="text-[12px]">All statement lines matched!</p>
                  </div>
                ) : (
                  unmatchedStmt.map((stmt) => (
                    <StmtEntryCard
                      key={stmt.id}
                      entry={stmt}
                      onCreateVoucher={() => openCreateVoucher(stmt)}
                    />
                  ))
                )}
              </div>
              {unmatchedStmt.length > 0 && (
                <div className="shrink-0 p-2 border-t border-[var(--ds-border-default)] bg-[var(--ds-action-primary)] text-[12px] text-gray-500 flex items-center gap-1">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  Click a statement line to select it, then pick a book entry on the left and click
                  "Match Selected". Use "Create Voucher" for bank charges / interest not in books.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Reconciliation Summary Footer ─────────────────────────────── */}
      {selectedAccountId && (
        <div className="shrink-0 border-t border-[var(--ds-border-default)] bg-white px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <SummaryTile label="Book Balance" value={summary.bookBalance} color="blue" />
            <SummaryTile
              label="Statement Balance"
              value={summary.statementClosingBalance}
              color="purple"
            />
            <SummaryTile
              label="Uncleared Cheques"
              value={-summary.unclearedCheques.reduce((s, x) => s + x.amount, 0)}
              color="red"
            />
            <SummaryTile
              label="Deposits in Transit"
              value={summary.depositsInTransit.reduce((s, x) => s + x.amount, 0)}
              color="green"
            />
            <SummaryTile
              label="Adj. Statement Balance"
              value={summary.adjustedStatementBalance}
              color="gray"
            />
            <div
              className={`rounded-lg border p-2.5 ${summary.isReconciled ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}
            >
              <div className="text-[12px] uppercase font-bold text-gray-500 mb-0.5">Difference</div>
              <div
                className={`text-[14px] font-bold font-mono ${summary.isReconciled ? "text-green-700" : "text-red-600"}`}
              >
                Rs. {formatNumber(Math.abs(summary.difference))}
              </div>
              <div
                className={`text-[12px] font-bold mt-0.5 ${summary.isReconciled ? "text-green-600" : "text-red-500"}`}
              >
                {summary.isReconciled ? "✓ Reconciled" : "✗ Not balanced"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Voucher Modal ──────────────────────────────────────── */}
      {voucherModal && (
        <div className="fixed inset-0 z-[var(--ds-z-dropdown)] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[var(--ds-action-primary)] px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-bold text-white">Create Voucher from Statement</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  For bank charges, interest, or other items
                </p>
              </div>
              <button
                onClick={() => setVoucherModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Statement info */}
              <div className="bg-[var(--ds-action-primary)] border border-[var(--ds-border-default)] rounded-lg p-3 text-[12px]">
                <p className="font-bold text-gray-700 mb-1">Statement Entry</p>
                <p className="text-gray-600">{voucherModal.stmtEntry.description}</p>
                <p className="text-gray-500 font-mono mt-0.5">{voucherModal.stmtEntry.date}</p>
                <AmountChip
                  amount={
                    voucherModal.stmtEntry.credit > 0
                      ? voucherModal.stmtEntry.credit
                      : voucherModal.stmtEntry.debit
                  }
                  type={voucherModal.stmtEntry.credit > 0 ? "credit" : "debit"}
                />
              </div>

              {/* Voucher type */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-gray-500 mb-1">
                  Voucher Type
                </label>
                <select
                  aria-label="Voucher type"
                  value={voucherModal.type}
                  onChange={(e) =>
                    setVoucherModal((m) => (m ? { ...m, type: e.target.value as any } : m))
                  }
                  className="w-full h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md"
                >
                  <option value="journal">Journal</option>
                  <option value="payment">Payment</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>

              {/* Counter account */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-gray-500 mb-1">
                  Counter Account *
                </label>
                <select
                  aria-label="Counter account"
                  value={voucherModal.counterAccountId}
                  onChange={(e) =>
                    setVoucherModal((m) => (m ? { ...m, counterAccountId: e.target.value } : m))
                  }
                  className="w-full h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md"
                >
                  <option value="">Select account...</option>
                  {allAccounts
                    .filter((a: any) => a.id !== selectedAccountId)
                    .map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Narration */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-gray-500 mb-1">
                  Narration
                </label>
                <input
                  type="text"
                  value={voucherModal.narration}
                  onChange={(e) =>
                    setVoucherModal((m) => (m ? { ...m, narration: e.target.value } : m))
                  }
                  className="w-full h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setVoucherModal(null)}
                  className="flex-1 h-8 border border-[var(--ds-border-default)] text-gray-600 text-[12px] font-medium rounded-lg hover:bg-[var(--ds-action-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVoucher}
                  className="flex-1 h-8 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary)] text-white text-[12px] font-bold rounded-lg"
                >
                  Save & Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Tile ─────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  purple: "bg-[var(--ds-status-info-surface)] border-[var(--ds-status-info)]/30 text-[var(--ds-status-info)]",
  red: "bg-red-50 border-red-200 text-red-700",
  green: "bg-green-50 border-green-200 text-green-700",
  gray: "bg-gray-50 border-gray-200 text-gray-700",
};

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border p-2.5 ${COLOR_MAP[color] || COLOR_MAP.gray}`}>
      <div className="text-[12px] uppercase font-bold opacity-60 mb-0.5">{label}</div>
      <div className="text-[13px] font-bold font-mono">Rs. {formatNumber(value)}</div>
    </div>
  );
}
