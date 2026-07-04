// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatNumber, formatCurrency, dateToAD } from "../lib/utils";
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
  ScrollText,
  FileText,
  Receipt,
  Banknote,
  ShoppingBag,
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
      (acc) =>
        !acc.isGroup &&
        acc.isActive &&
        (acc.name.toLowerCase().includes("cash") ||
          acc.group?.toLowerCase().includes("cash") ||
          acc.groupName?.toLowerCase().includes("cash")),
    );
    const bankAccounts = accounts.filter(
      (acc) =>
        !acc.isGroup &&
        acc.isActive &&
        (acc.name.toLowerCase().includes("bank") ||
          acc.group?.toLowerCase().includes("bank") ||
          acc.groupName?.toLowerCase().includes("bank") ||
          (acc as any).bankDetails),
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
    const outputVat = invoices
      .filter(
        (inv) =>
          (inv.type === VoucherType.SALES_INVOICE || inv.type === "sales-invoice") &&
          inv.status === "posted",
      )
      .reduce((sum, inv) => sum + (Number(inv.vatAmount) || 0), 0);

    const inputVat = invoices
      .filter(
        (inv) =>
          (inv.type === VoucherType.PURCHASE_INVOICE || inv.type === "purchase-invoice") &&
          inv.status === "posted",
      )
      .reduce((sum, inv) => sum + (Number(inv.vatAmount) || 0), 0);

    return Math.max(0, outputVat - inputVat);
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
        actionPage: "approval-workflow",
      });
    }

    // ALERT 5: Near-expiry batches (load from state if available)
    const nearExpiryBatches = []; // Will be populated from DB if batches are loaded
    // Check batches in useStore if batches array exists
    // Check batch expiry from items in store
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

    // Note: batches are loaded by the BatchManagement page — check stockMovements for near-expiry
    const nearExpiryCount = (items || []).filter(
      (item: any) =>
        item.expiryDate && item.expiryDate <= thirtyDaysStr && item.expiryDate >= today,
    ).length;

    if (nearExpiryCount > 0) {
      alertList.push({
        id: "batch-expiry",
        type: "danger",
        icon: "AlertTriangle",
        title: `${nearExpiryCount} Items Expiring Within 30 Days`,
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
    <div className="min-h-screen p-6" style={{ background: "#f5f6fa", color: "#1f2937" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "#000000" }}>Dashboard</h1>
          <p style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", marginTop: 2 }}>
            Business overview for {todayBS}
          </p>
        </div>
        <button
          style={{
            height: 30,
            padding: "0 14px",
            background: "#1557b0",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0f4a96")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1557b0")}
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Quick Stats Strip */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          padding: "6px 12px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        {[
          {
            icon: <ScrollText size={12} />,
            label: "VOUCHERS TODAY",
            value: String(todaysVouchers.length),
          },
          {
            icon: <FileText size={12} />,
            label: "INVOICES TODAY",
            value: String(todaysInvoices.length),
          },
          {
            icon: <CheckCircle size={12} />,
            label: "COLLECTION TODAY",
            value: formatCurrency(todaysReceipts.reduce((sum, v) => sum + (v.grandTotal || 0), 0)),
          },
          {
            icon: <Package size={12} />,
            label: "PURCHASES TODAY",
            value: formatCurrency(
              todaysPurchases.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
            ),
          },
        ].map((stat, i, arr) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingRight: i < arr.length - 1 ? 16 : 0,
              borderRight: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.2)" : "none",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                background: "transparent",
                color: "#1557b0",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "rgba(0,0,0,0.5)",
                }}
              >
                {stat.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Today's Sales",
            value: formatCurrency(
              todaysInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
            ),
            meta: `${todaysInvoices.length} invoices`,
            icon: <TrendingDown size={16} />,
          },
          {
            label: "Outstanding Receivables",
            value: formatCurrency(outstandingReceivables),
            meta: "Pending collection",
            icon: <TrendingDown size={16} />,
          },
          {
            label: "Cash & Bank",
            value: formatCurrency(cashBankBalance),
            meta: "Liquid assets",
            icon: <TrendingDown size={16} />,
          },
          {
            label: "VAT Liability",
            value: formatCurrency(vatLiability),
            meta: "Due to IRD",
            icon: <TrendingDown size={16} />,
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(0,0,0,0.55)",
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {card.value}
                </div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: "transparent",
                  color: "#1557b0",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>{card.meta}</div>
          </div>
        ))}
      </div>

      {/* Additional Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          {
            label: "Stock Position",
            value: formatCurrency(stockValue),
            meta: "Current inventory value",
            icon: <Package size={16} />,
          },
          {
            label: "Active Parties",
            value: String(parties.filter((p) => p.isActive).length),
            meta: "Customers & suppliers",
            icon: <TrendingDown size={16} />,
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(0,0,0,0.55)",
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {card.value}
                </div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: "transparent",
                  color: "#1557b0",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.5)" }}>{card.meta}</div>
          </div>
        ))}
      </div>

      {/* Alerts & Notifications Section */}
      <div style={{ marginTop: "30px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingBottom: 6,
            borderBottom: "1px solid #000000",
            marginBottom: 15,
          }}
        >
          <Bell size={13} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Alerts &amp; Action Required
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
              let borderColor, iconColor;
              switch (alert.type) {
                case "danger":
                  borderColor = "#dc2626";
                  iconColor = "#dc2626";
                  break;
                case "warning":
                  borderColor = "#d97706";
                  iconColor = "#d97706";
                  break;
                case "info":
                  borderColor = "#1557b0";
                  iconColor = "#1557b0";
                  break;
                default:
                  borderColor = "#6b7280";
                  iconColor = "#6b7280";
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
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${borderColor}`,
                    borderRadius: "6px",
                    padding: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
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
                        backgroundColor: "transparent",
                        color: borderColor,
                        border: `1px solid ${borderColor}`,
                        padding: "3px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
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
