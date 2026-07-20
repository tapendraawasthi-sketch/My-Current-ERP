// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "../lib/db";
import { useStore } from "../store/useStore";
import { Download, FileSpreadsheet, RefreshCw, Printer } from "lucide-react";
import { ReportWorkspace } from "@/features/reports";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceivableRow {
  partyId: string;
  partyName: string;
  partyPan?: string;
  invoiceNo: string;
  invoiceDate: string;
  dateNepali?: string;
  dueDate?: string;
  originalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysOverdue: number;
  paymentStatus: string;
  invoiceId: string;
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

function getOverdueClass(days: number): string {
  if (days === 0) return "text-[var(--ds-status-success)]";
  if (days <= 30) return "text-[var(--ds-status-warning)]";
  if (days <= 60) return "text-[var(--ds-status-warning)]";
  if (days <= 90) return "text-[var(--ds-status-danger)]";
  return "text-[var(--ds-status-danger)] font-semibold";
}

function getStatusBadge(status: string): string {
  switch (status) {
    case "paid":
      return "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]";
    case "partial":
      return "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)]";
    case "unpaid":
      return "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)]";
    default:
      return "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]";
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

const OutstandingReceivables: React.FC = () => {
  const { parties, companySettings } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: todayISO(),
    toDate: todayISO(),
  });
  const asOfDate = dateRange.toDate;
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRow, setSelectedRow] = useState<ReceivableRow | null>(null);
  const [partyFilter, setPartyFilter] = useState("");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [expandedParties, setExpandedParties] = useState<Set<string>>(new Set());

  const toggleParty = (partyId: string) => {
    setExpandedParties((prev) => {
      const next = new Set(prev);
      next.has(partyId) ? next.delete(partyId) : next.add(partyId);
      return next;
    });
  };

  const getAgingClass = (daysOverdue: number) => {
    if (daysOverdue <= 0) return "bg-transparent text-[var(--ds-text-default)] border-l-[3px] border-l-transparent";
    if (daysOverdue <= 30)
      return "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)] border-l-[3px] border-l-[var(--ds-status-warning)]";
    if (daysOverdue <= 60)
      return "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)] border-l-[3px] border-l-[var(--ds-status-warning)]";
    if (daysOverdue <= 90)
      return "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)] border-l-[3px] border-l-[var(--ds-status-danger)]";
    return "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)] border-l-[3px] border-l-[var(--ds-status-danger)] font-semibold";
  };

  const db = getDB();

  // Fix: useLiveQuery from "dexie-react-hooks" — correct package
  const invoices = useLiveQuery(
    () =>
      getDB()
        .invoices.where("type")
        .equals("sales-invoice")
        .toArray()
        .then((res) => res.filter((inv) => inv.status !== "draft" && inv.status !== "cancelled")),
    [],
  );

  const receipts = useLiveQuery(
    () =>
      getDB()
        .vouchers.where("type")
        .equals("receipt")
        .toArray()
        .then((res) => res.filter((v) => v.status === "posted")),
    [],
  );

  // ── Compute receivable rows ───────────────────────────────────────────────
  const receivableRows = useMemo<ReceivableRow[]>(() => {
    if (!invoices || !receipts) return [];

    const rows: ReceivableRow[] = [];

    for (const inv of invoices as any[]) {
      if (!inv) continue;
      if (!matchBranch(inv.branchId)) continue;

      const originalAmount = Number(inv.grandTotal ?? inv.total ?? 0);
      if (originalAmount <= 0) continue;

      // Compute receipts allocated to this invoice
      let allocatedAmount = Number(inv.paidAmount ?? 0);
      for (const rct of receipts as any[]) {
        if (!rct || rct.partyId !== inv.partyId) continue;
        for (const line of rct.lines ?? []) {
          if (line.billRefNo === inv.invoiceNo || line.billRefNo === inv.id) {
            allocatedAmount += Number(line.amount ?? 0);
          }
        }
      }

      const outstanding = parseFloat((originalAmount - allocatedAmount).toFixed(2));

      // Skip fully paid
      if (outstanding <= 0.005) continue;

      // Days overdue from due date
      const refDate = inv.dueDate ?? inv.date;
      const daysOverdue = refDate ? daysDiff(refDate, asOfDate) : 0;

      const partyId = inv.partyId ?? "unknown";
      const partyName =
        inv.partyName ?? parties.find((p: any) => p.id === partyId)?.name ?? "Unknown";
      const partyPan = inv.partyPan ?? parties.find((p: any) => p.id === partyId)?.pan;

      const paymentStatus =
        allocatedAmount <= 0 ? "unpaid" : allocatedAmount < originalAmount ? "partial" : "paid";

      rows.push({
        partyId,
        partyName,
        partyPan,
        invoiceNo: inv.invoiceNo ?? inv.id,
        invoiceDate: inv.date ?? "",
        dateNepali: inv.dateNepali,
        dueDate: inv.dueDate,
        originalAmount,
        paidAmount: parseFloat(allocatedAmount.toFixed(2)),
        outstandingAmount: outstanding,
        daysOverdue,
        paymentStatus,
        invoiceId: inv.id,
      });
    }

    // Sort by days overdue descending
    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, receipts, asOfDate, parties, matchBranch, branchFilter]);

  // ── Unique parties for filter ─────────────────────────────────────────────
  const uniqueParties = useMemo(() => {
    const seen = new Set<string>();
    return receivableRows
      .filter((r) => {
        if (seen.has(r.partyId)) return false;
        seen.add(r.partyId);
        return true;
      })
      .map((r) => ({ id: r.partyId, name: r.partyName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [receivableRows]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo<ReceivableRow[]>(() => {
    return receivableRows.filter((r) => {
      const matchStatus = statusFilter === "all" || r.paymentStatus === statusFilter;
      const matchParty = partyFilter === "" || r.partyId === partyFilter;
      const matchSearch =
        searchTerm === "" ||
        r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.partyPan ?? "").includes(searchTerm);
      const matchOverdue = showOverdueOnly ? r.daysOverdue > 0 : true;
      return matchStatus && matchParty && matchSearch && matchOverdue;
    });
  }, [receivableRows, statusFilter, partyFilter, searchTerm, showOverdueOnly]);

  // ── Totals ────────────────────────────────────────────────────────────────

  const groupedByParty = useMemo(() => {
    const map = new Map<
      string,
      {
        partyName: string;
        partyId: string;
        invoices: ReceivableRow[];
        total: number;
        avgDaysOverdue: number;
      }
    >();

    for (const inv of filteredRows) {
      const key = inv.partyId || inv.partyName || "unknown";
      const outstanding = inv.outstandingAmount;
      if (outstanding <= 0) continue;

      const days = inv.daysOverdue;

      if (!map.has(key)) {
        map.set(key, {
          partyName: inv.partyName || "—",
          partyId: inv.partyId || "",
          invoices: [],
          total: 0,
          avgDaysOverdue: 0,
        });
      }
      const group = map.get(key)!;
      group.invoices.push(inv);
      group.total += outstanding;
      group.avgDaysOverdue =
        (group.avgDaysOverdue * (group.invoices.length - 1) + days) / group.invoices.length;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  const totals = useMemo(
    () => ({
      original: filteredRows.reduce((s, r) => s + r.originalAmount, 0),
      paid: filteredRows.reduce((s, r) => s + r.paidAmount, 0),
      outstanding: filteredRows.reduce((s, r) => s + r.outstandingAmount, 0),
      overdue: filteredRows
        .filter((r) => r.daysOverdue > 0)
        .reduce((s, r) => s + r.outstandingAmount, 0),
    }),
    [filteredRows],
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const companyName = companySettings?.name ?? "Company";
      const headers = [
        "Party",
        "PAN",
        "Invoice No.",
        "Date",
        "Due Date",
        "Original Amt",
        "Paid Amt",
        "Outstanding",
        "Days Overdue",
        "Status",
      ];
      const rows = filteredRows.map((r) => [
        r.partyName,
        r.partyPan ?? "",
        r.invoiceNo,
        r.invoiceDate,
        r.dueDate ?? "",
        r.originalAmount,
        r.paidAmount,
        r.outstandingAmount,
        r.daysOverdue,
        r.paymentStatus,
      ]);

      const wb = XLSX.utils.book_new();
      const wsData = [
        [companyName],
        ["Outstanding Receivables Report"],
        [`As of: ${asOfDate}`],
        [],
        headers,
        ...rows,
        [],
        ["TOTAL", "", "", "", "", totals.original, totals.paid, totals.outstanding, "", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Outstanding Receivables");
      XLSX.writeFile(wb, `OutstandingReceivables_${asOfDate}.xlsx`);
      toast.success("Outstanding receivables exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const isLoading = !invoices || !receipts;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ReportWorkspace
      title="Money customers owe"
      description="Unpaid and partly paid sales invoices."
      periodLabel={`As of ${asOfDate}`}
      onPrint={() => window.print()}
      onExportExcel={handleExport}
    >


      {/* Summary KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Total Invoiced
            </p>
            <p className="text-[12px] number-cell-bold text-gray-700 mt-0.5">
              {money(totals.original)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Received
            </p>
            <p className="text-[12px] number-cell-bold text-green-700 mt-0.5">
              {money(totals.paid)}
            </p>
          </div>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Outstanding
            </p>
            <p className="text-[12px] number-cell-bold text-[var(--ds-action-primary)] mt-0.5">
              {money(totals.outstanding)}
            </p>
          </div>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Overdue
            </p>
            <p className="text-[12px] number-cell-bold text-red-700 mt-0.5">
              {money(totals.overdue)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 shadow-sm flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowOverdueOnly((v) => !v)}
          className={`h-8 px-3 text-[12px] font-semibold rounded-md border inline-flex items-center gap-1.5 ${
            showOverdueOnly
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-[var(--ds-surface)] border-[var(--ds-border-default)] text-[var(--ds-text-default)]"
          }`}
        >
          {showOverdueOnly ? "Overdue only" : "All invoices"}
          {showOverdueOnly && (
            <span className="rounded-full bg-[var(--ds-status-danger)] px-1.5 text-[12px] font-semibold text-white">
              {groupedByParty.reduce(
                (s, g) => s + g.invoices.filter((inv) => inv.daysOverdue > 0).length,
                0,
              )}
            </span>
          )}
        </button>

        <div className="mb-2">
          <ReportDateRangePicker
            value={dateRange}
            onChange={setDateRange}
            label="As Of Date (Uses To Date)"
            compact
          />
        </div>

        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {["all", "unpaid", "partial"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`h-8 px-3 text-[12px] font-medium transition-colors capitalize ${
                statusFilter === s
                  ? "bg-[var(--ds-action-primary)] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={partyFilter}
          onChange={(e) => setPartyFilter(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
        >
          <option value="">All Parties</option>
          {uniqueParties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            aria-label="Branch"
            className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          >
            <option value="all">All branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party, invoice, PAN…"
            className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-[12px]">Loading receivables…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="report-table w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-[var(--ds-surface-muted)] border-b-2 border-[var(--ds-border-default)]">
                  <th className="w-9 px-2 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Party / Invoice
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Inv. No.
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Due Date
                  </th>
                  <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Days Overdue
                  </th>
                  <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Outstanding
                  </th>
                  <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedByParty.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-[12px] text-gray-400">
                      No outstanding receivables found.
                    </td>
                  </tr>
                ) : (
                  groupedByParty.map((group) => {
                    const isExpanded = expandedParties.has(group.partyId || group.partyName);
                    const groupKey = group.partyId || group.partyName;
                    const avgClass = getAgingClass(Math.round(group.avgDaysOverdue));

                    return (
                      <React.Fragment key={groupKey}>
                        <tr
                          className={`cursor-pointer ${avgClass}`}
                          onClick={() => toggleParty(groupKey)}
                        >
                          <td className="px-2 py-2 text-center text-[12px]">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="px-3 py-2 text-[13px] font-semibold">
                            {group.partyName}
                            <span className="ml-2 text-[12px] font-normal text-[var(--ds-text-muted)]">
                              {group.invoices.length} bill{group.invoices.length > 1 ? "s" : ""}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[12px] text-[var(--ds-text-muted)]" colSpan={3}>
                            Avg overdue: {Math.round(group.avgDaysOverdue)} days
                          </td>
                          <td className={`px-3 py-2 text-right font-mono text-[13px] font-bold ${avgClass}`}>
                            Rs. {group.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2} />
                        </tr>

                        {isExpanded &&
                          group.invoices.map((inv) => {
                            const outstanding = inv.outstandingAmount;
                            const daysOverdue = inv.daysOverdue;
                            const rowClass = getAgingClass(daysOverdue);

                            return (
                              <tr key={inv.invoiceId} className={rowClass}>
                                <td />
                                <td className="px-3 py-2 text-[12px] pl-8 text-[var(--ds-text-muted)]">
                                  {inv.invoiceNo || inv.invoiceId?.slice(0, 8)}
                                </td>
                                <td className="px-3 py-2 text-[12px]">{inv.invoiceNo}</td>
                                <td className="px-3 py-2 text-[12px]">
                                  {inv.dateNepali || inv.invoiceDate}
                                </td>
                                <td className="px-3 py-2 text-[12px]">{inv.dueDate || "—"}</td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                  {daysOverdue > 0 ? `${daysOverdue}d` : "Not due"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[13px] font-semibold">
                                  {outstanding.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRow(inv)}
                                    className="h-7 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[12px] font-medium hover:bg-[var(--ds-surface-hover)]"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[var(--ds-surface-muted)] border-t-2 border-[var(--ds-border-default)]">
                    <td colSpan={2} className="px-3 py-2.5 text-[12px] font-bold text-gray-700">
                      Total ({filteredRows.length} invoices)
                    </td>
                    <td colSpan={4} />
                    <td className="number-cell-bold text-[var(--ds-action-primary)]">
                      {money(totals.outstanding)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-[var(--ds-z-dropdown)] bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRow(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[var(--ds-surface-muted)]">
              <span className="text-[13px] font-semibold text-gray-700">
                Invoice: {selectedRow.invoiceNo}
              </span>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Party
                  </p>
                  <p className="text-gray-700 font-semibold">{selectedRow.partyName}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    PAN
                  </p>
                  <p className="text-gray-700 font-mono">{selectedRow.partyPan ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Invoice Date
                  </p>
                  <p className="text-gray-700">
                    {selectedRow.dateNepali || selectedRow.invoiceDate}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Due Date
                  </p>
                  <p className="text-gray-700">{selectedRow.dueDate || "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Original Amount
                  </p>
                  <p className="text-gray-700 font-mono font-semibold">
                    {money(selectedRow.originalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Amount Received
                  </p>
                  <p className="text-green-600 font-mono font-semibold">
                    {money(selectedRow.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Outstanding
                  </p>
                  <p className="text-[var(--ds-action-primary)] font-mono font-bold text-[14px]">
                    {money(selectedRow.outstandingAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Days Overdue
                  </p>
                  <p className={`font-semibold ${getOverdueClass(selectedRow.daysOverdue)}`}>
                    {selectedRow.daysOverdue > 0
                      ? `${selectedRow.daysOverdue} days`
                      : "Not overdue"}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-[var(--ds-surface-muted)] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="h-8 px-3 bg-white border border-gray-200 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ReportWorkspace>
  );
};

export default OutstandingReceivables;
