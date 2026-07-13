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
import DataTable from "../components/ui/DataTable";
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

  const dayBookColumns = useMemo(
    () => [
      { key: "date", header: "Date", width: "7rem", sortable: true },
      {
        key: "voucherNo",
        header: "Voucher no.",
        width: "7rem",
        sortable: true,
        mono: true,
        render: (row) => (
          <span
            className="font-medium text-[var(--ox-primary)]"
            data-voucher-no={String(row.voucherNo || "")}
          >
            {String(row.voucherNo)}
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        width: "7rem",
        sortable: true,
        render: (row) => {
          const typeColor = getTypeColor(String(row.type || ""));
          return (
            <span
              className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}
            >
              {formatVoucherType(String(row.type || ""))}
            </span>
          );
        },
      },
      {
        key: "partyName",
        header: "Party",
        width: "9rem",
        render: (row) => (
          <span className="block max-w-[140px] truncate" title={String(row.partyName || "")}>
            {row.partyName ? String(row.partyName) : "—"}
          </span>
        ),
      },
      {
        key: "narration",
        header: "Narration",
        render: (row) => (
          <span className="block max-w-[240px] truncate" title={String(row.narration || "")}>
            {String(row.narration || "—")}
          </span>
        ),
      },
      {
        key: "debit",
        header: "Debit",
        align: "right",
        width: "8rem",
        sortable: true,
        mono: true,
        render: (row) => (Number(row.debit) > 0 ? money(Number(row.debit)) : "—"),
      },
      {
        key: "credit",
        header: "Credit",
        align: "right",
        width: "8rem",
        sortable: true,
        mono: true,
        render: (row) => (Number(row.credit) > 0 ? money(Number(row.credit)) : "—"),
      },
      {
        key: "status",
        header: "Status",
        width: "5rem",
        render: (row) =>
          row._kind === "line" ? null : (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-green-100 text-green-700">
              {String(row.status || "posted")}
            </span>
          ),
      },
      {
        key: "createdByName",
        header: "Created by",
        width: "7rem",
        render: (row) => (row._kind === "line" ? null : String(row.createdByName || "—")),
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        width: "4rem",
        render: (row) =>
          row._kind === "line" ? null : (
            <button
              type="button"
              aria-label={`Open ${String(row.voucherNo)}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)]"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEntry(row);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          ),
      },
    ],
    [],
  );

  const tableRows = useMemo(() => {
    const rows = [];
    for (const entry of filteredEntries) {
      rows.push({ ...entry, _kind: "voucher" });
      if (viewMode === "detailed") {
        (entry.lines || []).forEach((line, lineIdx) => {
          rows.push({
            id: `${entry.id}-line-${lineIdx}`,
            date: "",
            voucherNo: "",
            type: "",
            narration: `${line.accountName || "—"}${line.narration ? ` — ${line.narration}` : ""}`,
            partyName: "",
            debit: line.debit,
            credit: line.credit,
            status: "",
            createdByName: "",
            _kind: "line",
            _parentId: entry.id,
          });
        });
      }
    }
    return rows;
  }, [filteredEntries, viewMode]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="erp-report flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--ox-bg)] p-4 md:p-6">
      <div className="erp-report-toolbar mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--ox-text)]">Day Book</h1>
          <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">
            All vouchers and transactions for a selected date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3 text-[12px] font-medium text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3 text-[12px] font-medium text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      <div className="no-print mb-4">
        <ReportDateRangePicker value={dateRange} onChange={setDateRange} label="Day Book Period" />
      </div>

      <div className="no-print mb-4 space-y-3 rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ox-text-subtle)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher, narration, party…"
              data-testid="daybook-search"
              aria-label="Search day book"
              className="h-8 w-full rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] pl-8 pr-3 text-[12px] text-[var(--ox-text)] focus:border-[var(--ox-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ox-primary)]/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2.5 text-[12px] text-[var(--ox-text)] focus:border-[var(--ox-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ox-primary)]/20"
          >
            <option value="all">All types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {formatVoucherType(t)}
              </option>
            ))}
          </select>
          <div className="flex items-center overflow-hidden rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)]">
            <button
              type="button"
              onClick={() => setViewMode("condensed")}
              className={`h-8 px-3 text-[11px] font-medium ${
                viewMode === "condensed"
                  ? "bg-[var(--ox-primary)] text-white"
                  : "text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)]"
              }`}
            >
              Condensed
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detailed")}
              className={`h-8 px-3 text-[11px] font-medium ${
                viewMode === "detailed"
                  ? "bg-[var(--ox-primary)] text-white"
                  : "text-[var(--ox-text-muted)] hover:bg-[var(--ox-surface-muted)]"
              }`}
            >
              Detailed
            </button>
          </div>
          <span className="text-[11px] text-[var(--ox-text-muted)]">
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
            className="h-8 w-40 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-2.5 text-[12px] text-[var(--ox-text)] focus:border-[var(--ox-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ox-primary)]/20"
          />
          <button
            type="button"
            onClick={() => handleJump({ key: "Enter" })}
            className="h-8 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3 text-[12px] font-medium text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)]"
          >
            Find
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Vouchers
            </p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--ox-text)]">
              {summary.totalVouchers}
            </p>
          </div>
          <BookOpen className="h-5 w-5 text-[var(--ox-primary)]" />
        </div>
        <div className="flex items-center justify-between rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Total debit
            </p>
            <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--ox-text)]">
              {money(summary.totalDebit)}
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-[var(--ox-success)]" />
        </div>
        <div className="flex items-center justify-between rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Total credit
            </p>
            <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--ox-text)]">
              {money(summary.totalCredit)}
            </p>
          </div>
          <TrendingDown className="h-5 w-5 text-[var(--ox-danger)]" />
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)]">
          <ReportEmptyState
            message="No vouchers recorded in this period"
            hint="Adjust the date range or filter settings."
          />
        </div>
      ) : (
        <div ref={tableRef} className="min-w-0">
          <DataTable
            columns={dayBookColumns}
            rows={tableRows}
            rowKey={(row) => String(row.id)}
            showSearch={false}
            emptyTitle="No matching vouchers"
            emptyDescription="Try adjusting filters or search terms."
            onRowClick={(row) => {
              if (row._kind === "line") {
                const parent = filteredEntries.find((e) => e.id === row._parentId);
                if (parent) setSelectedEntry(parent);
                return;
              }
              setSelectedEntry(row);
            }}
            toolbarExtra={
              <span className="text-[11px] text-[var(--ox-text-muted)]">
                Day Book ({dateRange.fromDate} to {dateRange.toDate})
              </span>
            }
          />
          <div className="overflow-hidden rounded-b-[var(--ox-radius-lg)] border border-t-0 border-[var(--ox-border)] bg-[var(--ox-primary-soft)]">
            <div className="flex items-center justify-between px-3 py-2.5 text-[12px] font-bold text-[var(--ox-text)]">
              <span>Total ({summary.totalVouchers} vouchers)</span>
              <div className="flex gap-8 font-mono tabular-nums">
                <span>{money(summary.totalDebit)}</span>
                <span>{money(summary.totalCredit)}</span>
              </div>
            </div>
            {Math.abs(summary.totalDebit - summary.totalCredit) > 0.01 && (
              <div className="border-t border-[var(--ox-danger)]/30 bg-[var(--ox-danger-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--ox-danger)]">
                Imbalance detected — Difference:{" "}
                {money(Math.abs(summary.totalDebit - summary.totalCredit))}
              </div>
            )}
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
