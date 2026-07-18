// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  NepaliDatePicker,
  Pagination,
  ActionToolbar,
} from "../components/ui";
import { Eye, Edit, Download, Printer, Filter, X, Calendar, FileText } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import {
  VOUCHER_TYPE_LABELS,
  getVoucherStatusColor,
  formatVoucherDisplayDate,
  getVoucherGroupForType,
} from "../lib/voucherUtils";
import { VoucherType } from "../lib/types";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";

const VouchersRegisterFull: React.FC = () => {
  const { vouchers, invoices, companySettings, currentFiscalYear, parties } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);

  const allTransactions = useMemo(() => {
    const voucherRows = (vouchers || [])
      .filter((v) => matchBranch(v.branchId))
      .map((v) => ({
      id: v.id,
      voucherNo: v.voucherNo,
      date: v.date,
      dateNepali: v.dateNepali || ADToBSString(v.date),
      type: v.type,
      typeName: VOUCHER_TYPE_LABELS[v.type] || v.type,
      partyId: v.partyId || "",
      partyName: v.partyName || "",
      amount: v.totalAmount || v.amount || 0,
      debit: v.totalDebit || 0,
      credit: v.totalCredit || 0,
      status: v.status || "posted",
      isOptional: v.isOptional || false,
      narration: v.narration || "",
      group: getVoucherGroupForType(v.type),
      branchId: v.branchId,
    }));

    const invoiceRows = (invoices || [])
      .filter((inv) => matchBranch(inv.branchId))
      .map((inv) => ({
      id: inv.id,
      voucherNo: inv.invoiceNo || inv.voucherNo,
      date: inv.date,
      dateNepali: inv.dateNepali || ADToBSString(inv.date),
      type: inv.type,
      typeName: VOUCHER_TYPE_LABELS[inv.type] || inv.type,
      partyId: inv.partyId || "",
      partyName: inv.partyName || "",
      amount: inv.grandTotal || 0,
      debit: inv.type?.includes("purchase") ? inv.grandTotal || 0 : 0,
      credit: inv.type?.includes("sales") ? inv.grandTotal || 0 : 0,
      status: inv.status || "posted",
      isOptional: false,
      narration: inv.narration || "",
      group: getVoucherGroupForType(inv.type),
      branchId: inv.branchId,
    }));

    return [...voucherRows, ...invoiceRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [vouchers, invoices, matchBranch, branchFilter]);

  const filteredDataBeforePagination = useMemo(() => {
    return allTransactions.filter((transaction) => {
      // Date filter
      if (transaction.date < dateFrom || transaction.date > dateTo) return false;

      // Type filter
      if (voucherTypeFilter !== "all" && transaction.type !== voucherTypeFilter) return false;

      // Group filter
      if (groupFilter !== "all" && transaction.group !== groupFilter) return false;

      // Status filter
      if (statusFilter !== "all" && transaction.status !== statusFilter) return false;

      // Party filter
      if (partyFilter && !transaction.partyName.toLowerCase().includes(partyFilter.toLowerCase()))
        return false;

      // Search text filter
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        if (
          !transaction.voucherNo.toLowerCase().includes(searchLower) &&
          !transaction.narration.toLowerCase().includes(searchLower) &&
          !transaction.partyName.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    allTransactions,
    dateFrom,
    dateTo,
    voucherTypeFilter,
    groupFilter,
    statusFilter,
    partyFilter,
    searchText,
  ]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredDataBeforePagination.slice(startIndex, startIndex + pageSize);
  }, [filteredDataBeforePagination, page, pageSize]);

  const summaryStats = useMemo(() => {
    const totalVouchers = filteredDataBeforePagination.length;
    const totalDebit = filteredDataBeforePagination.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = filteredDataBeforePagination.reduce((sum, t) => sum + t.credit, 0);
    const totalAmount = filteredDataBeforePagination.reduce((sum, t) => sum + t.amount, 0);

    const byType: Record<string, number> = {};
    filteredDataBeforePagination.forEach((t) => {
      byType[t.typeName] = (byType[t.typeName] || 0) + 1;
    });

    return {
      totalVouchers,
      totalDebit,
      totalCredit,
      totalAmount,
      byType,
    };
  }, [filteredDataBeforePagination]);

  const totalPages = Math.ceil(filteredDataBeforePagination.length / pageSize);

  const handleExport = () => {
    const csvContent = [
      ["Date", "Voucher No", "Type", "Party", "Debit", "Credit", "Amount", "Status", "Narration"],
      ...filteredDataBeforePagination.map((r) => [
        r.dateNepali,
        r.voucherNo,
        r.typeName,
        r.partyName,
        r.debit,
        r.credit,
        r.amount,
        r.status,
        r.narration,
      ]),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voucher-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setDateFrom(() => {
      const date = new Date();
      date.setDate(1);
      return date.toISOString().split("T")[0];
    });
    setDateTo(new Date().toISOString().split("T")[0]);
    setVoucherTypeFilter("all");
    setGroupFilter("all");
    setStatusFilter("all");
    setPartyFilter("");
    setSearchText("");
    setBranchFilter("all");
    setPage(1);
  };

  const groupColors: Record<string, string> = {
    accounting: "bg-blue-100 text-blue-700",
    inventory: "bg-green-100 text-green-700",
    order: "bg-orange-100 text-orange-700",
    payroll: "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]",
    other: "bg-gray-100 text-gray-700",
  };

  const voucherTypeOptions = Object.entries(VOUCHER_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Voucher Register</h1>
      </div>

      {/* Date Range and Export */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <NepaliDatePicker value={dateFrom} onChange={setDateFrom} className="w-36" />
          <span className="text-gray-500">to</span>
          <NepaliDatePicker value={dateTo} onChange={setDateTo} className="w-36" />
        </div>

        <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Filter Row */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <Select
            value={voucherTypeFilter}
            onChange={setVoucherTypeFilter}
            options={[{ value: "all", label: "All Types" }, ...voucherTypeOptions]}
            placeholder="Select Type"
          />
          <Select
            value={groupFilter}
            onChange={setGroupFilter}
            options={[
              { value: "all", label: "All Groups" },
              { value: "accounting", label: "Accounting" },
              { value: "inventory", label: "Inventory" },
              { value: "order", label: "Order" },
              { value: "payroll", label: "Payroll" },
              { value: "other", label: "Other" },
            ]}
            placeholder="Select Group"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Status" },
              { value: "posted", label: "Posted" },
              { value: "draft", label: "Draft" },
              { value: "cancelled", label: "Cancelled" },
              { value: "optional", label: "Optional" },
            ]}
            placeholder="Select Status"
          />
          {branchOptions.length > 0 && (
            <Select
              value={branchFilter}
              onChange={setBranchFilter}
              options={[
                { value: "all", label: "All branches" },
                ...branchOptions.map((b) => ({
                  value: b.id,
                  label: b.name || b.code || b.id,
                })),
              ]}
              placeholder="Branch"
            />
          )}
          <Input
            placeholder="Search Party..."
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
          />
          <Input
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
            <X className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Entries</div>
          <div className="text-2xl font-bold">{summaryStats.totalVouchers}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Debit</div>
          <div className="text-2xl font-bold text-green-600">
            Rs. {formatNumber(summaryStats.totalDebit)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Credit</div>
          <div className="text-2xl font-bold text-green-600">
            Rs. {formatNumber(summaryStats.totalCredit)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Net</div>
          <div className="text-2xl font-bold text-blue-600">
            Rs. {formatNumber(summaryStats.totalCredit - summaryStats.totalDebit)}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Voucher No
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Party
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.length > 0 ? (
                paginatedData.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td
                      className="px-4 py-2 whitespace-nowrap text-sm text-gray-500"
                      title={transaction.date}
                    >
                      {transaction.dateNepali}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transaction.voucherNo}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Badge variant="outline" className={groupColors[transaction.group]}>
                        {transaction.typeName}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {transaction.partyName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {transaction.debit > 0 ? formatNumber(transaction.debit) : "-"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {transaction.credit > 0 ? formatNumber(transaction.credit) : "-"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatNumber(transaction.amount)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={getVoucherStatusColor(transaction.status)}
                      >
                        {transaction.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => toast.info("View functionality coming soon")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="text-green-600 hover:text-green-900"
                          onClick={() => toast.info("Print functionality coming soon")}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    No vouchers found for the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
};

export default VouchersRegisterFull;
