// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber, dateToAD } from "../lib/utils";
import { formatADToBS } from "../lib/nepaliDate";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import {
  Bell,
  AlertTriangle,
  Clock,
  TrendingDown,
  CheckCircle,
  XCircle,
  Package,
  RefreshCw,
} from "lucide-react";
import { getDB } from "../lib/db";

const Dashboard: React.FC = () => {
  const isDbReady = useStore((state) => state.isDbReady);
  const accounts = useStore((state) => state.accounts);
  const vouchers = useStore((state) => state.vouchers);
  const invoices = useStore((state) => state.invoices);
  const items = useStore((state) => state.items);
  const parties = useStore((state) => state.parties);
  const warehouses = useStore((state) => state.warehouses);
  const fiscalYears = useStore((state) => state.fiscalYears);
  const companySettings = useStore((state) => state.companySettings);
  const stockMovements = useStore((state) => state.stockMovements);
  const setCurrentPage = useStore((state) => state.setCurrentPage);

  // Existing dashboard computations
  const today = new Date().toISOString().split("T")[0];
  const currentFiscalYear = fiscalYears.find((fy) => fy.status === "open");

  // Today's vouchers
  const todaysVouchers = useMemo(() => {
    return vouchers.filter((v) => v.date === today && v.status === VoucherStatus.POSTED);
  }, [vouchers, today]);

  // Today's invoices
  const todaysInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.date === today && inv.status === VoucherStatus.POSTED);
  }, [invoices, today]);

  // Today's receipts
  const todaysReceipts = useMemo(() => {
    return vouchers.filter(
      (v) =>
        v.date === today &&
        v.status === VoucherStatus.POSTED &&
        (v.type === "receipt" || v.type === "RECEIPT"),
    );
  }, [vouchers, today]);

  // Today's purchase invoices
  const todaysPurchases = useMemo(() => {
    return invoices.filter(
      (inv) =>
        inv.date === today &&
        inv.status === VoucherStatus.POSTED &&
        (inv.type === "purchase-invoice" || inv.type === "PURCHASE_INVOICE"),
    );
  }, [invoices, today]);

  // Outstanding receivables
  const outstandingReceivables = useMemo(() => {
    return invoices
      .filter(
        (inv) =>
          (inv.type === VoucherType.SALES_INVOICE || inv.type === "sales-invoice") &&
          inv.status === "posted" &&
          (inv.paymentStatus === "unpaid" || inv.paymentStatus === "partial"),
      )
      .reduce((sum, inv) => sum + ((inv.grandTotal || 0) - (inv.paidAmount || 0)), 0);
  }, [invoices]);

  // Cash & Bank balance
  const cashBankBalance = useMemo(() => {
    const cashAccounts = accounts.filter(
      (acc) => acc.type === "cash" || acc.name.toLowerCase().includes("cash"),
    );
    const bankAccounts = accounts.filter(
      (acc) => acc.type === "bank" || acc.name.toLowerCase().includes("bank"),
    );

    const cashBalance = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const bankBalance = bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    return cashBalance + bankBalance;
  }, [accounts]);

  // Stock value
  const stockValue = useMemo(() => {
    return stockMovements.reduce((sum, move) => {
      const qty = Number(move.quantity || move.qty || 0);
      const rate = Number(move.rate || move.costRate || 0);
      const type = String(move.type || move.movementType || "").toLowerCase();
      return type === "in" || type === "purchase" || type === "opening"
        ? sum + qty * rate
        : sum - qty * (move.costRate || move.rate || 0);
    }, 0);
  }, [stockMovements]);

  // VAT liability (simplified)
  const vatLiability = useMemo(() => {
    // Simplified calculation - in reality this would be more complex
    const salesInvoices = invoices.filter(
      (inv) => inv.type === VoucherType.SALES_INVOICE && inv.status === "posted",
    );
    return salesInvoices.reduce((sum, inv) => sum + (inv.vatAmount || 0), 0);
  }, [invoices]);

  // Alerts computation
  const alerts = useMemo(() => {
    const alertList = [];
    const today = new Date().toISOString().split("T")[0];

    // ALERT 1: Overdue receivables (outstanding > 30 days with no payment)
    const overdueInvoices = (invoices || []).filter(
      (inv) =>
        (inv.type === VoucherType.SALES_INVOICE || inv.type === "sales-invoice") &&
        inv.status === "posted" &&
        (inv.paymentStatus === "unpaid" || inv.paymentStatus === "partial") &&
        inv.dueDate &&
        inv.dueDate < today,
    );
    if (overdueInvoices.length > 0) {
      const overdueAmount = overdueInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
      alertList.push({
        id: "overdue-receivables",
        type: "danger",
        icon: "AlertTriangle",
        title: `${overdueInvoices.length} Overdue Invoices`,
        message: `Rs. ${overdueAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })} outstanding beyond due date`,
        action: "VIEW OUTSTANDING",
        actionPage: "outstanding-receivables",
      });
    }

    // ALERT 2: Stock below reorder level
    const reorderAlerts = (items || []).filter((item) => {
      const reorderQty = item.reorderLevel || item.minStockLevel || 0;
      if (reorderQty <= 0) return false;
      const currentStock = (stockMovements || [])
        .filter((m) => m.itemId === item.id)
        .reduce((s, m) => {
          const qty = Number(m.quantity || m.qty || 0);
          const t = String(m.type || m.movementType || "").toLowerCase();
          return t === "in" || t === "purchase" ? s + qty : s - qty;
        }, 0);
      return currentStock <= reorderQty;
    });
    if (reorderAlerts.length > 0) {
      alertList.push({
        id: "reorder-alert",
        type: "warning",
        icon: "Package",
        title: `${reorderAlerts.length} Items Below Reorder Level`,
        message: `${reorderAlerts
          .slice(0, 3)
          .map((i) => i.name)
          .join(", ")}${reorderAlerts.length > 3 ? " and more..." : ""}`,
        action: "VIEW STOCK",
        actionPage: "stock-summary",
      });
    }

    // ALERT 3: PDC cheques due in next 3 days
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split("T")[0];
    const duePDC = (vouchers || []).filter(
      (v) =>
        v.type === "receipt" &&
        v.pdc &&
        v.pdcDate &&
        v.pdcDate <= threeDaysStr &&
        v.pdcDate >= today &&
        v.status === "posted",
    );
    if (duePDC.length > 0) {
      alertList.push({
        id: "pdc-due",
        type: "info",
        icon: "Clock",
        title: `${duePDC.length} PDC Cheques Due for Deposit`,
        message: `Cheques worth Rs. ${duePDC.reduce((s, v) => s + (v.amount || 0), 0).toLocaleString()} due by ${threeDaysStr}`,
        action: "VIEW PDC",
        actionPage: "pdc-summary",
      });
    }

    // ALERT 4: Vouchers pending approval > 24 hours
    const pendingApproval = (vouchers || []).filter((v) => {
      if (v.status !== "pending_approval") return false;
      const createdAt = new Date(v.createdAt || v.date);
      const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      return hoursOld > 24;
    });
    if (pendingApproval.length > 0) {
      alertList.push({
        id: "pending-approval",
        type: "warning",
        icon: "Clock",
        title: `${pendingApproval.length} Vouchers Pending Approval (>24h)`,
        message: "Vouchers are waiting for approval for more than 24 hours",
        action: "APPROVE NOW",
        actionPage: "maker-checker",
      });
    }

    // ALERT 5: Near-expiry batches (load from state if available)
    const nearExpiryBatches = []; // Will be populated from DB if batches are loaded
    // Check batches in useStore if batches array exists
    if (
      typeof (window as any).__erpBatchAlertCount === "number" &&
      (window as any).__erpBatchAlertCount > 0
    ) {
      alertList.push({
        id: "batch-expiry",
        type: "danger",
        icon: "AlertTriangle",
        title: `Batches Expiring Within 30 Days`,
        message: "Review near-expiry stock before losses occur",
        action: "VIEW BATCHES",
        actionPage: "batch-management",
      });
    }

    return alertList;
  }, [invoices, items, stockMovements, vouchers]);

  // Function to handle alert action
  const handleAlertAction = (alert) => {
    setCurrentPage(alert.actionPage);
  };

  // Get today's date in BS for display
  const todayBS = formatADToBS(today);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Dashboard</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Business overview for {todayBS}</p>
        </div>
        <button
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Quick Stats Strip */}
      <div
        style={{
          backgroundColor: "#D4EABD",
          border: "1px solid #000",
          borderTop: "1px solid #000",
          borderBottom: "1px solid #000",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
          fontSize: "12px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span>📋</span>
          <span>Vouchers Today: {todaysVouchers.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span>🧾</span>
          <span>Invoices Today: {todaysInvoices.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span>💰</span>
          <span>
            Collection Today:{" "}
            {formatNumber(todaysReceipts.reduce((sum, v) => sum + (v.grandTotal || 0), 0))}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span>🛒</span>
          <span>
            Purchases Today:{" "}
            {formatNumber(todaysPurchases.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0))}
          </span>
        </div>
      </div>

      {/* Existing Dashboard Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Today's Sales */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Today's Sales</p>
              <p className="text-[18px] font-bold text-gray-800 mt-1">
                {formatNumber(todaysInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0))}
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded-md">
              <TrendingDown className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">{todaysInvoices.length} invoices</p>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Outstanding Receivables</p>
              <p className="text-[18px] font-bold text-gray-800 mt-1">
                {formatNumber(outstandingReceivables)}
              </p>
            </div>
            <div className="bg-blue-100 p-2 rounded-md">
              <TrendingDown className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Pending collection</p>
        </div>

        {/* Cash & Bank Balance */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Cash & Bank</p>
              <p className="text-[18px] font-bold text-gray-800 mt-1">
                {formatNumber(cashBankBalance)}
              </p>
            </div>
            <div className="bg-yellow-100 p-2 rounded-md">
              <TrendingDown className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Liquid assets</p>
        </div>

        {/* VAT Liability */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">VAT Liability</p>
              <p className="text-[18px] font-bold text-gray-800 mt-1">
                {formatNumber(vatLiability)}
              </p>
            </div>
            <div className="bg-red-100 p-2 rounded-md">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Due to IRD</p>
        </div>
      </div>

      {/* Additional Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Stock Position */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Stock Position</p>
              <p className="text-[18px] font-bold text-gray-800 mt-1">{formatNumber(stockValue)}</p>
            </div>
            <div className="bg-purple-100 p-2 rounded-md">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Current inventory value</p>
        </div>

        {/* Active Parties */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-500 font-medium">Active Parties</p>
              <p className="text-[18px] font-bold text-gray-800 mt-1">
                {parties.filter((p) => p.isActive).length}
              </p>
            </div>
            <div className="bg-indigo-100 p-2 rounded-md">
              <TrendingDown className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Customers & suppliers</p>
        </div>
      </div>

      {/* Alerts & Notifications Section */}
      <div style={{ marginTop: "30px" }}>
        <div
          style={{
            backgroundColor: "#D4EABD",
            border: "1px solid #000",
            padding: "10px 15px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "15px",
          }}
        >
          <Bell size={16} style={{ color: "#000000" }} />
          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#000000" }}>
            ⚡ ALERTS & ACTION REQUIRED
          </span>
        </div>

        {alerts.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "15px",
              backgroundColor: "#dcfce7",
              border: "1px solid #059669",
              borderRadius: "4px",
              color: "#059669",
              fontWeight: "bold",
            }}
          >
            <CheckCircle size={16} />
            <span>All clear — no pending alerts</span>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "15px",
            }}
          >
            {alerts.map((alert) => {
              let bgColor, borderColor, iconColor;
              switch (alert.type) {
                case "danger":
                  bgColor = "#fee2e2";
                  borderColor = "#dc2626";
                  iconColor = "#dc2626";
                  break;
                case "warning":
                  bgColor = "#fef9c3";
                  borderColor = "#d97706";
                  iconColor = "#d97706";
                  break;
                case "info":
                  bgColor = "#dbeafe";
                  borderColor = "#1557b0";
                  iconColor = "#1557b0";
                  break;
                default:
                  bgColor = "#f0f0f0";
                  borderColor = "#666";
                  iconColor = "#666";
              }

              let IconComponent;
              switch (alert.icon) {
                case "AlertTriangle":
                  IconComponent = AlertTriangle;
                  break;
                case "Clock":
                  IconComponent = Clock;
                  break;
                case "Package":
                  IconComponent = Package;
                  break;
                case "CheckCircle":
                  IconComponent = CheckCircle;
                  break;
                case "XCircle":
                  IconComponent = XCircle;
                  break;
                default:
                  IconComponent = Bell;
              }

              return (
                <div
                  key={alert.id}
                  style={{
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "6px",
                    padding: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    borderLeft: "4px solid",
                    borderLeftColor: borderColor,
                  }}
                >
                  <div style={{ color: iconColor }}>
                    <IconComponent size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{alert.title}</div>
                    <div style={{ fontSize: "12px", marginBottom: "8px" }}>{alert.message}</div>
                    <button
                      onClick={() => handleAlertAction(alert)}
                      style={{
                        backgroundColor: borderColor,
                        color: "white",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      {alert.action}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
