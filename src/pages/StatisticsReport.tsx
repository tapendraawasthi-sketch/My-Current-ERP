// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";
import { useBranchFilter } from "../hooks/useBranchFilter";

const StatisticsReport: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("statistics-report");

  const {
    vouchers,
    accounts,
    items,
    parties,
    costCenters,
    employees,
    warehouses,
    companySettings,
    currentFiscalYear,
  } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");

  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingBranchFilter, setPendingBranchFilter] = useState(branchFilter);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setBranchFilter(pendingBranchFilter);
    setOptionsOpen(false);
  };

  // Compute statistics data
  const statsData = useMemo(() => {
    if (!vouchers)
      return {
        voucherStats: [],
        masterStats: [],
        transactionSummary: { posted: 0, draft: 0, cancelled: 0, totalAmount: 0 },
      };

    // Voucher statistics
    const voucherCounts: Record<string, { count: number; amount: number }> = {
      "sales-invoice": { count: 0, amount: 0 },
      "purchase-invoice": { count: 0, amount: 0 },
      receipt: { count: 0, amount: 0 },
      payment: { count: 0, amount: 0 },
      journal: { count: 0, amount: 0 },
      "journal-voucher": { count: 0, amount: 0 },
      contra: { count: 0, amount: 0 },
      "credit-note": { count: 0, amount: 0 },
      "debit-note": { count: 0, amount: 0 },
      "sales-return": { count: 0, amount: 0 },
      "purchase-return": { count: 0, amount: 0 },
      "stock-journal": { count: 0, amount: 0 },
    };

    const filteredVouchers = (vouchers || []).filter(
      (v) => v.date >= startDate && v.date <= endDate && matchBranch(v.branchId),
    );

    filteredVouchers.forEach((v) => {
      if (voucherCounts[v.type]) {
        voucherCounts[v.type].count++;
        voucherCounts[v.type].amount += v.totalDebit || v.totalCredit || 0;
      }
      // Combine journal and journal-voucher
      if (v.type === "journal-voucher") {
        voucherCounts["journal"].count++;
        voucherCounts["journal"].amount += v.totalDebit || v.totalCredit || 0;
      }
    });

    // Build voucher stats array
    const voucherStats = [
      {
        type: "Sales Invoices",
        key: "sales-invoice",
        count: voucherCounts["sales-invoice"].count,
        amount: voucherCounts["sales-invoice"].amount,
      },
      {
        type: "Purchase Bills",
        key: "purchase-invoice",
        count: voucherCounts["purchase-invoice"].count,
        amount: voucherCounts["purchase-invoice"].amount,
      },
      {
        type: "Receipt Vouchers",
        key: "receipt",
        count: voucherCounts["receipt"].count,
        amount: voucherCounts["receipt"].amount,
      },
      {
        type: "Payment Vouchers",
        key: "payment",
        count: voucherCounts["payment"].count,
        amount: voucherCounts["payment"].amount,
      },
      {
        type: "Journal Vouchers",
        key: "journal",
        count: voucherCounts["journal"].count,
        amount: voucherCounts["journal"].amount,
      },
      {
        type: "Contra Vouchers",
        key: "contra",
        count: voucherCounts["contra"].count,
        amount: voucherCounts["contra"].amount,
      },
      {
        type: "Credit Notes",
        key: "credit-note",
        count: voucherCounts["credit-note"].count,
        amount: voucherCounts["credit-note"].amount,
      },
      {
        type: "Debit Notes",
        key: "debit-note",
        count: voucherCounts["debit-note"].count,
        amount: voucherCounts["debit-note"].amount,
      },
      {
        type: "Sales Returns",
        key: "sales-return",
        count: voucherCounts["sales-return"].count,
        amount: voucherCounts["sales-return"].amount,
      },
      {
        type: "Purchase Returns",
        key: "purchase-return",
        count: voucherCounts["purchase-return"].count,
        amount: voucherCounts["purchase-return"].amount,
      },
      {
        type: "Stock Journals",
        key: "stock-journal",
        count: voucherCounts["stock-journal"].count,
        amount: voucherCounts["stock-journal"].amount,
      },
    ];

    // Filter out zero-count rows for cleaner display
    const activeStats = voucherStats.filter((s) => s.count > 0);

    // Add total row
    const totalCount = activeStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalAmount = activeStats.reduce((sum, stat) => sum + stat.amount, 0);

    if (activeStats.length > 0) {
      activeStats.push({
        type: "TOTAL",
        key: "total",
        count: totalCount,
        amount: totalAmount,
        isTotal: true,
      });
    }

    // Master statistics
    const masterStats = [
      {
        label: "Total Ledger Accounts",
        count: (accounts || []).filter((a) => !a.isGroup && a.isActive !== false).length,
      },
      { label: "Total Account Groups", count: (accounts || []).filter((a) => a.isGroup).length },
      { label: "Total Stock Items", count: (items || []).length },
      { label: "Total Parties", count: (parties || []).length },
      { label: "Total Cost Centres", count: (costCenters || []).length },
      { label: "Total Employees", count: (employees || []).length },
      { label: "Total Warehouses", count: (warehouses || []).length },
    ];

    // Transaction summary
    const transactionSummary = {
      posted: filteredVouchers.filter((v) => v.status === "posted").length,
      draft: filteredVouchers.filter((v) => v.status === "draft").length,
      cancelled: filteredVouchers.filter((v) => v.status === "cancelled").length,
      totalAmount: filteredVouchers
        .filter((v) => v.status === "posted")
        .reduce((sum, v) => sum + (v.totalDebit || v.totalCredit || 0), 0),
    };

    return {
      voucherStats: activeStats,
      masterStats,
      transactionSummary,
    };
  }, [vouchers, accounts, items, parties, costCenters, employees, warehouses, startDate, endDate, matchBranch, branchFilter]);

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "type") {
        return <span className="font-bold text-gray-800">{value}</span>;
      }
      if (columnKey === "count" || columnKey === "amount") {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (columnKey === "count") {
      return <span className="font-mono text-gray-600">{value}</span>;
    }

    if (columnKey === "amount") {
      return <span className="font-mono text-[var(--ds-action-primary)]">{formatNumber(value)}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Statistics Report"
      subtitle="Operational summary and counts"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingBranchFilter(branchFilter);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print" }, { label: "Refresh" }]}
      toolbarLeft={
        <div className="flex items-center gap-1.5">
          {branchOptions.length > 0 && (
            <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
              Branch:
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 ml-2">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>
        </div>
      }
    >
      <div className="flex flex-col gap-8 pb-8">
        {/* Masters Summary */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Masters Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {statsData.masterStats.map((stat, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-md p-3 flex flex-col justify-center text-center"
              >
                <span className="text-[14px] font-mono font-semibold text-[var(--ds-action-primary)] mb-1">
                  {stat.count}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Transaction Status Summary */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Transaction Status Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 flex flex-col">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Posted Vouchers
              </div>
              <div className="text-[24px] font-mono font-bold text-[#059669]">
                {formatNumber(statsData.transactionSummary.posted)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 flex flex-col">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Draft Vouchers
              </div>
              <div className="text-[24px] font-mono font-bold text-[#d97706]">
                {formatNumber(statsData.transactionSummary.draft)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5 flex flex-col">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Cancelled Vouchers
              </div>
              <div className="text-[24px] font-mono font-bold text-[#dc2626]">
                {formatNumber(statsData.transactionSummary.cancelled)}
              </div>
            </div>
          </div>
        </section>

        {/* Voucher-wise Statistics */}
        <section>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Voucher-wise Statistics
          </h3>
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden w-full lg:w-2/3">
            <ReportGrid
              columns={[
                { key: "type", label: "Voucher Type" },
                { key: "count", label: "Count", align: "right" },
                { key: "amount", label: "Net Amount (Rs.)", align: "right" },
              ]}
              data={statsData.voucherStats}
              getRowClassName={(row) =>
                row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""
              }
              renderCell={renderCell}
            />
          </div>
        </section>
      </div>

      <ReportOptionsModal
        open={optionsOpen}
        title="Statistics Report Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            />
          </label>

          {branchOptions.length > 0 && (
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
              Branch
              <select
                value={pendingBranchFilter}
                onChange={(e) => setPendingBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default StatisticsReport;
