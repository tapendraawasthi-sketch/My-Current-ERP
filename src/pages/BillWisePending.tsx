import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { PartyType, VoucherType, PaymentStatus, VoucherStatus } from "../lib/types";
import { FileText, Download, FileSpreadsheet, Calendar, AlertCircle, ChevronDown, ChevronUp, Edit3, Plus, Trash2 } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { Card, Select, Button, Input } from "../components/ui";
import { NepaliDatePicker } from "../components/ui";
import { ReportHeader } from "../components/reports/ReportHeader";
import { ReportToolbar } from "../components/reports/ReportToolbar";
import { ReportFooter } from "../components/reports/ReportFooter";
import { ReportEmptyState } from "../components/ReportEmptyState";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

interface BillRow {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  partyId: string;
  partyName: string;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  daysOverdue: number;
}

const DEFAULT_SLABS = [
  { from: 0, to: 30, label: "0-30 days" },
  { from: 31, to: 60, label: "31-60 days" },
  { from: 61, to: 90, label: "61-90 days" },
  { from: 91, to: 180, label: "91-180 days" },
  { from: 181, to: null, label: ">180 days" },
];

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#991b1b"];

const InvoiceAllocationSubtable: React.FC<{ invoiceId: string }> = ({ invoiceId }) => {
  const { getBillAllocationsForInvoice } = useStore();
  const allocations = getBillAllocationsForInvoice(invoiceId) || [];

  if (allocations.length === 0) {
    return (
      <tr>
        <td colSpan={10} className="bg-slate-50 dark:bg-slate-900/40 p-2.5 text-center text-gray-400 italic text-[10px]">
          No payments or settlements allocated to this bill yet.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={10} className="bg-slate-50 dark:bg-slate-900/40 p-3 border-b">
        <div className="border rounded bg-white dark:bg-gray-800 overflow-hidden max-w-xl mx-auto shadow-sm">
          <div className="bg-slate-100 dark:bg-gray-700 p-2 font-bold text-gray-700 dark:text-gray-300 text-[10px] uppercase border-b">
            Payment & Settlement Allocations History
          </div>
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-50 dark:bg-gray-900 border-b">
              <tr>
                <th className="px-3 py-1.5 font-bold text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-3 py-1.5 font-bold text-gray-600 dark:text-gray-400">Voucher Reference</th>
                <th className="px-3 py-1.5 font-bold text-gray-600 dark:text-gray-400 text-right">Allocated Amt</th>
                <th className="px-3 py-1.5 font-bold text-gray-600 dark:text-gray-400 text-right">Remaining Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
              {allocations.map((alloc) => (
                <tr key={alloc.id} className="hover:bg-slate-50 dark:hover:bg-gray-900">
                  <td className="px-3 py-1">{alloc.allocationDate}</td>
                  <td className="px-3 py-1 font-mono text-[10px]">{alloc.voucherId}</td>
                  <td className="px-3 py-1 text-right font-mono text-green-600 font-bold">रू {formatNumber(alloc.allocatedAmount)}</td>
                  <td className="px-3 py-1 text-right font-mono text-gray-500">रू {formatNumber(alloc.balanceLeft)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
};

const BillWisePending: React.FC = () => {
  const { invoices, parties, companySettings } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  // Filters state
  const [partyType, setPartyType] = useState<"customer" | "supplier" | "all">("all");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Configurable Slabs state
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [isEditingSlabs, setIsEditingSlabs] = useState(false);
  const [tempSlabs, setTempSlabs] = useState(DEFAULT_SLABS);

  // Drilldown state
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Filter parties based on party type
  const filteredParties = useMemo(() => {
    if (partyType === "all") return parties.filter((p) => p.isActive);
    if (partyType === "customer")
      return parties.filter(
        (p) => p.isActive && (p.type === PartyType.CUSTOMER || p.type === PartyType.BOTH),
      );
    return parties.filter(
      (p) => p.isActive && (p.type === PartyType.SUPPLIER || p.type === PartyType.BOTH),
    );
  }, [parties, partyType]);

  const partyOptions = useMemo(
    () => filteredParties.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [filteredParties],
  );

  // Calculate days between dates
  const daysBetween = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Generate bill rows
  const billRows = useMemo((): BillRow[] => {
    const filtered = invoices.filter((inv) => {
      if (partyType === "customer") {
        if (inv.type !== VoucherType.SALES_INVOICE) return false;
      } else if (partyType === "supplier") {
        if (inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      } else {
        if (inv.type !== VoucherType.SALES_INVOICE && inv.type !== VoucherType.PURCHASE_INVOICE)
          return false;
      }

      if (inv.status !== VoucherStatus.POSTED) return false;
      if (inv.paymentStatus === PaymentStatus.PAID) return false;

      if (selectedPartyId && inv.partyId !== selectedPartyId) return false;

      if (fromDate && inv.date < fromDate) return false;
      if (toDate && inv.date > toDate) return false;

      return true;
    });

    const today = new Date().toISOString().split("T")[0];

    const rows: BillRow[] = filtered.map((inv) => {
      const balance = inv.grandTotal - (inv.paidAmount || 0);
      const dueDate = inv.dueDate || inv.date;
      const daysOverdue = daysBetween(dueDate, today);

      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.date,
        dueDate,
        partyId: inv.partyId,
        partyName: inv.partyName,
        originalAmount: inv.grandTotal,
        paidAmount: inv.paidAmount || 0,
        balance,
        daysOverdue,
      };
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return rows.filter(
        (r) =>
          r.invoiceNo.toLowerCase().includes(query) || r.partyName.toLowerCase().includes(query),
      );
    }

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, partyType, selectedPartyId, fromDate, toDate, searchQuery]);

  // Calculate summary totals based on configurable slabs
  const summary = useMemo(() => {
    const totalBills = billRows.length;
    const totalOriginal = billRows.reduce((sum, r) => sum + r.originalAmount, 0);
    const totalPaid = billRows.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalBalance = billRows.reduce((sum, r) => sum + r.balance, 0);

    const slabBalances = slabs.map((s) => {
      const balance = billRows
        .filter((r) => {
          const days = r.daysOverdue;
          return days >= s.from && (s.to === null || days <= s.to);
        })
        .reduce((sum, r) => sum + r.balance, 0);
      return { label: s.label, balance };
    });

    return {
      totalBills,
      totalOriginal,
      totalPaid,
      totalBalance,
      slabBalances,
    };
  }, [billRows, slabs]);

  const handleSaveSlabs = () => {
    for (let i = 0; i < tempSlabs.length - 1; i++) {
      if (tempSlabs[i].to !== null && tempSlabs[i].to! >= tempSlabs[i + 1].from) {
        toast.error("Invalid Slabs: Intervals must not overlap.");
        return;
      }
    }
    setSlabs(tempSlabs);
    setIsEditingSlabs(false);
    toast.success("Slabs configuration updated.");
  };

  const handleExportExcel = () => {
    const data = billRows.map((r) => ({
      "Bill No": r.invoiceNo,
      "Bill Date": r.invoiceDate,
      "Due Date": r.dueDate,
      "Party Name": r.partyName,
      "Original Amount": r.originalAmount,
      "Paid Amount": r.paidAmount,
      Balance: r.balance,
      "Days Overdue": r.daysOverdue > 0 ? r.daysOverdue : 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bill Wise Pending");
    XLSX.writeFile(wb, `Bill_Wise_Pending_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    const headers = [
      "Bill No",
      "Bill Date",
      "Due Date",
      "Party Name",
      "Original Amount",
      "Paid Amount",
      "Balance",
      "Days Overdue",
    ];
    const rows = billRows.map((r) => [
      r.invoiceNo,
      r.invoiceDate,
      r.dueDate,
      r.partyName,
      r.originalAmount.toString(),
      r.paidAmount.toString(),
      r.balance.toString(),
      (r.daysOverdue > 0 ? r.daysOverdue : 0).toString(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bill_Wise_Pending_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (days: number) => {
    if (days <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
          Not Due
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">
          1-30 Days
        </span>
      );
    }
    if (days <= 60) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800">
          31-60 Days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
        &gt;60 Days Overdue
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <ActionToolbar title="Bill-wise Pending" subtitle="Outstanding bills by party" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Bill-Wise Outstanding Report
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track pending bills with interactive allocation drill-downs and configurable slabs.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Party Type"
            options={[
              { value: "all", label: "All" },
              { value: "customer", label: "Customers (Sales)" },
              { value: "supplier", label: "Suppliers (Purchase)" },
            ]}
            value={partyType}
            onChange={(v) => {
              setPartyType(v as any);
              setSelectedPartyId("");
            }}
          />

          <Select
            label="Party"
            options={[{ value: "", label: "All Parties" }, ...partyOptions]}
            value={selectedPartyId}
            onChange={setSelectedPartyId}
            searchable
          />

          <NepaliDatePicker label="From Date" value={fromDate} onChange={setFromDate} />

          <NepaliDatePicker label="To Date" value={toDate} onChange={setToDate} />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="col-span-3">
            <Input
              label="Search"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by bill number or party name..."
            />
          </div>
          <div>
            <button
              onClick={() => {
                setTempSlabs([...slabs]);
                setIsEditingSlabs(true);
              }}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold pb-2"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Aging Slabs
            </button>
          </div>
        </div>
      </Card>

      {/* Slab Editing Configuration */}
      {isEditingSlabs && (
        <Card border padding="md" className="no-print bg-slate-50 border-blue-200">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">Configure Slabs</h3>
          <div className="space-y-2">
            {tempSlabs.map((slab, idx) => (
              <div key={idx} className="flex gap-2 items-center text-xs">
                <input
                  type="text"
                  placeholder="Label"
                  value={slab.label}
                  onChange={(e) => {
                    const copy = [...tempSlabs];
                    copy[idx].label = e.target.value;
                    setTempSlabs(copy);
                  }}
                  className="input flex-1"
                />
                <input
                  type="number"
                  placeholder="From"
                  value={slab.from}
                  onChange={(e) => {
                    const copy = [...tempSlabs];
                    copy[idx].from = parseInt(e.target.value, 10) || 0;
                    setTempSlabs(copy);
                  }}
                  className="input w-24"
                />
                <input
                  type="number"
                  placeholder="To"
                  value={slab.to === null ? "" : slab.to}
                  onChange={(e) => {
                    const copy = [...tempSlabs];
                    copy[idx].to = e.target.value === "" ? null : parseInt(e.target.value, 10);
                    setTempSlabs(copy);
                  }}
                  className="input w-24"
                />
                <button
                  type="button"
                  onClick={() => setTempSlabs(tempSlabs.filter((_, i) => i !== idx))}
                  className="p-1 text-red-500 hover:bg-red-55 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <Button
                onClick={() => setTempSlabs([...tempSlabs, { from: 0, to: null, label: "New Slab" }])}
                variant="outline"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Slab
              </Button>
              <div className="flex gap-1.5">
                <Button onClick={handleSaveSlabs} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Save Slabs
                </Button>
                <Button onClick={() => setIsEditingSlabs(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      {billRows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card border padding="md" className="bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Total Bills
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.totalBills}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </Card>

          {summary.slabBalances.slice(0, 3).map((sb, idx) => (
            <Card key={idx} border padding="md" className="bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {sb.label}
                  </p>
                  <p className="text-2xl font-bold mt-1 font-mono" style={{ color: COLORS[idx % COLORS.length] }}>
                    {symbol} {formatNumber(sb.balance)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Toolbar */}
      {billRows.length > 0 && (
        <ReportToolbar onExportExcel={handleExportExcel} onExportCSV={handleExportCSV} />
      )}

      {/* Table */}
      {billRows.length === 0 ? (
        <ReportEmptyState
          message="No outstanding bills found for the selected filters"
          icon={<FileText className="w-16 h-16" />}
        />
      ) : (
        <Card border padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Bill No
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Bill Date
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Due Date
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Party Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                    Original
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                    Paid
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">
                    Balance
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">
                    Days Overdue
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                {billRows.map((row) => (
                  <React.Fragment key={row.invoiceId}>
                    <tr
                      onClick={() => setExpandedInvoiceId(expandedInvoiceId === row.invoiceId ? null : row.invoiceId)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 flex items-center gap-1">
                        {expandedInvoiceId === row.invoiceId ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                        {row.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {row.invoiceDate}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.dueDate}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{row.partyName}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        {symbol} {formatNumber(row.originalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400">
                        {symbol} {formatNumber(row.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                        {symbol} {formatNumber(row.balance)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold font-mono">
                        {row.daysOverdue > 0 ? (
                          <span className="text-red-600">{row.daysOverdue}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(row.daysOverdue)}</td>
                    </tr>
                    
                    {expandedInvoiceId === row.invoiceId && (
                      <InvoiceAllocationSubtable invoiceId={row.invoiceId} />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                    TOTAL ({summary.totalBills} Bills)
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    {symbol} {formatNumber(summary.totalOriginal)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    {symbol} {formatNumber(summary.totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                    {symbol} {formatNumber(summary.totalBalance)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Aging Summary */}
      {billRows.length > 0 && (
        <Card border padding="md">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
            Aging Analysis Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total Outstanding
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                {symbol} {formatNumber(summary.totalBalance)}
              </span>
            </div>
            {summary.slabBalances.map((sb, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  {sb.label}
                </span>
                <span className="text-lg font-bold font-mono" style={{ color: COLORS[idx % COLORS.length] }}>
                  {symbol} {formatNumber(sb.balance)}
                </span>
                <span className="text-xs text-gray-500 mt-0.5">
                  {summary.totalBalance > 0
                    ? ((sb.balance / summary.totalBalance) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {billRows.length > 0 && (
        <ReportFooter
          generatedAt={new Date().toLocaleString()}
          note="This report shows all outstanding bills with their aging status. Click on a bill number to view allocations."
        />
      )}
    </div>
  );
};

export default BillWisePending;
