// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const ExceptionReports: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("exception-reports");

  const { vouchers, accounts, stockMovements, items, warehouses, companySettings } = useStore();
  const [activeTab, setActiveTab] = useState("negative-stock");
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pendingAsOnDate, setPendingAsOnDate] = useState(asOnDate);

  const applyOptions = () => {
    setAsOnDate(pendingAsOnDate);
    setOptionsOpen(false);
  };

  // Helper function to calculate days between dates
  const daysBetween = (dateString1: string, dateString2: string): number => {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  };

  // Compute exception data
  const exceptionData = useMemo(() => {
    if (!vouchers || !accounts || !stockMovements || !items)
      return {
        negativeStock: [],
        negativeLedger: [],
        overdueReceivables: [],
        overduePayables: [],
        postDated: [],
        cancelled: [],
      };

    // Negative Stock
    const negativeStock = [];
    const itemMap = new Map();

    // Initialize items with opening stock
    items.forEach((item) => {
      itemMap.set(item.id, {
        id: item.id,
        name: item.name,
        unit: item.unit || "N/A",
        qty: item.openingQty || 0,
        warehouse: "Opening Stock",
      });
    });

    // Process movements
    stockMovements.forEach((m) => {
      const itemData = itemMap.get(m.itemId);
      if (itemData) {
        if (m.type === "in") {
          itemData.qty += m.qty || 0;
        } else if (m.type === "out") {
          itemData.qty -= m.qty || 0;
        }

        const warehouse =
          warehouses?.find((w) => w.id === m.warehouseId)?.name || m.warehouseId || "Unknown";
        itemData.warehouse = warehouse;
      }
    });

    // Filter for negative stock
    itemMap.forEach((data) => {
      if (data.qty < 0) {
        negativeStock.push({
          id: data.id,
          itemName: data.name,
          unit: data.unit,
          closingQty: data.qty,
          warehouse: data.warehouse,
          action: "Review",
        });
      }
    });

    // Negative Ledgers
    const negativeLedger = [];
    const ledgerTotals = new Map();

    // Initialize with opening balances
    accounts.forEach((acc) => {
      if (!acc.isGroup) {
        ledgerTotals.set(acc.id, {
          account: acc,
          balance: (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0),
          expectedSide: acc.type === "asset" || acc.type === "expense" ? "Dr" : "Cr",
        });
      }
    });

    // Process vouchers to calculate closing balances
    vouchers.forEach((v) => {
      v.lines.forEach((line) => {
        const total = ledgerTotals.get(line.accountId);
        if (total) {
          total.balance += (line.debit || 0) - (line.credit || 0);
        }
      });
    });

    // Check for negative balances
    ledgerTotals.forEach((total, id) => {
      const acc = total.account;
      const balance = total.balance;

      // Asset with credit balance (negative)
      if (acc.type === "asset" && balance < 0) {
        negativeLedger.push({
          id: acc.id,
          ledgerName: acc.name,
          group: acc.parentId ? accounts.find((a) => a.id === acc.parentId)?.name : "—",
          balance: balance,
          expectedSide: "Dr",
          issue: "Asset showing credit balance",
        });
      }
      // Liability with debit balance (negative)
      else if (acc.type === "liability" && balance > 0) {
        negativeLedger.push({
          id: acc.id,
          ledgerName: acc.name,
          group: acc.parentId ? accounts.find((a) => a.id === acc.parentId)?.name : "—",
          balance: balance,
          expectedSide: "Cr",
          issue: "Liability showing debit balance",
        });
      }
      // Cash with negative balance
      else if (acc.name.toLowerCase().includes("cash") && balance < 0) {
        negativeLedger.push({
          id: acc.id,
          ledgerName: acc.name,
          group: acc.parentId ? accounts.find((a) => a.id === acc.parentId)?.name : "—",
          balance: balance,
          expectedSide: "Dr",
          issue: "Negative Cash",
        });
      }
    });

    // Overdue Receivables
    const overdueReceivables = [];
    const today = new Date(asOnDate);
    const todayStr = today.toISOString().split("T")[0];

    vouchers.forEach((v) => {
      if (v.type === "sales-invoice" && v.status !== "paid" && v.status !== "cancelled") {
        if (v.dueDate && new Date(v.dueDate) < today) {
          const overdueDays = daysBetween(v.dueDate, todayStr);
          let severity = "LOW";
          if (overdueDays > 90) severity = "CRITICAL";
          else if (overdueDays > 60) severity = "HIGH";
          else if (overdueDays > 30) severity = "MEDIUM";

          overdueReceivables.push({
            id: v.id,
            party: v.partyName || "Unknown",
            invoiceNo: v.voucherNo || v.id,
            dueDate: v.dueDate,
            overdueDays,
            pendingAmount: v.totalDebit || v.grandTotal || 0,
            severity,
          });
        }
      }
    });

    // Sort by overdue days descending
    overdueReceivables.sort((a, b) => b.overdueDays - a.overdueDays);

    // Overdue Payables
    const overduePayables = [];
    vouchers.forEach((v) => {
      if (v.type === "purchase-invoice" && v.status !== "paid" && v.status !== "cancelled") {
        if (v.dueDate && new Date(v.dueDate) < today) {
          const overdueDays = daysBetween(v.dueDate, todayStr);
          let severity = "LOW";
          if (overdueDays > 90) severity = "CRITICAL";
          else if (overdueDays > 60) severity = "HIGH";
          else if (overdueDays > 30) severity = "MEDIUM";

          overduePayables.push({
            id: v.id,
            party: v.partyName || "Unknown",
            invoiceNo: v.voucherNo || v.id,
            dueDate: v.dueDate,
            overdueDays,
            pendingAmount: v.totalDebit || v.grandTotal || 0,
            severity,
          });
        }
      }
    });

    // Sort by overdue days descending
    overduePayables.sort((a, b) => b.overdueDays - a.overdueDays);

    // Post Dated Vouchers
    const postDated = [];
    vouchers.forEach((v) => {
      if (v.status === "cancelled") return; // exclude cancelled

      const voucherDate = new Date(v.date);
      if (voucherDate > today || v.isPostDated) {
        const daysUntilDue = daysBetween(todayStr, v.date);
        postDated.push({
          id: v.id,
          date: v.date,
          voucherType: v.type,
          voucherNo: v.voucherNo || v.id,
          partyOrLedger: v.partyName || "Unknown",
          amount: v.totalDebit || v.totalCredit || 0,
          daysUntilDue,
          action: "Activate",
        });
      }
    });

    // Sort by date ascending
    postDated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Cancelled Vouchers
    const cancelled = [];
    vouchers.forEach((v) => {
      if (v.status === "cancelled") {
        cancelled.push({
          id: v.id,
          date: v.date,
          voucherType: v.type,
          voucherNo: v.voucherNo || v.id,
          originalAmount: v.totalDebit || v.totalCredit || 0,
          cancelledBy: v.cancelledBy || "—",
          cancelReason: v.cancellationReason || "—",
          cancelledAt: v.modifiedAt || "—",
        });
      }
    });

    return {
      negativeStock,
      negativeLedger,
      overdueReceivables,
      overduePayables,
      postDated,
      cancelled,
    };
  }, [vouchers, accounts, stockMovements, items, warehouses, asOnDate]);

  // Compute summary counts
  const summaryCounts = useMemo(() => {
    return {
      totalIssues:
        exceptionData.negativeStock.length +
        exceptionData.negativeLedger.length +
        exceptionData.overdueReceivables.length +
        exceptionData.overduePayables.length +
        exceptionData.postDated.length,
      negativeStock: exceptionData.negativeStock.length,
      overdueGT60:
        exceptionData.overdueReceivables.filter((r) => r.overdueDays > 60).length +
        exceptionData.overduePayables.filter((r) => r.overdueDays > 60).length,
      postDated: exceptionData.postDated.length,
    };
  }, [exceptionData]);

  // Define tabs
  const tabs = [
    { id: "negative-stock", label: "Negative Stock" },
    { id: "negative-ledger", label: "Negative Ledgers" },
    { id: "overdue-receivables", label: "Overdue Receivables" },
    { id: "overdue-payables", label: "Overdue Payables" },
    { id: "post-dated", label: "Post-Dated" },
    { id: "cancelled", label: "Cancelled" },
  ];

  // Get active tab data
  const activeData = exceptionData[activeTab.replace("-", "")] || [];

  // Define columns for each tab
  const getColumns = () => {
    switch (activeTab) {
      case "negative-stock":
        return [
          { key: "itemName", label: "Item Name" },
          { key: "unit", label: "Unit" },
          { key: "closingQty", label: "Closing Qty", align: "right" },
          { key: "warehouse", label: "Warehouse" },
          { key: "action", label: "Action", align: "center" },
        ];
      case "negative-ledger":
        return [
          { key: "ledgerName", label: "Ledger Name" },
          { key: "group", label: "Group" },
          { key: "balance", label: "Balance", align: "right" },
          { key: "expectedSide", label: "Expected Side", align: "center" },
          { key: "issue", label: "Issue" },
        ];
      case "overdue-receivables":
      case "overdue-payables":
        return [
          { key: "party", label: "Party" },
          { key: "invoiceNo", label: "Invoice No" },
          { key: "dueDate", label: "Due Date" },
          { key: "overdueDays", label: "Overdue Days", align: "right" },
          { key: "pendingAmount", label: "Pending Amount", align: "right" },
          { key: "severity", label: "Severity" },
        ];
      case "post-dated":
        return [
          { key: "date", label: "Date" },
          { key: "voucherType", label: "Voucher Type" },
          { key: "voucherNo", label: "Voucher No" },
          { key: "partyOrLedger", label: "Party/Ledger" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "daysUntilDue", label: "Days Until Due", align: "right" },
          { key: "action", label: "Action", align: "center" },
        ];
      case "cancelled":
        return [
          { key: "date", label: "Date" },
          { key: "voucherType", label: "Voucher Type" },
          { key: "voucherNo", label: "Voucher No" },
          { key: "originalAmount", label: "Original Amount", align: "right" },
          { key: "cancelledBy", label: "Cancelled By" },
          { key: "cancelReason", label: "Cancel Reason" },
          { key: "cancelledAt", label: "Cancelled At" },
        ];
      default:
        return [];
    }
  };

  const renderCell = (columnKey: string, value: any, row: any) => {
    // Number formatting
    if (
      [
        "closingQty",
        "balance",
        "pendingAmount",
        "amount",
        "originalAmount",
        "overdueDays",
        "daysUntilDue",
      ].includes(columnKey)
    ) {
      let colorClass = "text-gray-700";

      if (columnKey === "closingQty" || columnKey === "balance") {
        colorClass = "text-red-600 font-bold";
      } else if (columnKey === "overdueDays") {
        colorClass =
          value > 60
            ? "text-red-600 font-bold"
            : value > 30
              ? "text-amber-600 font-semibold"
              : "text-gray-700 font-medium";
      }

      return <span className={`font-mono ${colorClass}`}>{formatNumber(value)}</span>;
    }

    // Status badges
    if (columnKey === "severity") {
      let badgeClass = "bg-gray-100 text-gray-700";
      if (value === "CRITICAL") badgeClass = "bg-red-100 text-red-700 border border-red-200";
      else if (value === "HIGH")
        badgeClass = "bg-orange-100 text-orange-800 border border-orange-200";
      else if (value === "MEDIUM")
        badgeClass = "bg-amber-100 text-amber-700 border border-amber-200";
      else if (value === "LOW") badgeClass = "bg-blue-100 text-blue-700 border border-blue-200";

      return (
        <span
          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${badgeClass}`}
        >
          {value}
        </span>
      );
    }

    if (columnKey === "expectedSide") {
      return <span className="font-mono text-gray-600 font-medium">{value}</span>;
    }

    if (columnKey === "action") {
      return (
        <button className="text-[11px] font-medium text-[#1557b0] hover:text-[#0f4a96] hover:underline">
          {value}
        </button>
      );
    }

    return value;
  };

  // Get row class for each tab
  const getRowClassName = (row: any) => {
    if (activeTab === "negative-stock" || activeTab === "negative-ledger") {
      return "bg-red-50 hover:bg-red-100";
    }
    if (activeTab === "cancelled") {
      return "bg-gray-50 opacity-75 hover:opacity-100";
    }
    return "";
  };

  return (
    <ReportShell
      title="Exception Reports"
      subtitle="Anomalies and issues requiring attention"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`As on ${asOnDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingAsOnDate(asOnDate);
        setOptionsOpen(true);
      }}
      actionBarButtons={[{ label: "Print Active Tab" }, { label: "Export" }]}
      toolbarLeft={
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            As On:
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>
        </div>
      }
    >
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 tracking-wide">
            Total Issues
          </span>
          <span
            className={`text-2xl font-bold mt-1 ${summaryCounts.totalIssues > 0 ? "text-red-600" : "text-gray-900"}`}
          >
            {summaryCounts.totalIssues}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 tracking-wide">
            Negative Stock
          </span>
          <span
            className={`text-2xl font-bold mt-1 ${summaryCounts.negativeStock > 0 ? "text-red-600" : "text-gray-900"}`}
          >
            {summaryCounts.negativeStock}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 tracking-wide">
            Overdue &gt; 60 days
          </span>
          <span
            className={`text-2xl font-bold mt-1 ${summaryCounts.overdueGT60 > 0 ? "text-amber-600" : "text-gray-900"}`}
          >
            {summaryCounts.overdueGT60}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 tracking-wide">
            Post-Dated
          </span>
          <span className="text-2xl font-bold mt-1 text-[#1557b0]">{summaryCounts.postDated}</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-6 border-b border-gray-200 mb-6 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => {
          const count = exceptionData[tab.id.replace("-", "")]?.length || 0;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap flex items-center ${
                isActive
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    isActive ? "bg-[#1557b0] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {activeData.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-500 border border-gray-200 rounded-md bg-gray-50">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-[13px] font-medium text-gray-700">
            {activeTab === "negative-stock" && "No negative stock found."}
            {activeTab === "negative-ledger" && "No negative ledger balances found."}
            {activeTab === "overdue-receivables" && "No overdue receivables found."}
            {activeTab === "overdue-payables" && "No overdue payables found."}
            {activeTab === "post-dated" && "No post-dated vouchers found."}
            {activeTab === "cancelled" && "No cancelled vouchers found."}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {activeTab === "negative-stock" && "All inventory balances are healthy."}
            {activeTab === "negative-ledger" && "All accounts are in proper state."}
            {activeTab === "overdue-receivables" && "All customer payments are current."}
            {activeTab === "overdue-payables" && "All supplier payments are current."}
            {activeTab === "post-dated" && "All vouchers are current dated."}
            {activeTab === "cancelled" && "All vouchers are active."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
          <ReportGrid
            columns={getColumns()}
            data={activeData}
            getRowClassName={getRowClassName}
            renderCell={renderCell}
          />
        </div>
      )}

      <ReportOptionsModal
        open={optionsOpen}
        title="Exception Reports Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            As On Date
            <input
              type="date"
              value={pendingAsOnDate}
              onChange={(e) => setPendingAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default ExceptionReports;
