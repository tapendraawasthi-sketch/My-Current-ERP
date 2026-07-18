// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "../lib/db";
import { useStore } from "../store/useStore";
import { Calculator, FileSpreadsheet, RefreshCw, Download, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { mergeSystemConfiguration, getInterestRateForDays } from "../lib/systemConfiguration";
import { computeInvoiceOutstanding } from "../lib/accounting";
import { useBranchFilter } from "../hooks/useBranchFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterestRow {
  partyId: string;
  partyName: string;
  partyPan?: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string;
  originalAmount: number;
  outstandingAmount: number;
  daysOverdue: number;
  interestRate: number;
  interestAmount: number;
  totalWithInterest: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function daysDiff(dateStr: string, asOf: string): number {
  if (!dateStr) return 0;
  const d1 = new Date(dateStr);
  const d2 = new Date(asOf);
  const diff = d2.getTime() - d1.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// Local serial number generator — replaces the missing store.generateSerialNumber
function generateLocalSerial(prefix: string, count: number): string {
  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

// ─── Main Component ────────────────────────────────────────────────────────────

const InterestCalculation: React.FC = () => {
  const { parties, companySettings } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const interestSlabs = mergeSystemConfiguration(
    companySettings?.systemConfiguration,
  ).interestSlabs;

  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [interestRate, setInterestRate] = useState(18); // fallback % per annum when no slab matches
  const [minDaysOverdue, setMinDaysOverdue] = useState(30);
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingVoucher, setGeneratingVoucher] = useState(false);

  // Fix: use getDB() default import — not named { db }
  const db = getDB();

  const invoiceType = direction === "receivable" ? "sales-invoice" : "purchase-invoice";
  const paymentType = direction === "receivable" ? "receipt" : "payment";

  // Fix: useLiveQuery from "dexie-react-hooks" — correct package import
  const invoices = useLiveQuery(
    () => getDB().invoices.where("type").equals(invoiceType).toArray(),
    [invoiceType],
  );

  const payments = useLiveQuery(
    () => getDB().vouchers.where("type").equals(paymentType).toArray(),
    [paymentType],
  );

  // ── Compute interest rows ─────────────────────────────────────────────────
  const interestRows = useMemo<InterestRow[]>(() => {
    if (!invoices || !payments) return [];

    const scopedInvoices = (invoices as any[]).filter((inv) => matchBranch(inv?.branchId));
    const scopedPayments = (payments as any[]).filter((p) => matchBranch(p?.branchId));

    const rows: InterestRow[] = [];

    for (const inv of scopedInvoices) {
      if (!inv || inv.status === "cancelled" || inv.status === "draft") continue;

      const originalAmount = Number(inv.grandTotal ?? inv.total ?? 0);
      if (originalAmount <= 0) continue;

      const outstanding = computeInvoiceOutstanding(inv, scopedPayments);
      if (outstanding <= 0.005) continue;

      // Days overdue from due date
      const refDate = inv.dueDate ?? inv.date;
      const daysOverdue = refDate ? daysDiff(refDate, asOfDate) : 0;

      if (daysOverdue < minDaysOverdue) continue;

      const rowRate = getInterestRateForDays(daysOverdue, interestSlabs) || interestRate;
      const dailyRate = rowRate / 100 / 365;
      const interestAmount = parseFloat((outstanding * dailyRate * daysOverdue).toFixed(2));

      const partyId = inv.partyId ?? "unknown";
      const partyName =
        inv.partyName ?? parties.find((p: any) => p.id === partyId)?.name ?? "Unknown";
      const partyPan = inv.partyPan ?? parties.find((p: any) => p.id === partyId)?.pan;

      rows.push({
        partyId,
        partyName,
        partyPan,
        invoiceNo: inv.invoiceNo ?? inv.id,
        invoiceDate: inv.date ?? "",
        dueDate: inv.dueDate ?? "",
        originalAmount,
        outstandingAmount: parseFloat(outstanding.toFixed(2)),
        daysOverdue,
        interestRate: rowRate,
        interestAmount,
        totalWithInterest: parseFloat((outstanding + interestAmount).toFixed(2)),
      });
    }

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [
    invoices,
    payments,
    asOfDate,
    interestRate,
    minDaysOverdue,
    parties,
    interestSlabs,
    matchBranch,
    branchFilter,
  ]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo<InterestRow[]>(() => {
    if (!searchTerm.trim()) return interestRows;
    const q = searchTerm.toLowerCase();
    return interestRows.filter(
      (r) =>
        r.partyName.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q) ||
        (r.partyPan ?? "").toLowerCase().includes(q),
    );
  }, [interestRows, searchTerm]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return {
      outstanding: filteredRows.reduce((s, r) => s + r.outstandingAmount, 0),
      interest: filteredRows.reduce((s, r) => s + r.interestAmount, 0),
      total: filteredRows.reduce((s, r) => s + r.totalWithInterest, 0),
    };
  }, [filteredRows]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const companyName = companySettings?.name ?? "Company";
      const headers = [
        "Party",
        "PAN",
        "Invoice No.",
        "Invoice Date",
        "Due Date",
        "Original Amt",
        "Outstanding",
        "Days Overdue",
        "Rate (%)",
        "Interest",
        "Total with Interest",
      ];
      const rows = filteredRows.map((r) => [
        r.partyName,
        r.partyPan ?? "",
        r.invoiceNo,
        r.invoiceDate,
        r.dueDate,
        r.originalAmount,
        r.outstandingAmount,
        r.daysOverdue,
        r.interestRate,
        r.interestAmount,
        r.totalWithInterest,
      ]);

      const wb = XLSX.utils.book_new();
      const wsData = [
        [companyName],
        ["Interest Report"],
        [`As of: ${asOfDate} | Rate: ${interestRate}% p.a. | Min Overdue: ${minDaysOverdue} days`],
        [],
        headers,
        ...rows,
        [],
        ["TOTAL", "", "", "", "", "", totals.outstanding, "", "", totals.interest, totals.total],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Interest");
      XLSX.writeFile(wb, `InterestCalc_${asOfDate}.xlsx`);
      toast.success("Interest calculation exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  // ── Generate interest vouchers ────────────────────────────────────────────
  const handleGenerateVouchers = async () => {
    if (filteredRows.length === 0) {
      toast.error("No interest rows to generate vouchers for.");
      return;
    }

    setGeneratingVoucher(true);
    try {
      // Fix: use local serial number generator instead of
      // store.generateSerialNumber which does not exist on AppState
      const existingCount = await getDB().vouchers.count();
      const voucherNo = `JV-${String(existingCount + 1).padStart(4, "0")}`;
      const now = new Date().toISOString();

      // We need to know the 'Interest Income' ledger ID, assume we can find it
      // For simplicity, let's just pick one or assume user configures it.
      // In a real scenario, this would be a specific ledger.
      const allAccounts = await getDB().accounts.toArray();
      const interestAccount = allAccounts.find(
        (a: any) => (a.name ?? "").toLowerCase().includes("interest") && a.type === "income",
      );

      const voucher: any = {
        id: crypto.randomUUID(),
        voucherNo,
        date: asOfDate,
        type: "journal",
        status: "posted",
        narration: `Interest charged @ ${interestRate}% p.a. as of ${asOfDate}`,
        totalDebit: totalInterest,
        totalCredit: totalInterest,
        grandTotal: totalInterest,
        lines: filteredRows.flatMap((r) => [
          {
            accountId: r.partyId,
            accountName: r.partyName,
            debit: r.interestAmount,
            credit: 0,
            narration: `Interest on ${r.invoiceNo} (${r.daysOverdue} days)`,
          },
          {
            accountId: interestAccount?.id ?? "",
            accountName: interestAccount?.name ?? "Interest Income",
            debit: 0,
            credit: r.interestAmount,
            narration: `Interest income from ${r.partyName}`,
          },
        ]),
        createdAt: ts,
        updatedAt: ts,
      };

      await getDB().vouchers.add(voucher);
      toast.success(`Interest voucher ${voucherNo} created for Rs. ${money(totalInterest)}.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate vouchers.");
    } finally {
      setGeneratingVoucher(false);
    }
  };

  const isLoading = !invoices || !payments;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="erp-report p-4 md:p-6 bg-[var(--ds-canvas)] min-h-screen">
      {/* Header */}
      <div className="erp-report-toolbar flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Interest</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Interest on outstanding.</p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Calculate overdue interest on outstanding{" "}
            {direction === "receivable" ? "receivables" : "payables"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={handleGenerateVouchers}
            disabled={filteredRows.length === 0 || generatingVoucher}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {generatingVoucher ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" />
            )}
            Post Vouchers
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Interest Parameters
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {branchOptions.length > 0 && (
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1 block">Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[12px] font-medium text-gray-600 mb-1 block">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "receivable" | "payable")}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            >
              <option value="receivable">Receivables (Sales)</option>
              <option value="payable">Payables (Purchase)</option>
            </select>
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-600 mb-1 block">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-600 mb-1 block">
              Annual Interest Rate (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-right"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-600 mb-1 block">
              Min. Days Overdue
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={minDaysOverdue}
              onChange={(e) => setMinDaysOverdue(parseInt(e.target.value) || 0)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-right"
            />
          </div>
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party, invoice…"
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full max-w-xs"
          />
        </div>
      </div>

      {/* Summary */}
      {!isLoading && filteredRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Outstanding Amount
            </p>
            <p className="text-[18px] font-bold text-[var(--ds-action-primary)] mt-0.5 font-mono">
              {money(totals.outstanding)}
            </p>
          </div>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Interest @ {interestRate}% p.a.
            </p>
            <p className="text-[18px] font-bold text-red-600 mt-0.5 font-mono">
              {money(totals.interest)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Total with Interest
            </p>
            <p className="text-[18px] font-bold text-gray-800 mt-0.5 font-mono">
              {money(totals.total)}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-[12px]">Calculating interest…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                    Party
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Invoice No.
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                    Due Date
                  </th>
                  <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Outstanding
                  </th>
                  <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                    Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Interest
                  </th>
                  <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-[12px] text-gray-400">
                      No overdue invoices found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row: InterestRow, idx: number) => (
                    <tr key={`${row.invoiceNo}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <div className="text-[12px] font-semibold text-gray-800">
                          {row.partyName}
                        </div>
                        {row.partyPan && (
                          <div className="text-[12px] text-gray-500 font-mono">
                            PAN: {row.partyPan}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-[var(--ds-action-primary)]">
                        {row.invoiceNo}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {row.dueDate || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                        {money(row.outstandingAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[12px]">
                        <span
                          className={`font-semibold ${
                            row.daysOverdue > 90
                              ? "text-red-700"
                              : row.daysOverdue > 60
                                ? "text-red-500"
                                : row.daysOverdue > 30
                                  ? "text-orange-600"
                                  : "text-amber-600"
                          }`}
                        >
                          {row.daysOverdue}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-red-600">
                        {money(row.interestAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                        {money(row.totalWithInterest)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[var(--ds-surface-selected)] border-t-2 border-[var(--ds-border-strong)]">
                    <td colSpan={3} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Total ({filteredRows.length} invoices)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[var(--ds-action-primary)]">
                      {money(totals.outstanding)}
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-red-600">
                      {money(totals.interest)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                      {money(totals.total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterestCalculation;
