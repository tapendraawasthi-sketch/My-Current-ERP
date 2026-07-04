// @ts-nocheck
import React, { useState, useMemo, useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  FileSpreadsheet,
  Printer,
  Eye,
  X,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Search,
} from "lucide-react";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";
import { ReportEmptyState } from "../components/ReportEmptyState";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayBookEntry {
  id: string;
  date: string;
  dateNepali?: string;
  voucherNo: string;
  type: string;
  narration: string;
  partyName?: string;
  debit: number;
  credit: number;
  accountName?: string;
  accountId?: string;
  lines?: DayBookLine[];
  status?: string;
  createdByName?: string;
}

interface DayBookLine {
  accountId?: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
}

interface DaySummary {
  totalDebit: number;
  totalCredit: number;
  totalVouchers: number;
  byType: Record<string, number>;
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

function formatVoucherType(type: string): string {
  if (!type) return "—";
  return type
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function getTypeColor(type: string): { bg: string; text: string; border: string } {
  const t = (type ?? "").toLowerCase();
  if (t.includes("sales") || t.includes("receipt"))
    return {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    };
  if (t.includes("purchase") || t.includes("payment"))
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    };
  if (t.includes("journal"))
    return {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    };
  if (t.includes("contra"))
    return {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    };
  return {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

const DayBook: React.FC = () => {
  const { vouchers, invoices, accounts, companySettings, currentFiscalYear } = useStore();

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: todayISO(),
    toDate: todayISO(),
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DayBookEntry | null>(null);
  const [viewMode, setViewMode] = useState<"condensed" | "detailed">("condensed");

  const [jumpQuery, setJumpQuery] = useState("");
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleJump = (e: React.KeyboardEvent<HTMLInputElement> | { key: string }) => {
    if (e.key !== "Enter") return;
    const query = jumpQuery.trim().toLowerCase();
    if (!query) return;

    const rows = tableRef.current?.querySelectorAll("[data-voucher-no]") || [];
    let found: Element | null = null;
    rows.forEach((row) => {
      if ((row.getAttribute("data-voucher-no") || "").toLowerCase().includes(query)) {
        found = row;
      }
    });

    if (found) {
      (found as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      (found as HTMLElement).style.background = "#fef3c7";
      (found as HTMLElement).style.transition = "background 1.5s ease";
      setTimeout(() => {
        if (found) (found as HTMLElement).style.background = "";
      }, 1500);
      setJumpQuery("");
    }
  };

  // ── Build day book entries from vouchers ────────────────────────────────
  const dayBookEntries = useMemo<DayBookEntry[]>(() => {
    const entries: DayBookEntry[] = [];

    // From vouchers
    const dayVouchers = vouchers.filter(
      (v: any) =>
        v.date >= dateRange.fromDate && v.date <= dateRange.toDate && v.status === "posted",
    );

    for (const v of dayVouchers) {
      const totalDebit = (v.lines ?? []).reduce(
        (s: number, l: any) => s + (Number(l.debit) || 0),
        0,
      );
      const totalCredit = (v.lines ?? []).reduce(
        (s: number, l: any) => s + (Number(l.credit) || 0),
        0,
      );

      entries.push({
        id: v.id as string,
        date: v.date as string,
        dateNepali: v.dateNepali as string | undefined,
        voucherNo: v.voucherNo as string,
        type: v.type as string,
        narration: (v.narration as string) || "",
        partyName: v.partyName as string | undefined,
        debit: totalDebit,
        credit: totalCredit,
        lines: (v.lines ?? []).map((l: any) => ({
          accountId: l.accountId as string | undefined,
          accountName: l.accountName as string | undefined,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration as string | undefined,
        })) as DayBookLine[],
        status: v.status as string | undefined,
        createdByName: v.createdByName as string | undefined,
      });
    }

    // From invoices
    const dayInvoices = invoices.filter(
      (inv: any) =>
        inv.date >= dateRange.fromDate && inv.date <= dateRange.toDate && inv.status === "posted",
    );

    for (const inv of dayInvoices) {
      // Avoid duplicates if invoice already has a corresponding voucher
      const alreadyAdded = entries.some((e) => e.id === inv.id || e.id === inv.accountingVoucherId);
      if (alreadyAdded) continue;

      const isDebit = (inv.type ?? "").includes("purchase") || (inv.type ?? "").includes("return");

      entries.push({
        id: inv.id as string,
        date: inv.date as string,
        dateNepali: inv.dateNepali as string | undefined,
        voucherNo: inv.invoiceNo as string,
        type: inv.type as string,
        narration: (inv.narration as string) || `Invoice: ${inv.invoiceNo}`,
        partyName: inv.partyName as string | undefined,
        debit: isDebit ? Number(inv.grandTotal) || 0 : 0,
        credit: !isDebit ? Number(inv.grandTotal) || 0 : 0,
        lines: [],
        status: inv.status as string | undefined,
        createdByName: inv.createdByName as string | undefined,
      });
    }

    // Sort by voucherNo ascending
    entries.sort((a, b) => a.voucherNo.localeCompare(b.voucherNo));

    return entries;
  }, [vouchers, invoices, dateRange.fromDate, dateRange.toDate]);

  // ── Filter ───────────────────────────────────────────────────────────────
  const filteredEntries = useMemo<DayBookEntry[]>(() => {
    return dayBookEntries.filter((entry) => {
      const matchType = typeFilter === "all" || entry.type === typeFilter;
      const matchSearch =
        searchTerm === "" ||
        entry.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.narration ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.partyName ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchSearch;
    });
  }, [dayBookEntries, typeFilter, searchTerm]);

  // ── Summary ──────────────────────────────────────────────────────────────
  const summary = useMemo<DaySummary>(() => {
    const totalDebit = filteredEntries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = filteredEntries.reduce((s, e) => s + e.credit, 0);
    const byType: Record<string, number> = {};
    for (const e of filteredEntries) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    }
    return {
      totalDebit,
      totalCredit,
      totalVouchers: filteredEntries.length,
      byType,
    };
  }, [filteredEntries]);

  // ── Unique types for filter ──────────────────────────────────────────────
  const uniqueTypes = useMemo<string[]>(() => {
    const set = new Set<string>(dayBookEntries.map((e) => e.type));
    return Array.from(set).sort();
  }, [dayBookEntries]);

  // ── Navigate date ────────────────────────────────────────────────────────

  // ── Export Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = useCallback(() => {
    try {
      const companyName = companySettings?.name || companySettings?.companyName || "Company";

      const headers = ["Voucher No.", "Type", "Narration", "Party", "Debit (Rs.)", "Credit (Rs.)"];

      const rows = filteredEntries.map((e: DayBookEntry) => [
        e.voucherNo,
        formatVoucherType(e.type),
        e.narration,
        e.partyName ?? "",
        e.debit,
        e.credit,
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [companyName],
        ["Day Book"],
        [`Date Range: ${dateRange.fromDate} to ${dateRange.toDate}`],
        [],
        headers,
        ...rows,
        [],
        ["TOTAL", "", "", "", summary.totalDebit, summary.totalCredit],
      ]);

      XLSX.utils.book_append_sheet(wb, ws, "DayBook");
      XLSX.writeFile(wb, `DayBook_${dateRange.fromDate}_${dateRange.toDate}.xlsx`);
      toast.success("Day Book exported to Excel.");
    } catch {
      toast.error("Export failed.");
    }
  }, [filteredEntries, companySettings, dateRange, summary]);

  const handlePrint = () => window.print();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="erp-report flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-y-auto p-4 md:p-6">
      <div className="erp-report-toolbar flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Day Book</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            All vouchers and transactions for a selected date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      <div className="no-print mb-4">
        <ReportDateRangePicker value={dateRange} onChange={setDateRange} label="Day Book Period" />
      </div>

      <div className="no-print bg-white border border-gray-200 rounded-md p-3 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher, narration, party…"
              className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="all">All types</option>
            {uniqueTypes.map((t: string) => (
              <option key={t} value={t}>
                {formatVoucherType(t)}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-md border border-gray-300 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("condensed")}
              className={`h-8 px-3 text-[11px] font-medium transition-colors ${
                viewMode === "condensed"
                  ? "bg-[#1557b0] text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Condensed
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detailed")}
              className={`h-8 px-3 text-[11px] font-medium transition-colors ${
                viewMode === "detailed"
                  ? "bg-[#1557b0] text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Detailed
            </button>
          </div>

          <span className="text-[11px] text-gray-500">
            {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={jumpInputRef}
            type="text"
            value={jumpQuery}
            onChange={(e) => setJumpQuery(e.target.value)}
            onKeyDown={handleJump}
            placeholder="Jump to voucher no."
            className="h-8 w-40 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
          <button
            type="button"
            onClick={() => handleJump({ key: "Enter" } as React.KeyboardEvent<HTMLInputElement>)}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
          >
            Find
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Vouchers
            </p>
            <p className="text-[14px] font-semibold text-gray-800 mt-0.5">
              {summary.totalVouchers}
            </p>
          </div>
          <BookOpen className="h-6 w-6 text-[#1557b0] opacity-20" />
        </div>

        <div className="bg-white border border-gray-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Total debit
            </p>
            <p className="text-[14px] font-semibold text-[#1557b0] mt-0.5 font-mono">
              {money(summary.totalDebit)}
            </p>
          </div>
          <TrendingUp className="h-6 w-6 text-[#1557b0] opacity-20" />
        </div>

        <div className="bg-white border border-gray-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Total credit
            </p>
            <p className="text-[14px] font-semibold text-gray-800 mt-0.5 font-mono">
              {money(summary.totalCredit)}
            </p>
          </div>
          <TrendingDown className="h-6 w-6 text-gray-400 opacity-30" />
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md">
          <ReportEmptyState
            message="No vouchers recorded in this period"
            hint="Adjust the date range or filter settings."
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-[#f5f6fa] flex items-center justify-between">
            <h3 className="text-[12px] font-semibold text-gray-700">
              Day Book ({dateRange.fromDate} to {dateRange.toDate})
            </h3>
            <p className="text-[11px] text-gray-500">
              {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}
            </p>
          </div>

          <div className="overflow-x-auto" ref={tableRef}>
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Voucher no.
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Narration
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-36">
                    Party
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Debit
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Credit
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map((entry: DayBookEntry) => {
                  const typeColor = getTypeColor(entry.type);
                  return (
                    <React.Fragment key={entry.id as string}>
                      <tr
                        data-voucher-no={String(entry.voucherNo) || ""}
                        className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-mono font-medium text-[#1557b0] border-b border-gray-100">
                          {String(entry.voucherNo)}
                        </td>

                        <td className="px-3 py-2.5 border-b border-gray-100">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}
                          >
                            {formatVoucherType(entry.type)}
                          </span>
                        </td>

                        <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[240px] border-b border-gray-100">
                          <span className="block truncate" title={String(entry.narration)}>
                            {String(entry.narration || "—")}
                          </span>
                        </td>

                        <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[140px] border-b border-gray-100">
                          <span className="block truncate" title={String(entry.partyName ?? "")}>
                            {entry.partyName ? String(entry.partyName) : "—"}
                          </span>
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700 border-b border-gray-100">
                          {entry.debit > 0 ? money(entry.debit) : "—"}
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700 border-b border-gray-100">
                          {entry.credit > 0 ? money(entry.credit) : "—"}
                        </td>

                        <td className="px-3 py-2.5 text-right border-b border-gray-100">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntry(entry);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>

                      {viewMode === "detailed" &&
                        (entry.lines ?? []).length > 0 &&
                        (entry.lines as DayBookLine[]).map((line: DayBookLine, lineIdx: number) => (
                          <tr key={`${String(entry.id)}-line-${lineIdx}`} className="bg-gray-50/60">
                            <td className="px-3 py-1.5 pl-8 text-[10px] text-gray-400 font-mono border-b border-gray-100">
                              ↳
                            </td>
                            <td className="px-3 py-1.5 border-b border-gray-100" />
                            <td
                              colSpan={2}
                              className="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100"
                            >
                              {line.accountName ? String(line.accountName) : "—"}
                              {line.narration ? ` — ${String(line.narration)}` : ""}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-[11px] text-gray-500 border-b border-gray-100">
                              {line.debit > 0 ? money(line.debit) : "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-[11px] text-gray-500 border-b border-gray-100">
                              {line.credit > 0 ? money(line.credit) : "—"}
                            </td>
                            <td className="border-b border-gray-100" />
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              {filteredEntries.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Total ({summary.totalVouchers} vouchers)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#1557b0]">
                      {money(summary.totalDebit)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                      {money(summary.totalCredit)}
                    </td>
                    <td />
                  </tr>

                  {/* Balance check row */}
                  {Math.abs(summary.totalDebit - summary.totalCredit) > 0.01 && (
                    <tr className="bg-red-50 border-t border-red-200">
                      <td colSpan={4} className="px-3 py-2 text-[11px] font-semibold text-red-700">
                        ⚠ Imbalance detected
                      </td>
                      <td
                        colSpan={3}
                        className="px-3 py-2 text-right font-mono text-[11px] font-bold text-red-700"
                      >
                        Difference: {money(Math.abs(summary.totalDebit - summary.totalCredit))}
                      </td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
          <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
            {filteredEntries.length} day book entr{filteredEntries.length === 1 ? "y" : "ies"}
          </div>
        </div>
      )}

      {Object.keys(summary.byType).length > 1 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-md p-4">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Vouchers by Type
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byType).map(([type, count]: [string, number]) => {
              const color = getTypeColor(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                    typeFilter === type
                      ? `${color.bg} ${color.text} ${color.border} ring-2 ring-offset-1 ring-current`
                      : `${color.bg} ${color.text} ${color.border}`
                  }`}
                >
                  {formatVoucherType(type)}
                  <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                    {String(count)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEntry(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-800">
                  {String(selectedEntry.voucherNo)}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${
                    getTypeColor(selectedEntry.type).bg
                  } ${getTypeColor(selectedEntry.type).text} ${
                    getTypeColor(selectedEntry.type).border
                  }`}
                >
                  {formatVoucherType(selectedEntry.type)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Date
                  </p>
                  <p className="text-gray-800">
                    {String(selectedEntry.dateNepali || selectedEntry.date)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Party
                  </p>
                  <p className="text-gray-800">
                    {selectedEntry.partyName ? String(selectedEntry.partyName) : "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Narration
                  </p>
                  <p className="text-gray-800">{String(selectedEntry.narration || "—")}</p>
                </div>
              </div>

              {/* Ledger lines */}
              {(selectedEntry.lines ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Ledger Entries
                  </p>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="report-table w-full text-[11px]">
                      <thead>
                        <tr className="bg-[#f5f6fa] border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                            Account
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase w-24">
                            Debit
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase w-24">
                            Credit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {/* Fix: explicitly type line as DayBookLine — resolves 'unknown' ReactNode error on line 287 */}
                        {(selectedEntry.lines as DayBookLine[]).map(
                          (line: DayBookLine, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">
                                {/* Explicit string cast — fixes 'unknown' assignable to ReactNode */}
                                {line.accountName ? String(line.accountName) : "—"}
                                {line.narration && (
                                  <span className="block text-[10px] text-gray-400">
                                    {String(line.narration)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-gray-700">
                                {line.debit > 0 ? money(line.debit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-gray-700">
                                {line.credit > 0 ? money(line.credit) : "—"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#f5f6fa] border-t border-gray-200">
                          <td className="px-3 py-2 font-bold text-[12px] text-gray-700">Total</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[12px] text-[#1557b0]">
                            {money(selectedEntry.debit)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[12px] text-gray-800">
                            {money(selectedEntry.credit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* If no lines, show summary amounts */}
              {(selectedEntry.lines ?? []).length === 0 && (
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                      Debit
                    </p>
                    <p className="text-[#1557b0] font-mono font-bold">
                      {selectedEntry.debit > 0 ? money(selectedEntry.debit) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                      Credit
                    </p>
                    <p className="text-gray-800 font-mono font-bold">
                      {selectedEntry.credit > 0 ? money(selectedEntry.credit) : "—"}
                    </p>
                  </div>
                </div>
              )}

              {selectedEntry.createdByName && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Created By
                  </p>
                  <p className="text-[12px] text-gray-700">{String(selectedEntry.createdByName)}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-[#f5f6fa] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
};

export default DayBook;
