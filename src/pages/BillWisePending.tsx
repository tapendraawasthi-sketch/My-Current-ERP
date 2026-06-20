import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { PartyType, VoucherType, PaymentStatus, VoucherStatus } from "../lib/types";
import { FileText, Download, FileSpreadsheet, Calendar, AlertCircle } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { Card, Select, Button, Input } from "../components/ui";
import { NepaliDatePicker } from "../components/ui";
import { ReportHeader } from "../components/reports/ReportHeader";
import { ReportToolbar } from "../components/reports/ReportToolbar";
import { ReportFooter } from "../components/reports/ReportFooter";
import { ReportEmptyState } from "../components/ReportEmptyState";
import * as XLSX from "xlsx";

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
  overdueStatus: "current" | "overdue-light" | "overdue-medium" | "overdue-critical";
}

const BillWisePending: React.FC = () => {
  const { invoices, parties, companySettings, getBillAllocationsForInvoice } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [partyType, setPartyType] = useState<"customer" | "supplier" | "all">("all");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  // Get overdue status based on days overdue
  const getOverdueStatus = (daysOverdue: number): BillRow["overdueStatus"] => {
    if (daysOverdue <= 0) return "current";
    if (daysOverdue <= 30) return "overdue-light";
    if (daysOverdue <= 60) return "overdue-medium";
    return "overdue-critical";
  };

  // Generate bill rows
  const billRows = useMemo((): BillRow[] => {
    const filtered = invoices.filter((inv) => {
      // Filter by invoice type based on party type
      if (partyType === "customer") {
        if (inv.type !== VoucherType.SALES_INVOICE) return false;
      } else if (partyType === "supplier") {
        if (inv.type !== VoucherType.PURCHASE_INVOICE) return false;
      } else {
        if (inv.type !== VoucherType.SALES_INVOICE && inv.type !== VoucherType.PURCHASE_INVOICE)
          return false;
      }

      // Filter by status
      if (inv.status !== VoucherStatus.POSTED) return false;
      if (inv.paymentStatus === PaymentStatus.PAID) return false;

      // Filter by party
      if (selectedPartyId && inv.partyId !== selectedPartyId) return false;

      // Filter by date range
      if (fromDate && inv.date < fromDate) return false;
      if (toDate && inv.date > toDate) return false;

      return true;
    });

    const today = new Date().toISOString().split("T")[0];

    const rows: BillRow[] = filtered.map((inv) => {
      const balance = inv.grandTotal - (inv.paidAmount || 0);
      const dueDate = inv.dueDate || inv.date;
      const daysOverdue = daysBetween(dueDate, today);
      const overdueStatus = getOverdueStatus(daysOverdue);

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
        overdueStatus,
      };
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return rows.filter(
        (r) =>
          r.invoiceNo.toLowerCase().includes(query) || r.partyName.toLowerCase().includes(query),
      );
    }

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, partyType, selectedPartyId, fromDate, toDate, searchQuery]);

  // Calculate summary totals
  const summary = useMemo(() => {
    const totalBills = billRows.length;
    const totalOriginal = billRows.reduce((sum, r) => sum + r.originalAmount, 0);
    const totalPaid = billRows.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalBalance = billRows.reduce((sum, r) => sum + r.balance, 0);

    const current = billRows
      .filter((r) => r.overdueStatus === "current")
      .reduce((sum, r) => sum + r.balance, 0);
    const overdue30 = billRows
      .filter((r) => r.overdueStatus === "overdue-light")
      .reduce((sum, r) => sum + r.balance, 0);
    const overdue60 = billRows
      .filter((r) => r.overdueStatus === "overdue-medium")
      .reduce((sum, r) => sum + r.balance, 0);
    const overdue90Plus = billRows
      .filter((r) => r.overdueStatus === "overdue-critical")
      .reduce((sum, r) => sum + r.balance, 0);

    return {
      totalBills,
      totalOriginal,
      totalPaid,
      totalBalance,
      current,
      overdue30,
      overdue60,
      overdue90Plus,
    };
  }, [billRows]);

  // Export to Excel
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
      Status:
        r.overdueStatus === "current"
          ? "Current"
          : r.overdueStatus === "overdue-light"
            ? "1-30 Days"
            : r.overdueStatus === "overdue-medium"
              ? "31-60 Days"
              : "60+ Days",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bill Wise Pending");
    XLSX.writeFile(wb, `Bill_Wise_Pending_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Export to CSV
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
      "Status",
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
      r.overdueStatus === "current"
        ? "Current"
        : r.overdueStatus === "overdue-light"
          ? "1-30 Days"
          : r.overdueStatus === "overdue-medium"
            ? "31-60 Days"
            : "60+ Days",
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

  const getStatusBadge = (status: BillRow["overdueStatus"]) => {
    switch (status) {
      case "current":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
            Current
          </span>
        );
      case "overdue-light":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">
            1-30 Days
          </span>
        );
      case "overdue-medium":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800">
            31-60 Days
          </span>
        );
      case "overdue-critical":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
            60+ Days
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <ActionToolbar title="Bill-wise Pending" subtitle="Outstanding bills by party" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Bill-Wise Outstanding Report
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track pending bills with aging analysis
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

        <div className="mt-4">
          <Input
            label="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by bill number or party name..."
          />
        </div>
      </Card>

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

          <Card border padding="md" className="bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Current (Not Due)
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
                  {symbol} {formatNumber(summary.current)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          <Card border padding="md" className="bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">1-30 Days</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">
                  {symbol} {formatNumber(summary.overdue30)}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </Card>

          <Card border padding="md" className="bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">60+ Days</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
                  {symbol} {formatNumber(summary.overdue90Plus)}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </Card>
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
                  <tr key={row.invoiceId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{row.invoiceNo}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {row.invoiceDate}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.dueDate}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{row.partyName}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {symbol} {formatNumber(row.originalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400">
                      {symbol} {formatNumber(row.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                      {symbol} {formatNumber(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      {row.daysOverdue > 0 ? (
                        <span className="text-red-600">{row.daysOverdue}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(row.overdueStatus)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                    TOTAL ({summary.totalBills} Bills)
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                    {symbol} {formatNumber(summary.totalOriginal)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                    {symbol} {formatNumber(summary.totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
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
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {symbol} {formatNumber(summary.totalBalance)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Current
              </span>
              <span className="text-lg font-bold text-green-700">
                {symbol} {formatNumber(summary.current)}
              </span>
              <span className="text-xs text-gray-500 mt-0.5">
                {summary.totalBalance > 0
                  ? ((summary.current / summary.totalBalance) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                1-30 Days
              </span>
              <span className="text-lg font-bold text-yellow-700">
                {symbol} {formatNumber(summary.overdue30)}
              </span>
              <span className="text-xs text-gray-500 mt-0.5">
                {summary.totalBalance > 0
                  ? ((summary.overdue30 / summary.totalBalance) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                31-60 Days
              </span>
              <span className="text-lg font-bold text-orange-700">
                {symbol} {formatNumber(summary.overdue60)}
              </span>
              <span className="text-xs text-gray-500 mt-0.5">
                {summary.totalBalance > 0
                  ? ((summary.overdue60 / summary.totalBalance) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                60+ Days
              </span>
              <span className="text-lg font-bold text-red-700">
                {symbol} {formatNumber(summary.overdue90Plus)}
              </span>
              <span className="text-xs text-gray-500 mt-0.5">
                {summary.totalBalance > 0
                  ? ((summary.overdue90Plus / summary.totalBalance) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </Card>
      )}

      {billRows.length > 0 && (
        <ReportFooter
          generatedAt={new Date().toLocaleString()}
          note="This report shows all outstanding bills with their aging status. Bills are colored based on overdue days."
        />
      )}
    </div>
  );
};

export default BillWisePending;
