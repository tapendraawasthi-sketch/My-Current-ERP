// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { importStatementViaTreasury, postAdjustmentViaTreasury } from "@/domains/treasury/uiAdapters";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Link2,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Upload,
  WalletCards,
  Wand2,
  XCircle,
  Plus,
} from "lucide-react";

const money = (v: any) =>
  `Rs. ${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const btn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ds-action-primary)] text-white text-[12px] font-medium hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btn2 =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-[12px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDanger =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const input =
  "w-full h-8 px-2.5 rounded-md border border-gray-300 bg-white text-[12px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] focus:border-[var(--ds-action-primary)]";
const card = "bg-white border border-gray-200 rounded-lg p-4 text-gray-700 shadow-sm";
const th =
  "px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide bg-[var(--ds-surface-muted)] border-b border-gray-200 text-gray-500";
const td = "px-3 py-2.5 text-[12px] border-b border-gray-100 align-top text-gray-700";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const tableAll = (db: any, name: string) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.toArray) return t.toArray().catch(() => []);
    return Promise.resolve([]);
  } catch {
    return Promise.resolve([]);
  }
};

const tablePut = async (db: any, name: string, rows: any[]) => {
  if (!rows?.length) return;
  const t = db?.table ? db.table(name) : db?.[name];
  if (!t?.bulkPut) throw new Error(`Table ${name} not found`);
  await t.bulkPut(rows);
};

const tableDelete = async (db: any, name: string, id: any) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.delete) await t.delete(id);
  } catch (err) {
    console.warn("delete failed", name, err);
  }
};

const readFileArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

const cleanAmount = (v: any) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  return (
    Number(
      String(v)
        .replace(/,/g, "")
        .replace(/[^\d.-]/g, ""),
    ) || 0
  );
};

const normalizeDate = (v: any) => {
  if (!v) return "";

  if (typeof v === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) {
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
    } catch {
      return "";
    }
  }

  const s = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const slash = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (slash) {
    const d = slash[1].padStart(2, "0");
    const m = slash[2].padStart(2, "0");
    let y = slash[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return "";
};

const findCol = (row: any, names: string[]) => {
  const keys = Object.keys(row || {});
  const found = keys.find((k) =>
    names.some((n) => String(k).toLowerCase().replace(/\s+/g, "").includes(n)),
  );
  return found ? row[found] : "";
};

const accountName = (accounts: any[], id: string) =>
  accounts.find((a) => a.id === id)?.name ||
  accounts.find((a) => a.accountId === id)?.name ||
  id ||
  "-";

const isBankAccount = (a: any) => {
  const hay = [a.name, a.group, a.groupName, a.type, a.nature].join(" ").toLowerCase();

  return (
    hay.includes("bank") ||
    hay.includes("cash at bank") ||
    hay.includes("current account") ||
    hay.includes("saving account")
  );
};

const lineAmountForBank = (voucher: any, bankAccountId: string) => {
  const lines = voucher.lines || voucher.entries || [];
  const bankLine =
    lines.find((l: any) => l.accountId === bankAccountId) ||
    lines.find((l: any) =>
      String(l.accountId || "")
        .toLowerCase()
        .includes("bank"),
    );

  if (!bankLine) return 0;

  const debit = Number(bankLine.debit || bankLine.dr || 0);
  const credit = Number(bankLine.credit || bankLine.cr || 0);

  return debit - credit;
};

const voucherAmount = (voucher: any) => {
  const lines = voucher.lines || voucher.entries || [];
  const dr = lines.reduce((sum: number, l: any) => sum + Number(l.debit || l.dr || 0), 0);
  const cr = lines.reduce((sum: number, l: any) => sum + Number(l.credit || l.cr || 0), 0);
  return Math.max(dr, cr, Number(voucher.amount || voucher.total || 0));
};

const dateDiffDays = (a: string, b: string) => {
  if (!a || !b) return 9999;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return 9999;
  return Math.abs(Math.round((x - y) / 86400000));
};

const normalizeStatementRow = (r: any, bankAccountId: string, batchId: string, idx: number) => {
  const date =
    normalizeDate(findCol(r, ["date", "valuedate", "transactiondate", "txndate"])) || todayISO();

  const narration = String(
    findCol(r, ["description", "particular", "narration", "remarks", "details"]) || "",
  ).trim();

  const refNo = String(
    findCol(r, ["ref", "cheque", "instrument", "utr", "voucher", "transactionid", "txn"]),
  ).trim();

  const debit = cleanAmount(findCol(r, ["debit", "withdrawal", "withdraw", "dr", "paid"])) || 0;
  const credit = cleanAmount(findCol(r, ["credit", "deposit", "cr", "receipt", "received"])) || 0;

  let amount = credit - debit;

  const amountCol = cleanAmount(findCol(r, ["amount"]));
  const typeCol = String(findCol(r, ["type", "drcr", "crdr"])).toLowerCase();

  if (!debit && !credit && amountCol) {
    amount =
      typeCol.includes("dr") || typeCol.includes("debit") || typeCol.includes("withdraw")
        ? -Math.abs(amountCol)
        : Math.abs(amountCol);
  }

  const balance = cleanAmount(findCol(r, ["balance", "closingbalance", "runningbalance"]));

  return {
    id: generateId(),
    batchId,
    rowNo: idx + 1,
    bankAccountId,
    date,
    narration,
    refNo,
    debit: amount < 0 ? Math.abs(amount) : debit,
    credit: amount > 0 ? amount : credit,
    amount,
    balance,
    status: "Imported",
    matchedVoucherId: "",
    matchedVoucherNo: "",
    matchScore: 0,
    matchReason: "",
    createdAt: nowISO(),
    raw: r,
  };
};

const matchStatementRow = (row: any, vouchers: any[], bankAccountId: string) => {
  const candidates = (vouchers || [])
    .map((v) => {
      const bankAmount = lineAmountForBank(v, bankAccountId);
      const amt = bankAmount || voucherAmount(v);
      const amountDiff = Math.abs(Math.abs(Number(amt || 0)) - Math.abs(Number(row.amount || 0)));
      const days = dateDiffDays(row.date, v.date || v.voucherDate);
      const voucherNo = String(v.voucherNo || v.number || v.refNo || "");
      const narration = String(v.narration || v.description || "").toLowerCase();
      const rowHay = `${row.narration || ""} ${row.refNo || ""}`.toLowerCase();

      let score = 0;
      const reasons: string[] = [];

      if (amountDiff <= 0.01) {
        score += 60;
        reasons.push("amount");
      } else if (amountDiff <= 5) {
        score += 35;
        reasons.push("near amount");
      }

      if (days === 0) {
        score += 25;
        reasons.push("same date");
      } else if (days <= 3) {
        score += 15;
        reasons.push("date ±3");
      } else if (days <= 7) {
        score += 8;
        reasons.push("date ±7");
      }

      if (voucherNo && rowHay.includes(voucherNo.toLowerCase())) {
        score += 20;
        reasons.push("voucher no");
      }

      if (row.refNo && narration.includes(String(row.refNo).toLowerCase())) {
        score += 10;
        reasons.push("reference");
      }

      return {
        voucher: v,
        score,
        reasons: reasons.join(", "),
        amountDiff,
        days,
      };
    })
    .filter((x) => x.score >= 60)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];

  if (!best) return row;

  return {
    ...row,
    status: best.score >= 80 ? "Matched" : "Probable",
    matchedVoucherId: best.voucher.id,
    matchedVoucherNo: best.voucher.voucherNo || best.voucher.number || "",
    matchScore: best.score,
    matchReason: best.reasons,
  };
};

const makeAuditRow = (currentUser: any, action: string, narration: string, risk = "Low") => ({
  id: generateId(),
  timestamp: nowISO(),
  date: todayISO(),
  userId: currentUser?.id || "",
  userName: currentUser?.name || currentUser?.username || "System",
  role: currentUser?.role || "",
  module: "Import bank statement",
  action,
  narration,
  status: "Success",
  risk,
  createdAt: nowISO(),
});

const Modal = ({ open, title, children, onClose, max = "max-w-4xl" }: any) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--ds-z-dropdown)] bg-black/40 flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-lg border border-gray-300 shadow-xl w-full ${max} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--ds-surface-muted)] border-b border-gray-200">
          <h3 className="text-[14px] font-semibold text-gray-700">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 text-gray-500">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export default function BankStatementImport() {
  const store = useStore();
  const currentUser = store.currentUser || store.user || {};
  const storeAccounts = store.accounts || [];
  const storeVouchers = store.vouchers || [];
  const fiscalYear = store.currentFiscalYear || store.fiscalYear || {};
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("Import & Match");
  const [loading, setLoading] = useState(false);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [statementRows, setStatementRows] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("All");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [modalType, setModalType] = useState("");

  const [voucherForm, setVoucherForm] = useState({
    statementRowId: "",
    type: "receipt",
    accountId: "",
    narration: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const bank = accounts.find(isBankAccount);
    if (!selectedBankId && bank?.id) setSelectedBankId(bank.id);
  }, [accounts, selectedBankId]);

  const loadData = async () => {
    setLoading(true);

    try {
      const db = getDB();

      const [dbAccounts, dbVouchers, dbDomainLines, dbLegacyRows, dbBatches, dbBanks] =
        await Promise.all([
          tableAll(db, "accounts"),
          tableAll(db, "vouchers"),
          tableAll(db, "bankStatementLines"),
          tableAll(db, "bankStatementRows"),
          tableAll(db, "bankStatementBatches"),
          tableAll(db, "bankAccounts"),
        ]);

      const ledgerByBank = new Map(
        (dbBanks || []).map((b: any) => [String(b.id), String(b.ledgerAccountId || "")]),
      );

      // Phase 10: domain lines win when present; legacy bankStatementRows only as fallback.
      const mappedDomain = (dbDomainLines || []).map((l: any) => {
        const ledgerId = ledgerByBank.get(String(l.bankAccountId)) || l.ledgerAccountId || "";
        return {
          id: l.id,
          batchId: l.batchId,
          bankAccountId: ledgerId || l.bankAccountId,
          treasuryBankAccountId: l.bankAccountId,
          date: l.transactionDate || l.date,
          narration: l.description || l.narration || "",
          refNo: l.reference || l.chequeNumber || "",
          debit: Number(l.debitPaisa || 0) / 100,
          credit: Number(l.creditPaisa || 0) / 100,
          balance: Number(l.balancePaisa || 0) / 100,
          status:
            l.status === "matched" || Number(l.remainingMatchPaisa) === 0
              ? "Matched"
              : l.status === "partial"
                ? "Probable"
                : "Unmatched",
          matchedVoucherNo: Array.isArray(l.matchedDocumentNos)
            ? l.matchedDocumentNos.join(", ")
            : "",
          matchReason: l.matchMethod || "",
          authority: "phase10_bankStatementLines",
          reconciliationVersion: l.reconciliationVersion,
        };
      });
      const displayRows =
        mappedDomain.length > 0
          ? mappedDomain
          : (dbLegacyRows || []).map((r: any) => ({
              ...r,
              authority: "legacy_bankStatementRows_fallback",
            }));

      setAccounts(dbAccounts?.length ? dbAccounts : storeAccounts);
      setVouchers(dbVouchers?.length ? dbVouchers : storeVouchers);
      setStatementRows(
        displayRows.sort((a: any, b: any) =>
          String(b.date || "").localeCompare(String(a.date || "")),
        ),
      );
      setBatches(
        (dbBatches || []).sort((a, b) =>
          String(b.importedAt || "").localeCompare(String(a.importedAt || "")),
        ),
      );
    } catch (err) {
      console.error(err);
      toast.error("Could not load bank statement data");
    } finally {
      setLoading(false);
    }
  };

  const bankAccounts = useMemo(() => accounts.filter(isBankAccount), [accounts]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return statementRows.filter((r) => {
      if (!matchBranch(r.branchId)) return false;
      if (selectedBankId && r.bankAccountId !== selectedBankId) return false;
      if (selectedBatchId !== "All" && r.batchId !== selectedBatchId) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;

      if (!q) return true;

      return [r.date, r.narration, r.refNo, r.status, r.matchedVoucherNo, r.matchReason]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [statementRows, selectedBankId, selectedBatchId, statusFilter, query, matchBranch, branchFilter]);

  const scopedBatches = useMemo(
    () => batches.filter((b) => matchBranch(b.branchId)),
    [batches, matchBranch, branchFilter],
  );

  const stats = useMemo(() => {
    const rows = filteredRows;
    const receipts = rows.reduce((sum, r) => sum + Number(r.credit || 0), 0);
    const payments = rows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
    const matched = rows.filter((r) => r.status === "Matched").length;
    const probable = rows.filter((r) => r.status === "Probable").length;
    const unmatched = rows.filter(
      (r) => !["Matched", "Probable", "Reconciled"].includes(r.status),
    ).length;
    const reconciled = rows.filter((r) => r.status === "Reconciled").length;

    return {
      count: rows.length,
      receipts,
      payments,
      net: receipts - payments,
      matched,
      probable,
      unmatched,
      reconciled,
    };
  }, [filteredRows]);

  const parseExcelFile = async (file: File) => {
    if (!selectedBankId) {
      toast.error("Select bank account first");
      return;
    }

    setLoading(true);

    try {
      const buf = await readFileArrayBuffer(file);
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rawRows.length) {
        toast.error("No rows found in file");
        return;
      }

      const batchId = generateId();

      const rows = rawRows
        .map((r, idx) => normalizeStatementRow(r, selectedBankId, batchId, idx))
        .filter((r) => r.date && (r.debit || r.credit || r.amount));

      const matched = rows.map((r) => matchStatementRow(r, vouchers, selectedBankId));

      setPreviewRows(matched);
      setModalType("preview");

      toast.success(`${matched.length} rows loaded for preview`);
    } catch (err) {
      console.error(err);
      toast.error("Could not parse Excel/CSV file");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const commitImport = async () => {
    if (!previewRows.length) {
      toast.error("No preview rows to import");
      return;
    }

    try {
      const result = await importStatementViaTreasury({
        ledgerOrBankAccountId: selectedBankId,
        previewRows,
        bankAccountName: accountName(accounts, selectedBankId),
        source: "manual_form",
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Could not commit import");
        return;
      }
      const batchId = result.payload.batch_id;
      const db = getDB();
      const domainLines = (await tableAll(db, "bankStatementLines")).filter(
        (r) => r.batchId === batchId,
      );
      const uiRows = domainLines.map((line) => ({
        id: line.id,
        batchId: line.batchId,
        bankAccountId: selectedBankId,
        date: line.transactionDate,
        description: line.description,
        narration: line.description,
        reference: line.reference || "",
        debit: (line.debitPaisa || 0) / 100,
        credit: (line.creditPaisa || 0) / 100,
        balance: line.balancePaisa != null ? line.balancePaisa / 100 : 0,
        status: "Unmatched",
        reconciliationVersion: line.reconciliationVersion,
        branchId: readActiveBranchId() || undefined,
      }));
      const batch = {
        id: batchId,
        bankAccountId: selectedBankId,
        bankAccountName: accountName(accounts, selectedBankId),
        importedAt: nowISO(),
        importedBy: currentUser?.id || "",
        rowCount: result.payload.line_count,
        matchedCount: 0,
        probableCount: 0,
        totalDebit: uiRows.reduce((sum, r) => sum + Number(r.debit || 0), 0),
        totalCredit: uiRows.reduce((sum, r) => sum + Number(r.credit || 0), 0),
        branchId: readActiveBranchId() || undefined,
      };
      setStatementRows((prev) => [...uiRows, ...prev]);
      setBatches((prev) => [batch, ...prev]);
      setPreviewRows([]);
      setModalType("");
      setSelectedBatchId(batchId);
      toast.success("Bank statement imported");
    } catch (err) {
      console.error(err);
      toast.error("Could not commit import");
    }
  };

  const autoMatchExisting = async () => {
    if (!selectedBankId) {
      toast.error("Select bank account");
      return;
    }

    const candidates = filteredRows.filter((r) => !["Matched", "Reconciled"].includes(r.status));

    if (!candidates.length) {
      toast.error("No unmatched rows to auto-match");
      return;
    }

    try {
      const db = getDB();

      const matchedRows = candidates.map((r) => matchStatementRow(r, vouchers, selectedBankId));
      await tablePut(db, "bankStatementRows", matchedRows);

      setStatementRows((prev) => prev.map((r) => matchedRows.find((m) => m.id === r.id) || r));

      toast.success("Auto-match completed");
    } catch (err) {
      console.error(err);
      toast.error("Could not auto-match rows");
    }
  };

  const markReconciled = async (row: any) => {
    if (!row.matchedVoucherId) {
      toast.error("Row must be matched to a voucher first");
      return;
    }

    try {
      const db = getDB();

      const updated = {
        ...row,
        status: "Reconciled",
        reconciledAt: nowISO(),
        reconciledBy: currentUser?.id || "",
      };

      const voucher = vouchers.find((v) => v.id === row.matchedVoucherId) || {};

      const updatedVoucher = {
        ...voucher,
        reconciled: true,
        reconciledAt: nowISO(),
        bankStatementRowId: row.id,
      };

      await tablePut(db, "bankStatementRows", [updated]);
      if (voucher.id) await tablePut(db, "vouchers", [updatedVoucher]);

      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Bank Row Reconciled",
          `${row.date} ${row.refNo || ""} ${money(Math.abs(row.amount || 0))}`,
          "Medium",
        ),
      ]);

      setStatementRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setVouchers((prev) => prev.map((v) => (v.id === updatedVoucher.id ? updatedVoucher : v)));

      toast.success("Statement row reconciled");
    } catch (err) {
      console.error(err);
      toast.error("Could not reconcile row");
    }
  };

  const unlinkMatch = async (row: any) => {
    try {
      const db = getDB();

      const updated = {
        ...row,
        status: "Imported",
        matchedVoucherId: "",
        matchedVoucherNo: "",
        matchScore: 0,
        matchReason: "",
        reconciledAt: "",
      };

      await tablePut(db, "bankStatementRows", [updated]);
      setStatementRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));

      toast.success("Match removed");
    } catch (err) {
      console.error(err);
      toast.error("Could not unlink match");
    }
  };

  const openCreateVoucher = (row: any) => {
    setSelectedRow(row);
    setVoucherForm({
      statementRowId: row.id,
      type: Number(row.amount || 0) >= 0 ? "receipt" : "payment",
      accountId: "",
      narration: row.narration || row.refNo || "",
    });
    setModalType("voucher");
  };

  const createVoucherForRow = async () => {
    if (!selectedRow) return;

    if (!voucherForm.accountId) {
      toast.error("Select opposite account");
      return;
    }

    const isReceipt = Number(selectedRow.amount || selectedRow.credit || 0) >= Number(selectedRow.debit || 0);
    const amt = Math.abs(
      Number(selectedRow.amount || 0) ||
        Number(selectedRow.debit || 0) ||
        Number(selectedRow.credit || 0),
    );

    if (!amt) {
      toast.error("Invalid amount");
      return;
    }

    try {
      const version = Number(selectedRow.reconciliationVersion ?? 1);
      const result = await postAdjustmentViaTreasury({
        ledgerOrBankAccountId: selectedBankId,
        statementLineId: selectedRow.id,
        expectedStatementLineVersion: version,
        adjustmentType: isReceipt ? "bank_interest" : "bank_charge",
        amount: amt,
        offsetAccountId: voucherForm.accountId,
        useJournal: true,
        narration: voucherForm.narration || selectedRow.narration || selectedRow.description,
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Could not create voucher");
        return;
      }

      const updatedRow = {
        ...selectedRow,
        status: "Reconciled",
        matchedVoucherId: result.payload.voucher_id,
        matchedVoucherNo: result.payload.voucher_number,
        matchScore: 100,
        matchReason: "phase9_adjustment",
        reconciledAt: nowISO(),
        reconciledBy: currentUser?.id || "",
      };

      setStatementRows((prev) => prev.map((r) => (r.id === updatedRow.id ? updatedRow : r)));
      setModalType("");
      setSelectedRow(null);
      toast.success("Adjustment posted via Phase 9 and reconciled");
    } catch (err) {
      console.error(err);
      toast.error("Could not create voucher");
    }
  };

  const deleteBatch = async (batch: any) => {
    if (!confirm(`Delete imported batch ${batch.bankAccountName}?`)) return;

    try {
      const db = getDB();

      const ids = statementRows.filter((r) => r.batchId === batch.id).map((r) => r.id);

      for (const id of ids) await tableDelete(db, "bankStatementRows", id);
      await tableDelete(db, "bankStatementBatches", batch.id);

      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Bank Statement Batch Deleted",
          `${batch.bankAccountName} ${batch.rowCount} rows`,
          "High",
        ),
      ]);

      setStatementRows((prev) => prev.filter((r) => r.batchId !== batch.id));
      setBatches((prev) => prev.filter((b) => b.id !== batch.id));

      toast.success("Batch deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete batch");
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        filteredRows.map((r) => ({
          Date: r.date,
          BankAccount: accountName(accounts, r.bankAccountId),
          Narration: r.narration,
          RefNo: r.refNo,
          Debit: r.debit,
          Credit: r.credit,
          Amount: r.amount,
          Balance: r.balance,
          Status: r.status,
          MatchedVoucherNo: r.matchedVoucherNo,
          MatchScore: r.matchScore,
          MatchReason: r.matchReason,
        })),
      ),
      "Statement Rows",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        batches.map((b) => ({
          ImportedAt: b.importedAt,
          BankAccount: b.bankAccountName,
          RowCount: b.rowCount,
          MatchedCount: b.matchedCount,
          ProbableCount: b.probableCount,
          TotalDebit: b.totalDebit,
          TotalCredit: b.totalCredit,
        })),
      ),
      "Batches",
    );

    XLSX.writeFile(wb, `Bank_Statement_Reconciliation_${todayISO()}.xlsx`);
    toast.success("Bank reconciliation exported");
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          Date: todayISO(),
          Description: "Sample deposit / payment narration",
          RefNo: "CHQ/UTR001",
          Debit: 0,
          Credit: 0,
          Balance: 0,
        },
      ]),
      "Bank Statement",
    );

    XLSX.writeFile(wb, `Bank_Statement_Template_${todayISO()}.xlsx`);
    toast.success("Template downloaded");
  };

  const statusClass = (status: string) => {
    if (status === "Reconciled") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "Matched") return "bg-blue-100 text-blue-700 border-blue-200";
    if (status === "Probable") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "Imported") return "bg-gray-100 text-gray-700 border-gray-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const renderSummary = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Rows</p>
        <p className="text-[15px] font-bold text-gray-700">{stats.count}</p>
      </div>

      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Receipts</p>
        <p className="text-[15px] font-bold text-emerald-600">{money(stats.receipts)}</p>
      </div>

      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Payments</p>
        <p className="text-[15px] font-bold text-red-600">{money(stats.payments)}</p>
      </div>

      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Net</p>
        <p
          className={`text-[15px] font-bold ${stats.net >= 0 ? "text-emerald-600" : "text-red-600"}`}
        >
          {money(stats.net)}
        </p>
      </div>

      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Matched</p>
        <p className="text-[15px] font-bold text-[var(--ds-action-primary)]">{stats.matched}</p>
      </div>

      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Probable</p>
        <p className="text-[15px] font-bold text-amber-600">{stats.probable}</p>
      </div>

      <div className={card}>
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
          Reconciled
        </p>
        <p className="text-[15px] font-bold text-emerald-600">{stats.reconciled}</p>
      </div>
    </div>
  );

  const renderFilters = () => (
    <div className={card}>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Bank Account
          </label>
          <select
            className={input}
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
          >
            <option value="">Select bank</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Batch
          </label>
          <select
            className={input}
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          >
            <option value="All">All Batches</option>
            {batches
              .filter(
                (b) =>
                  matchBranch(b.branchId) &&
                  (!selectedBankId || b.bankAccountId === selectedBankId),
              )
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {String(b.importedAt).slice(0, 10)} ({b.rowCount})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Status
          </label>
          <select
            className={input}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {["All", "Imported", "Probable", "Matched", "Reconciled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2 text-gray-400" />
            <input
              className={`${input} pl-8`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Narration, ref no, voucher..."
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            className={btn2}
            onClick={() => {
              setQuery("");
              setStatusFilter("All");
              setSelectedBatchId("All");
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  const renderImportAndMatch = () => (
    <div className="space-y-4">
      {renderSummary()}
      {renderFilters()}

      <div className={card}>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <Upload className="h-4 w-4 text-[var(--ds-action-primary)]" />
              Import bank statement
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Upload Excel/CSV statement, preview rows, auto-match to vouchers and reconcile.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && parseExcelFile(e.target.files[0])}
            />

            <button className={btn2} onClick={downloadTemplate}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Template
            </button>

            <button className={btn} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload Statement
            </button>

            <button className={btn2} onClick={autoMatchExisting}>
              <Wand2 className="h-3.5 w-3.5" />
              Auto Match
            </button>

            <button className={btn2} onClick={exportExcel}>
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-auto max-h-[62vh]">
          <table className="w-full min-w-[1250px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Narration</th>
                <th className={th}>Ref No</th>
                <th className={`${th} text-right`}>Debit</th>
                <th className={`${th} text-right`}>Credit</th>
                <th className={`${th} text-right`}>Balance</th>
                <th className={th}>Match</th>
                <th className={th}>Status</th>
                <th className={`${th} text-center`}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className={`${td} font-medium`}>{r.date}</td>

                  <td className={td}>
                    <div className="max-w-[360px]">{r.narration || "-"}</div>
                  </td>

                  <td className={td}>{r.refNo || "-"}</td>
                  <td className={`${td} text-right font-medium text-red-600`}>
                    {r.debit ? money(r.debit) : "-"}
                  </td>
                  <td className={`${td} text-right font-medium text-emerald-600`}>
                    {r.credit ? money(r.credit) : "-"}
                  </td>
                  <td className={`${td} text-right`}>{r.balance ? money(r.balance) : "-"}</td>

                  <td className={td}>
                    {r.matchedVoucherId ? (
                      <div>
                        <div className="font-semibold text-gray-700">
                          {r.matchedVoucherNo || r.matchedVoucherId}
                        </div>
                        <div className="text-[12px] text-gray-500">
                          Score {r.matchScore || 0} • {r.matchReason || "-"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-gray-400">No match</span>
                    )}
                  </td>

                  <td className={td}>
                    <span
                      className={`px-2 py-0.5 rounded text-[12px] font-bold uppercase ${statusClass(
                        r.status,
                      )}`}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td className={`${td} text-center`}>
                    <div className="inline-flex flex-wrap justify-center gap-1">
                      {r.status !== "Reconciled" && r.matchedVoucherId && (
                        <button
                          className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600"
                          onClick={() => markReconciled(r)}
                          title="Mark reconciled"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}

                      {r.matchedVoucherId && r.status !== "Reconciled" && (
                        <button
                          className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600"
                          onClick={() => unlinkMatch(r)}
                          title="Unlink match"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}

                      {!r.matchedVoucherId && (
                        <button
                          className="p-1.5 rounded-md hover:bg-gray-100 text-[var(--ds-action-primary)]"
                          onClick={() => openCreateVoucher(r)}
                          title="Create voucher"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                        onClick={() => {
                          setSelectedRow(r);
                          setModalType("row");
                        }}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredRows.length && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[12px] font-medium text-gray-500">
                    No bank statement rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBatches = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-[var(--ds-action-primary)]" />
              Import Batches
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Review imported statement batches and delete if wrongly imported.
            </p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full min-w-[950px]">
          <thead>
            <tr>
              <th className={th}>Imported At</th>
              <th className={th}>Bank Account</th>
              <th className={`${th} text-right`}>Rows</th>
              <th className={`${th} text-right`}>Matched</th>
              <th className={`${th} text-right`}>Probable</th>
              <th className={`${th} text-right`}>Debit</th>
              <th className={`${th} text-right`}>Credit</th>
              <th className={`${th} text-center`}>Action</th>
            </tr>
          </thead>

          <tbody>
            {scopedBatches.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className={td}>
                  <div className="font-medium">{String(b.importedAt).slice(0, 10)}</div>
                  <div className="text-[12px] text-gray-400">
                    {String(b.importedAt).slice(11, 19)}
                  </div>
                </td>
                <td className={`${td} font-semibold`}>{b.bankAccountName}</td>
                <td className={`${td} text-right font-medium`}>{b.rowCount}</td>
                <td className={`${td} text-right font-medium text-emerald-600`}>
                  {b.matchedCount}
                </td>
                <td className={`${td} text-right font-medium text-amber-600`}>{b.probableCount}</td>
                <td className={`${td} text-right text-red-600 font-medium`}>
                  {money(b.totalDebit)}
                </td>
                <td className={`${td} text-right text-emerald-600 font-medium`}>
                  {money(b.totalCredit)}
                </td>
                <td className={`${td} text-center`}>
                  <button className={btnDanger} onClick={() => deleteBatch(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {!batches.length && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[12px] font-medium text-gray-500">
                  No import batches found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPreviewModal = () => (
    <Modal
      open={modalType === "preview"}
      title="Import Preview"
      onClose={() => setModalType("")}
      max="max-w-6xl"
    >
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-auto max-h-[58vh]">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Narration</th>
                  <th className={th}>Ref No</th>
                  <th className={`${th} text-right`}>Debit</th>
                  <th className={`${th} text-right`}>Credit</th>
                  <th className={`${th} text-right`}>Balance</th>
                  <th className={th}>Match</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={`${td} font-medium`}>{r.date}</td>
                    <td className={td}>{r.narration || "-"}</td>
                    <td className={td}>{r.refNo || "-"}</td>
                    <td className={`${td} text-right text-red-600 font-medium`}>
                      {r.debit ? money(r.debit) : "-"}
                    </td>
                    <td className={`${td} text-right text-emerald-600 font-medium`}>
                      {r.credit ? money(r.credit) : "-"}
                    </td>
                    <td className={`${td} text-right`}>{r.balance ? money(r.balance) : "-"}</td>
                    <td className={td}>
                      {r.matchedVoucherId ? (
                        <div>
                          <div className="font-semibold text-gray-700">{r.matchedVoucherNo}</div>
                          <div className="text-[12px] text-gray-500">
                            Score {r.matchScore} • {r.matchReason}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={td}>
                      <span
                        className={`px-2 py-0.5 rounded text-[12px] font-bold uppercase ${statusClass(
                          r.status,
                        )}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <div className="text-[12px] font-medium text-gray-700 mt-1">
            Rows: <span className="font-bold">{previewRows.length}</span>
            {" • "}
            Matched:{" "}
            <span className="font-bold text-emerald-600">
              {previewRows.filter((r) => r.status === "Matched").length}
            </span>
            {" • "}
            Probable:{" "}
            <span className="font-bold text-amber-600">
              {previewRows.filter((r) => r.status === "Probable").length}
            </span>
          </div>

          <div className="flex gap-2">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>
            <button className={btn} onClick={commitImport}>
              <Upload className="h-4 w-4" />
              Commit Import
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );

  const renderRowModal = () => (
    <Modal
      open={modalType === "row"}
      title="Bank Statement Row Details"
      onClose={() => setModalType("")}
    >
      {selectedRow && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Date
              </p>
              <p className="font-semibold text-gray-700">{selectedRow.date}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Debit
              </p>
              <p className="font-semibold text-red-600">{money(selectedRow.debit)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Credit
              </p>
              <p className="font-semibold text-emerald-600">{money(selectedRow.credit)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </p>
              <span
                className={`inline-flex mt-1 px-2 py-0.5 rounded text-[12px] font-bold uppercase ${statusClass(
                  selectedRow.status,
                )}`}
              >
                {selectedRow.status}
              </span>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Narration
            </p>
            <p className="font-medium text-[12px] text-gray-700">{selectedRow.narration || "-"}</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Match</p>
            <p className="font-semibold text-gray-700">
              {selectedRow.matchedVoucherNo || selectedRow.matchedVoucherId || "No match"}
            </p>
            <p className="text-[12px] font-medium text-gray-500">
              Score {selectedRow.matchScore || 0} • {selectedRow.matchReason || "-"}
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Raw Imported Data
            </p>
            <pre className="text-[12px] bg-white border border-gray-200 p-3 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(selectedRow.raw || selectedRow, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );

  const renderVoucherModal = () => (
    <Modal
      open={modalType === "voucher"}
      title="Create Voucher From Bank Row"
      onClose={() => setModalType("")}
    >
      {selectedRow && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800">
            <p className="font-semibold">
              {Number(selectedRow.amount || 0) >= 0 ? "Receipt" : "Payment"} •{" "}
              {money(Math.abs(Number(selectedRow.amount || 0)))}
            </p>
            <p className="text-[12px] font-medium mt-1">
              {selectedRow.date} • {selectedRow.narration || selectedRow.refNo || "-"}
            </p>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Voucher Type
            </label>
            <select
              className={input}
              value={voucherForm.type}
              onChange={(e) => setVoucherForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="receipt">Receipt</option>
              <option value="payment">Payment</option>
              <option value="contra">Contra</option>
              <option value="journal">Journal</option>
            </select>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Bank Account
            </label>
            <input
              className={`${input} bg-gray-100`}
              value={accountName(accounts, selectedBankId)}
              disabled
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Opposite Account {Number(selectedRow.amount || 0) >= 0 ? "(Credit)" : "(Debit)"}
            </label>
            <select
              className={input}
              value={voucherForm.accountId}
              onChange={(e) => setVoucherForm((f) => ({ ...f, accountId: e.target.value }))}
            >
              <option value="">Select account</option>
              {accounts
                .filter((a) => a.id !== selectedBankId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.group || a.groupName ? `(${a.group || a.groupName})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Narration
            </label>
            <textarea
              className={`${input} h-auto py-2`}
              rows={3}
              value={voucherForm.narration}
              onChange={(e) => setVoucherForm((f) => ({ ...f, narration: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-2">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>

            <button className={btn} onClick={createVoucherForRow}>
              <Save className="h-4 w-4" />
              Create & Reconcile
            </button>
          </div>
        </div>
      )}
    </Modal>
  );

  return (
    <div className="p-4 md:p-6 bg-[var(--ds-surface-muted)] min-h-screen text-gray-700">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[var(--ds-action-primary)]" />
            Import bank statement
          </h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Load a bank file.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          <button className={btn2} onClick={loadData} disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button className={btn2} onClick={exportExcel}>
            <Download className="h-3.5 w-3.5" />
            Export
          </button>

          <button className={btn} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ["Import & Match", Upload],
          ["Batches", FileSpreadsheet],
        ].map(([name, Icon]: any) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors border ${
              activeTab === name
                ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {name}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`${card} mb-4`}>
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--ds-action-primary)]">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Processing bank statement operation...
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => e.target.files?.[0] && parseExcelFile(e.target.files[0])}
      />

      {activeTab === "Import & Match" && renderImportAndMatch()}
      {activeTab === "Batches" && renderBatches()}

      {renderPreviewModal()}
      {renderRowModal()}
      {renderVoucherModal()}
    </div>
  );
}
