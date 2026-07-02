// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "../lib/db";
import { useStore } from "../store/useStore";
import { Download, FileSpreadsheet, RefreshCw, TrendingUp,  Printer,
} from "lucide-react";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

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
  if (days === 0) return "text-green-600";
  if (days <= 30) return "text-amber-600";
  if (days <= 60) return "text-orange-600";
  if (days <= 90) return "text-red-500";
  return "text-red-700 font-bold";
}

function getStatusBadge(status: string): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "partial":
      return "bg-amber-100 text-amber-700";
    case "unpaid":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

const OutstandingReceivables: React.FC = () => {
  const { parties, companySettings } = useStore();

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

  const getAgingStyle = (daysOverdue: number) => {
    if (daysOverdue <= 0)  return { background: "transparent", color: "#374151", borderLeft: "3px solid transparent" };
    if (daysOverdue <= 30) return { background: "#fffbeb",    color: "#92400e",  borderLeft: "3px solid #f59e0b" };
    if (daysOverdue <= 60) return { background: "#fff7ed",    color: "#9a3412",  borderLeft: "3px solid #f97316" };
    if (daysOverdue <= 90) return { background: "#fef2f2",    color: "#991b1b",  borderLeft: "3px solid #ef4444" };
    return                        { background: "#fef2f2",    color: "#7f1d1d",  borderLeft: "3px solid #991b1b" };
  };

  // Fix: use getDB() — default import, NOT named { db }
  const db = getDB();

  // Fix: useLiveQuery from "dexie-react-hooks" — correct package
  const invoices = useLiveQuery(
    () =>
      db.invoices
        .where("type")
        .equals("sales-invoice")
        .and((inv: any) => inv.status === "posted")
        .toArray(),
    [],
  );

  const receipts = useLiveQuery(
    () =>
      db.vouchers
        .where("type")
        .equals("receipt")
        .and((v: any) => v.status === "posted")
        .toArray(),
    [],
  );

  // ── Compute receivable rows ───────────────────────────────────────────────
  const receivableRows = useMemo<ReceivableRow[]>(() => {
    if (!invoices || !receipts) return [];

    const rows: ReceivableRow[] = [];

    for (const inv of invoices as any[]) {
      if (!inv) continue;

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
  }, [invoices, receipts, asOfDate, parties]);

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
    const map = new Map<string, {
      partyName: string;
      partyId: string;
      invoices: ReceivableRow[];
      total: number;
      avgDaysOverdue: number;
    }>();

    for (const inv of filteredRows) {
      const key = inv.partyId || inv.partyName || "unknown";
      const outstanding = inv.outstandingAmount;
      if (outstanding <= 0) continue;

      const days = inv.daysOverdue;

      if (!map.has(key)) {
        map.set(key, { partyName: inv.partyName || "—", partyId: inv.partyId || "", invoices: [], total: 0, avgDaysOverdue: 0 });
      }
      const group = map.get(key)!;
      group.invoices.push(inv);
      group.total += outstanding;
      group.avgDaysOverdue = (group.avgDaysOverdue * (group.invoices.length - 1) + days) / group.invoices.length;
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
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#1557b0]" />
            Outstanding Receivables
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Unpaid and partially paid sales invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-500 tracking-wide">
              Total Invoiced
            </p>
            <p className="text-[18px] font-bold text-gray-800 mt-0.5 font-mono">
              {money(totals.original)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-500 tracking-wide">
              Received
            </p>
            <p className="text-[18px] font-bold text-green-600 mt-0.5 font-mono">
              {money(totals.paid)}
            </p>
          </div>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-500 tracking-wide">
              Outstanding
            </p>
            <p className="text-[18px] font-bold text-[#1557b0] mt-0.5 font-mono">
              {money(totals.outstanding)}
            </p>
          </div>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold text-gray-500 tracking-wide">
              Overdue
            </p>
            <p className="text-[18px] font-bold text-red-600 mt-0.5 font-mono">
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
          style={{
            height: 30,
            padding: "0 12px",
            fontSize: 11,
            fontWeight: 700,
            background: showOverdueOnly ? "#fee2e2" : "#ffffff",
            border: `1px solid ${showOverdueOnly ? "#fca5a5" : "#d1d5db"}`,
            borderRadius: 4,
            color: showOverdueOnly ? "#dc2626" : "#374151",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            transition: "all 150ms ease",
          }}
        >
          {showOverdueOnly ? "⚠ Overdue Only" : "All Invoices"}
          {showOverdueOnly && (
            <span style={{ background: "#dc2626", color: "#ffffff", borderRadius: 9999, padding: "0 5px", fontSize: 9 }}>
              {groupedByParty.reduce((s, g) => s + g.invoices.filter(inv => inv.daysOverdue > 0).length, 0)}
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

        <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden">
          {["all", "unpaid", "partial"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`h-8 px-3 text-[11px] font-medium transition-colors capitalize ${
                statusFilter === s
                  ? "bg-[#1557b0] text-white"
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
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        >
          <option value="">All Parties</option>
          {uniqueParties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party, invoice, PAN…"
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
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
            <table className="report-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "5%" }} />   {/* expand */}
                <col style={{ width: "30%" }} />  {/* name */}
                <col style={{ width: "12%" }} />  {/* invoice no */}
                <col style={{ width: "10%" }} />  {/* date */}
                <col style={{ width: "10%" }} />  {/* due date */}
                <col style={{ width: "10%" }} />  {/* days overdue */}
                <col style={{ width: "13%" }} />  {/* outstanding */}
                <col style={{ width: "10%" }} />  {/* action */}
              </colgroup>
              <thead>
                <tr style={{ background: "#f5f6fa", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ width: 36 }} />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party / Invoice</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Inv. No.</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Days Overdue</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
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
                    const avgStyle = getAgingStyle(Math.round(group.avgDaysOverdue));

                    return (
                      <React.Fragment key={groupKey}>
                        {/* Party group header row */}
                        <tr
                          style={{
                            background: "#f9fafb",
                            cursor: "pointer",
                            borderBottom: "1px solid #e5e7eb",
                            borderLeft: avgStyle.borderLeft,
                          }}
                          onClick={() => toggleParty(groupKey)}
                        >
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: 11, color: "#6b7280", transform: isExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 150ms ease" }}>
                              ▶
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, fontSize: 12, color: "#111827" }}>
                            {group.partyName}
                            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>
                              {group.invoices.length} bill{group.invoices.length > 1 ? "s" : ""}
                            </span>
                          </td>
                          <td colSpan={3} style={{ padding: "8px 10px", fontSize: 10, color: "#9ca3af" }}>
                            Avg overdue: {Math.round(group.avgDaysOverdue)} days
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: avgStyle.color }}>
                            Rs. {group.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2} />
                        </tr>

                        {/* Nested invoice rows — shown when expanded */}
                        {isExpanded && group.invoices.map((inv) => {
                          const outstanding = inv.outstandingAmount;
                          const daysOverdue = inv.daysOverdue;
                          const rowStyle = getAgingStyle(daysOverdue);

                          return (
                            <tr key={inv.invoiceId} style={{ background: rowStyle.background, borderBottom: "1px solid #f3f4f6", borderLeft: rowStyle.borderLeft }}>
                              <td />
                              <td style={{ padding: "7px 10px 7px 24px", fontSize: 11, color: "#374151" }}>
                                {inv.invoiceNo || inv.invoiceId?.slice(0, 8)}
                              </td>
                              <td style={{ padding: "7px 10px", fontSize: 11, fontFamily: "monospace", color: "#374151" }}>
                                {inv.invoiceNo}
                              </td>
                              <td style={{ padding: "7px 10px", fontSize: 11, color: "#6b7280" }}>{inv.dateNepali || inv.invoiceDate}</td>
                              <td style={{ padding: "7px 10px", fontSize: 11, color: daysOverdue > 0 ? "#dc2626" : "#6b7280" }}>
                                {inv.dueDate || "—"}
                              </td>
                              <td className={`td-right ${daysOverdue > 0 ? "age-" + (daysOverdue<=30?30:daysOverdue<=60?60:daysOverdue<=90?90:"over90") : ""}`}>
                                {daysOverdue > 0 ? (
                                  <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    background: "#fee2e2",
                                    color: "#991b1b",
                                    borderRadius: 9999,
                                    padding: "1px 8px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}>
                                    {daysOverdue}d
                                  </span>
                                ) : (
                                  <span style={{ color: "#059669", fontSize: 10, fontWeight: 600 }}>Not due</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[11px]" style={{ fontWeight: 600, color: rowStyle.color }}>
                                {outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRow(inv)}
                                  style={{ height: 22, padding: "0 8px", fontSize: 10, fontWeight: 600, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 3, color: "#1e40af", cursor: "pointer" }}
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
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td colSpan={2} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Total ({filteredRows.length} invoices)
                    </td>
                    <td colSpan={4} />
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#1557b0]">
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
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRow(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[#f5f6fa]">
              <span className="text-[13px] font-semibold text-gray-800">
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
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    Party
                  </p>
                  <p className="text-gray-800 font-semibold">{selectedRow.partyName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    PAN
                  </p>
                  <p className="text-gray-700 font-mono">{selectedRow.partyPan ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    Invoice Date
                  </p>
                  <p className="text-gray-700">
                    {selectedRow.dateNepali || selectedRow.invoiceDate}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    Due Date
                  </p>
                  <p className="text-gray-700">{selectedRow.dueDate || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    Original Amount
                  </p>
                  <p className="text-gray-800 font-mono font-semibold">
                    {money(selectedRow.originalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    Amount Received
                  </p>
                  <p className="text-green-600 font-mono font-semibold">
                    {money(selectedRow.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
                    Outstanding
                  </p>
                  <p className="text-[#1557b0] font-mono font-bold text-[14px]">
                    {money(selectedRow.outstandingAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 tracking-wide mb-0.5">
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

            <div className="px-5 py-3 border-t border-gray-200 bg-[#f5f6fa] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutstandingReceivables;
