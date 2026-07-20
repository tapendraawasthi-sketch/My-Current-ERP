// @ts-nocheck
import React, { useState, useMemo, useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import { ReportWorkspace } from "@/features/reports";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";
import DataTable from "../components/ui/DataTable";
import { ReportEmptyState } from "../components/ReportEmptyState";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  Eye,
  X,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Search,
} from "lucide-react";
import {
  BRANCH_CHANGED_EVENT,
  matchesBranchFilter,
  readActiveBranchId,
} from "../lib/activeBranch";

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
  branchId?: string;
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
  return Number(n || 0).toLocaleString("en-IN", {
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

/** Quiet type chip — no rainbow (IMPLEMENT_NOW REG). */
function getTypeColor(_type: string): { bg: string; text: string; border: string } {
  return {
    bg: "bg-[var(--ds-surface-muted)]",
    text: "text-[var(--ds-text-muted)]",
    border: "border-[var(--ds-border-default)]",
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

const DayBook: React.FC = () => {
  const { vouchers, invoices, accounts, companySettings, currentFiscalYear, branches } = useStore();

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: todayISO(),
    toDate: todayISO(),
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState(() => readActiveBranchId() || "all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DayBookEntry | null>(null);
  const [viewMode, setViewMode] = useState<"condensed" | "detailed">("condensed");

  const [jumpQuery, setJumpQuery] = useState("");
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sync = () => {
      const id = readActiveBranchId();
      if (id) setBranchFilter(id);
    };
    window.addEventListener(BRANCH_CHANGED_EVENT, sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BRANCH_CHANGED_EVENT, sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

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
      (found as HTMLElement).style.background = "var(--ds-status-warning-surface)";
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
        branchId: v.branchId as string | undefined,
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
        branchId: inv.branchId as string | undefined,
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
      const matchBranch = matchesBranchFilter(entry.branchId, branchFilter);
      const matchSearch =
        searchTerm === "" ||
        entry.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.narration ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.partyName ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchBranch && matchSearch;
    });
  }, [dayBookEntries, typeFilter, branchFilter, searchTerm]);

  const branchOptions = useMemo(() => {
    const list = (branches || []).filter((b: any) => b && b.isActive !== false);
    return list as { id: string; name?: string; code?: string }[];
  }, [branches]);

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
            className="font-medium text-[var(--ds-action-primary)]"
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
              className={`inline-block rounded px-2 py-0.5 text-[12px] font-semibold uppercase border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}
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
            <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-green-100 text-green-700">
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)]"
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
  const companyName =
    companySettings?.companyNameEn || companySettings?.companyName || companySettings?.name || "Company";
  const periodLabel = `${dateRange.fromDate} to ${dateRange.toDate}`;
  const balanced = Math.abs(summary.totalDebit - summary.totalCredit) <= 0.01;

  return (
    <>
      <ReportWorkspace
        title="Today's transactions"
        description="Everything entered for the dates."
        companyName={companyName}
        nameNepali={companySettings?.companyNameNe}
        pan={companySettings?.pan}
        periodLabel={periodLabel}
        status={
          filteredEntries.length === 0
            ? undefined
            : balanced
              ? { tone: "success", label: "Accounts match" }
              : {
                  tone: "danger",
                  label: `Out by Rs. ${money(Math.abs(summary.totalDebit - summary.totalCredit))}`,
                }
        }
        onPrint={handlePrint}
        onExportExcel={handleExportExcel}
        filterSlot={
          <>
            <ReportDateRangePicker value={dateRange} onChange={setDateRange} label="Period" />
            <div className="relative min-w-[160px] max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ds-text-subtle)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search voucher, narration, party…"
                data-testid="daybook-search"
                aria-label="Search day book"
                className="h-8 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] pl-8 pr-3 text-[13px] text-[var(--ds-text-default)] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Voucher type"
              className="h-8 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[13px] text-[var(--ds-text-default)] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            >
              <option value="all">All types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {formatVoucherType(t)}
                </option>
              ))}
            </select>
            {branchOptions.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                aria-label="Branch"
                className="h-8 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[13px] text-[var(--ds-text-default)] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center overflow-hidden rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface)]">
              <button
                type="button"
                onClick={() => setViewMode("condensed")}
                className={`h-8 px-3 text-[12px] font-medium ${
                  viewMode === "condensed"
                    ? "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]"
                    : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)]"
                }`}
              >
                Condensed
              </button>
              <button
                type="button"
                onClick={() => setViewMode("detailed")}
                className={`h-8 px-3 text-[12px] font-medium ${
                  viewMode === "detailed"
                    ? "bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]"
                    : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)]"
                }`}
              >
                Detailed
              </button>
            </div>
            <input
              ref={jumpInputRef}
              type="text"
              value={jumpQuery}
              onChange={(e) => setJumpQuery(e.target.value)}
              onKeyDown={handleJump}
              placeholder="Jump to voucher no."
              aria-label="Jump to voucher number"
              className="h-8 w-40 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[13px] text-[var(--ds-text-default)] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            />
            <button
              type="button"
              onClick={() => handleJump({ key: "Enter" })}
              className="h-8 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 text-[13px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
            >
              Find
            </button>
            <span className="text-[12px] text-[var(--ds-text-muted)]">
              {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}
            </span>
          </>
        }
        kpiSlot={
          <>
            <div className="flex items-center justify-between rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                  Vouchers
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-[var(--ds-text-default)]">
                  {summary.totalVouchers}
                </p>
              </div>
              <BookOpen className="h-5 w-5 text-[var(--ds-action-primary)]" />
            </div>
            <div className="flex items-center justify-between rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                  Total debit
                </p>
                <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--ds-text-default)]">
                  {money(summary.totalDebit)}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-[var(--ds-status-success)]" />
            </div>
            <div className="flex items-center justify-between rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                  Total credit
                </p>
                <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--ds-text-default)]">
                  {money(summary.totalCredit)}
                </p>
              </div>
              <TrendingDown className="h-5 w-5 text-[var(--ds-status-danger)]" />
            </div>
          </>
        }
      >
        {filteredEntries.length === 0 ? (
          <ReportEmptyState
            message="No vouchers recorded in this period"
            hint="Adjust the date range or filter settings."
          />
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
                <span className="text-[12px] text-[var(--ds-text-muted)]">
                  Day Book ({dateRange.fromDate} to {dateRange.toDate})
                </span>
              }
            />
            <div className="overflow-hidden rounded-b-[var(--ds-radius-lg)] border border-t-0 border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]">
              <div className="flex items-center justify-between px-3 py-2.5 text-[13px] font-bold text-[var(--ds-text-default)]">
                <span>Total ({summary.totalVouchers} vouchers)</span>
                <div className="flex gap-8 font-mono tabular-nums">
                  <span>{money(summary.totalDebit)}</span>
                  <span>{money(summary.totalCredit)}</span>
                </div>
              </div>
              {!balanced && (
                <div className="border-t border-[var(--ds-status-danger)]/30 bg-[var(--ds-status-danger-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--ds-status-danger)]">
                  Imbalance detected — Difference:{" "}
                  {money(Math.abs(summary.totalDebit - summary.totalCredit))}
                </div>
              )}
            </div>
          </div>
        )}

        {Object.keys(summary.byType).length > 1 && (
          <div className="mt-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
            <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
              Vouchers by type
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.byType).map(([type, count]: [string, number]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    typeFilter === type
                      ? "border-[var(--ds-action-primary)] bg-[var(--ds-action-primary)] text-[var(--ds-action-primary-text)]"
                      : "border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
                  }`}
                >
                  {formatVoucherType(type)}
                  <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[12px] font-bold">
                    {String(count)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </ReportWorkspace>

      {selectedEntry && (
        <div
          className="fixed inset-0 z-[var(--ds-z-modal)] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEntry(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-2)]">
            <div className="flex items-center justify-between border-b border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--ds-text-default)]">
                  {String(selectedEntry.voucherNo)}
                </span>
                <span className="inline-block rounded border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2 py-0.5 text-[12px] font-semibold uppercase text-[var(--ds-text-muted)]">
                  {formatVoucherType(selectedEntry.type)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="text-[var(--ds-text-muted)] hover:text-[var(--ds-text-default)]"
                aria-label="Close voucher detail"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Date
                  </p>
                  <p className="text-[var(--ds-text-default)]">
                    {String(selectedEntry.dateNepali || selectedEntry.date)}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Party
                  </p>
                  <p className="text-[var(--ds-text-default)]">
                    {selectedEntry.partyName ? String(selectedEntry.partyName) : "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Narration
                  </p>
                  <p className="text-[var(--ds-text-default)]">{String(selectedEntry.narration || "—")}</p>
                </div>
              </div>

              {(selectedEntry.lines ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Ledger entries
                  </p>
                  <div className="overflow-hidden rounded-lg border border-[var(--ds-border-default)]">
                    <table className="report-table w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]">
                          <th className="px-3 py-2 text-left font-semibold uppercase text-[var(--ds-text-muted)]">
                            Account
                          </th>
                          <th className="w-24 px-3 py-2 text-right font-semibold uppercase text-[var(--ds-text-muted)]">
                            Debit
                          </th>
                          <th className="w-24 px-3 py-2 text-right font-semibold uppercase text-[var(--ds-text-muted)]">
                            Credit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ds-border-subtle)]">
                        {(selectedEntry.lines as DayBookLine[]).map(
                          (line: DayBookLine, idx: number) => (
                            <tr key={idx} className="hover:bg-[var(--ds-surface-hover)]">
                              <td className="px-3 py-2 text-[var(--ds-text-default)]">
                                {line.accountName ? String(line.accountName) : "—"}
                                {line.narration && (
                                  <span className="block text-[12px] text-[var(--ds-text-muted)]">
                                    {String(line.narration)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[var(--ds-text-default)]">
                                {line.debit > 0 ? money(line.debit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[var(--ds-text-default)]">
                                {line.credit > 0 ? money(line.credit) : "—"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]">
                          <td className="px-3 py-2 text-[13px] font-bold text-[var(--ds-text-default)]">
                            Total
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[13px] font-bold text-[var(--ds-action-primary)]">
                            {money(selectedEntry.debit)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[13px] font-bold text-[var(--ds-text-default)]">
                            {money(selectedEntry.credit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {(selectedEntry.lines ?? []).length === 0 && (
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                      Debit
                    </p>
                    <p className="font-mono font-bold text-[var(--ds-action-primary)]">
                      {selectedEntry.debit > 0 ? money(selectedEntry.debit) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                      Credit
                    </p>
                    <p className="font-mono font-bold text-[var(--ds-text-default)]">
                      {selectedEntry.credit > 0 ? money(selectedEntry.credit) : "—"}
                    </p>
                  </div>
                </div>
              )}

              {selectedEntry.createdByName && (
                <div>
                  <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Created by
                  </p>
                  <p className="text-[13px] text-[var(--ds-text-default)]">
                    {String(selectedEntry.createdByName)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-5 py-3">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="h-8 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 text-[13px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DayBook;
