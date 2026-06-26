// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import GatewayTile from "./GatewayTile";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { formatADToBS, getBSTodayLong } from "../lib/nepaliDate";
import { formatNumber } from "../lib/utils";
import { computeOutstandingReceivables } from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { isAdminOrOwner, isAccountantOrAdmin } from "../lib/permissions";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";

type GatewayMenuItem = {
  label: string;
  page: string;
  permission?: "all" | "accounting" | "admin";
};

const todayISO = () => new Date().toISOString().split("T")[0];

const safeDateBS = (date?: string) => {
  try {
    if (!date) return "—";
    return formatADToBS(date) || date;
  } catch {
    return date || "—";
  }
};

const money = (n: number) => `रू ${formatNumber(Number(n) || 0)}`;

const sectionHeaderStyle: React.CSSProperties = {
  background: "#D4EABD",
  borderBottom: "1px solid #000",
  padding: "6px 8px",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  color: "#000",
};

const panelStyle: React.CSSProperties = {
  background: "#D4EABD",
  border: "1px solid #000",
  color: "#000",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
};

const menuSections: Record<string, GatewayMenuItem[]> = {
  MASTERS: [
    { label: "Chart of Accounts", page: "accounts", permission: "accounting" },
    { label: "Account Groups", page: "account-groups", permission: "accounting" },
    { label: "Parties Directory", page: "parties", permission: "accounting" },
    { label: "Stock Items", page: "items", permission: "accounting" },
    { label: "Item Groups", page: "item-groups", permission: "accounting" },
    { label: "Warehouses", page: "warehouses", permission: "accounting" },
    { label: "Units of Measure", page: "units", permission: "accounting" },
    { label: "Cost Centers", page: "cost-centers", permission: "accounting" },
    { label: "Bank Accounts", page: "bank-accounts", permission: "accounting" },
    { label: "Employees", page: "employees", permission: "accounting" },
    { label: "Budget Master", page: "budget", permission: "accounting" },
    { label: "Currency Master", page: "currency-master", permission: "accounting" },
    { label: "Standard Narrations", page: "standard-narrations", permission: "accounting" },
    { label: "Tax Categories", page: "tax-categories", permission: "accounting" },
    { label: "Sale Types", page: "sale-types", permission: "accounting" },
    { label: "Purchase Types", page: "purchase-types", permission: "accounting" },
  ],
  TRANSACTIONS: [
    { label: "Day Book", page: "day-book", permission: "accounting" },
    { label: "Sales Invoice", page: "billing", permission: "accounting" },
    { label: "Purchase Invoice", page: "purchase-register", permission: "accounting" },
    { label: "Sales Return", page: "credit-note", permission: "accounting" },
    { label: "Purchase Return", page: "debit-note", permission: "accounting" },
    { label: "Receipt Voucher", page: "receipt", permission: "accounting" },
    { label: "Payment Voucher", page: "payment", permission: "accounting" },
    { label: "Journal Entry", page: "journal", permission: "accounting" },
    { label: "Contra Voucher", page: "contra", permission: "accounting" },
    { label: "Sales Order", page: "sales-order", permission: "accounting" },
    { label: "Purchase Order", page: "purchase-order", permission: "accounting" },
    { label: "Delivery Challan", page: "delivery-challan", permission: "accounting" },
    { label: "GRN", page: "grn", permission: "accounting" },
    { label: "Stock Journal", page: "stock-journal", permission: "accounting" },
    { label: "Physical Stock", page: "physical-stock", permission: "accounting" },
    { label: "Production", page: "production", permission: "accounting" },
    { label: "Recurring Vouchers", page: "recurring-vouchers", permission: "accounting" },
  ],
  REPORTS: [
    { label: "Balance Sheet", page: "balance-sheet", permission: "accounting" },
    { label: "Profit & Loss", page: "profit-loss", permission: "accounting" },
    { label: "Trial Balance", page: "trial-balance", permission: "accounting" },
    { label: "General Ledger", page: "ledger", permission: "accounting" },
    { label: "Cash Book", page: "cash-book", permission: "accounting" },
    { label: "Bank Book", page: "bank-book", permission: "accounting" },
    { label: "Day Book", page: "day-book", permission: "accounting" },
    { label: "Sales Register", page: "sales-register", permission: "accounting" },
    { label: "Purchase Register", page: "purchase-register", permission: "accounting" },
    { label: "Cash Flow Statement", page: "cash-flow", permission: "accounting" },
    { label: "Ratio Analysis", page: "ratio-analysis", permission: "accounting" },
    { label: "Stock Summary", page: "stock-summary", permission: "accounting" },
    { label: "Inventory Report", page: "inventory-report", permission: "accounting" },
    { label: "Aging Report", page: "aging-report", permission: "accounting" },
    { label: "VAT Reports", page: "vat-reports", permission: "accounting" },
    { label: "TDS Report", page: "tds-report", permission: "accounting" },
    { label: "Bill-wise Pending", page: "bill-wise-pending", permission: "accounting" },
    { label: "Party Ledger", page: "party-ledger", permission: "accounting" },
    { label: "Cost Center Report", page: "cost-center-report", permission: "accounting" },
    { label: "Budget vs Actual", page: "budget-vs-actual", permission: "accounting" },
    { label: "Vouchers Log", page: "vouchers-log", permission: "accounting" },
  ],
  UTILITIES: [
    { label: "Bank Reconciliation", page: "bank-reconciliation", permission: "accounting" },
    { label: "Bank Statement Import", page: "bank-statement-import", permission: "accounting" },
    { label: "Data Export/Import", page: "data-export-import", permission: "accounting" },
    { label: "Backup & Restore", page: "backup", permission: "admin" },
    { label: "Audit Log", page: "audit-log", permission: "admin" },
    { label: "Users Management", page: "users", permission: "admin" },
    { label: "Company Settings", page: "settings", permission: "admin" },
    { label: "Fiscal Year", page: "fiscal-year", permission: "admin" },
    { label: "Bulk Updations", page: "bulk-updations", permission: "accounting" },
    { label: "Opening Balance", page: "opening-balance", permission: "accounting" },
    { label: "Overdue Bills Interest", page: "overdue-bills-interest", permission: "accounting" },
  ],
};

const Gateway: React.FC = () => {
  const {
    currentUser,
    companySettings,
    currentFiscalYear,
    notifications,
    accounts,
    vouchers,
    invoices,
    items,
    parties,
    warehouses,
    stockMovements,
    setCurrentPage,
    setActiveVoucherDate,
    activeVoucherDate: storeActiveVoucherDate,
  } = useStore();

  const { recentActivity, pushActivity, clearActivity } = useRecentActivity();

  const [activeVoucherDate, setLocalActiveVoucherDate] = useState(
    storeActiveVoucherDate || todayISO(),
  );
  const [datePanelOpen, setDatePanelOpen] = useState(false);
  const [periodPanelOpen, setPeriodPanelOpen] = useState(false);
  const [reportPeriodFrom, setReportPeriodFrom] = useState(
    currentFiscalYear?.startDate || todayISO(),
  );
  const [reportPeriodTo, setReportPeriodTo] = useState(todayISO());

  const dateInputRef = useRef<HTMLInputElement>(null);
  const periodFromRef = useRef<HTMLInputElement>(null);

  const mastersRef = useRef<HTMLDivElement>(null);
  const transactionsRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);
  const utilitiesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentFiscalYear?.startDate) setReportPeriodFrom(currentFiscalYear.startDate);
  }, [currentFiscalYear?.startDate]);

  useEffect(() => {
    try {
      setActiveVoucherDate?.(activeVoucherDate);
    } catch {
      // optional store setter; never crash the gateway
    }
  }, [activeVoucherDate, setActiveVoucherDate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.getAttribute("contenteditable") === "true";

      if (event.key === "F2" && event.altKey) {
        event.preventDefault();
        setPeriodPanelOpen(true);
        window.setTimeout(() => periodFromRef.current?.focus(), 0);
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        setDatePanelOpen(true);
        window.setTimeout(() => dateInputRef.current?.focus(), 0);
        return;
      }

      if (event.key === "Escape") {
        setDatePanelOpen(false);
        setPeriodPanelOpen(false);
        return;
      }

      if (isTyping) return;

      const k = event.key.toLowerCase();
      if (k === "m") mastersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (k === "t")
        transactionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (k === "r") reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (k === "u") utilitiesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const role = currentUser?.role || currentUser?.userRole || "";

  const canSee = (item: GatewayMenuItem) => {
    try {
      if (item.permission === "admin") return isAdminOrOwner(role);
      if (item.permission === "accounting") return isAccountantOrAdmin(role) || isAdminOrOwner(role);
      return true;
    } catch {
      return item.permission !== "admin";
    }
  };

  const navigate = (label: string, page: string) => {
    try {
      pushActivity(label, page);
    } catch {
      // ignore
    }
    setCurrentPage(page);
  };

  const quickActions: GatewayMenuItem[] = [
    { label: "New Sales Invoice", page: "billing", permission: "accounting" },
    { label: "New Purchase Invoice", page: "purchase-register", permission: "accounting" },
    { label: "New Receipt", page: "receipt", permission: "accounting" },
    { label: "New Payment", page: "payment", permission: "accounting" },
    { label: "New Journal", page: "journal", permission: "accounting" },
    { label: "Bank Reconciliation", page: "bank-reconciliation", permission: "accounting" },
    { label: "VAT Reports", page: "vat-reports", permission: "accounting" },
    { label: "Day Book", page: "day-book", permission: "accounting" },
  ];

  const unreadNotifications = useMemo(() => {
    try {
      return (notifications || []).filter((n: any) => !n.read).slice(0, 5);
    } catch {
      return [];
    }
  }, [notifications]);

  const businessAlerts = useMemo(() => {
    const alerts: string[] = [];

    try {
      const negativeCash = (accounts || []).some(
        (a: any) =>
          String(a.name || "").toLowerCase().includes("cash") && Number(a.balance || 0) < 0,
      );
      if (negativeCash) alerts.push("Negative cash balance detected");
    } catch {
      // ignore
    }

    try {
      const positions = computeAllStockPositions(stockMovements || [], items || [], warehouses || []);
      const low = (positions || []).some((pos: any) => {
        const item = (items || []).find((i: any) => i.id === pos.itemId);
        const reorder = Number(item?.reorderLevel || 0);
        const qty = Number(pos.qty ?? pos.closingQty ?? pos.quantity ?? 0);
        return reorder > 0 && qty <= reorder;
      });
      if (low) alerts.push("Low stock alert");
    } catch {
      // ignore
    }

    try {
      const overdue = (invoices || []).filter((inv: any) => {
        const status = String(inv.paymentStatus || "").toLowerCase();
        return (
          (status === "unpaid" || inv.paymentStatus === PaymentStatus.UNPAID) &&
          inv.dueDate &&
          inv.dueDate < todayISO()
        );
      }).length;
      if (overdue > 0) alerts.push(`${overdue} overdue receivables`);
    } catch {
      // ignore
    }

    return alerts;
  }, [accounts, stockMovements, items, warehouses, invoices]);

  const snapshot = useMemo(() => {
    const zero = {
      cashBalance: 0,
      bankBalance: 0,
      receivables: 0,
      payables: 0,
      todaysSales: 0,
      todaysPurchases: 0,
      vatPayable: 0,
      stockValue: 0,
    };

    try {
      const today = todayISO();

      const cashBalance = (accounts || [])
        .filter((a: any) => String(a.name || "").toLowerCase().includes("cash"))
        .reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

      const bankBalance = (accounts || [])
        .filter((a: any) => String(a.name || "").toLowerCase().includes("bank"))
        .reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

      const receivables =
        computeOutstandingReceivables(parties || [], invoices || [], vouchers || [])?.totalAmount || 0;

      const payables = (accounts || [])
        .filter((a: any) => {
          const group = String(a.group || a.groupName || "").toLowerCase();
          const name = String(a.name || "").toLowerCase();
          return group.includes("sundry creditors") || name.includes("sundry creditors");
        })
        .reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

      const todaysSales = (invoices || [])
        .filter(
          (inv: any) =>
            inv.type === VoucherType.SALES_INVOICE &&
            inv.status === VoucherStatus.POSTED &&
            inv.date === today,
        )
        .reduce((sum: number, inv: any) => sum + Number(inv.grandTotal || 0), 0);

      const todaysPurchases = (invoices || [])
        .filter(
          (inv: any) =>
            inv.type === VoucherType.PURCHASE_INVOICE &&
            inv.status === VoucherStatus.POSTED &&
            inv.date === today,
        )
        .reduce((sum: number, inv: any) => sum + Number(inv.grandTotal || 0), 0);

      const vatPayable = (accounts || [])
        .filter((a: any) => String(a.name || "").toLowerCase().includes("vat payable"))
        .reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

      let stockValue = 0;
      try {
        const positions = computeAllStockPositions(stockMovements || [], items || [], warehouses || []);
        stockValue = (positions || []).reduce((sum: number, pos: any) => {
          const item = (items || []).find((i: any) => i.id === pos.itemId);
          const qty = Number(pos.qty ?? pos.closingQty ?? pos.quantity ?? 0);
          const rate = Number(pos.avgRate ?? pos.avg_rate ?? item?.purchaseRate ?? item?.openingStockRate ?? 0);
          const value = Number(pos.value ?? pos.closingValue ?? pos.stockValue ?? qty * rate);
          return sum + value;
        }, 0);
      } catch {
        stockValue = 0;
      }

      return {
        cashBalance,
        bankBalance,
        receivables,
        payables,
        todaysSales,
        todaysPurchases,
        vatPayable,
        stockValue,
      };
    } catch {
      return zero;
    }
  }, [accounts, parties, invoices, vouchers, stockMovements, items, warehouses]);

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "No company configured";

  const fiscalYearLabel =
    currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || "No active fiscal year";

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    MASTERS: mastersRef,
    TRANSACTIONS: transactionsRef,
    REPORTS: reportsRef,
    UTILITIES: utilitiesRef,
  };

  const renderMenuSection = (section: string, rows: GatewayMenuItem[]) => {
    const visibleRows = rows.filter(canSee);

    return (
      <div ref={sectionRefs[section]} style={panelStyle}>
        <div style={sectionHeaderStyle}>{section}</div>
        <div style={{ padding: 4 }}>
          {visibleRows.map((item) => (
            <button
              key={`${section}-${item.page}-${item.label}`}
              type="button"
              onClick={() => navigate(item.label, item.page)}
              className="w-full text-left hover:bg-[#B8D4A0] transition-colors"
              style={{
                display: "block",
                width: "100%",
                border: "1px solid transparent",
                background: "transparent",
                color: "#000",
                padding: "4px 6px",
                borderRadius: 0,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {item.label}
            </button>
          ))}
          {visibleRows.length === 0 ? (
            <div style={{ padding: 8, fontSize: 11 }}>No permitted items.</div>
          ) : null}
        </div>
      </div>
    );
  };

  const activityTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div
      className="min-h-full"
      style={{
        background: "#C9DEB5",
        color: "#000",
        padding: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
      }}
    >
      <div style={{ ...panelStyle, marginBottom: 8 }}>
        <div
          style={{
            ...sectionHeaderStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #000",
          }}
        >
          <span>Gateway / Main Home</span>
          <span style={{ fontWeight: 600, fontSize: 11 }}>
            Active Date: {safeDateBS(activeVoucherDate)} · {activeVoucherDate}
          </span>
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          style={{
            padding: 6,
          }}
        >
          {quickActions.filter(canSee).map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => navigate(item.label, item.page)}
              className="hover:bg-[#B8D4A0] transition-colors"
              style={{
                height: 26,
                padding: "0 8px",
                border: "1px solid #000",
                background: "#D4EABD",
                color: "#000",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!companySettings ? (
        <div style={{ ...panelStyle, padding: 10, marginBottom: 8 }}>
          <b>No company configured.</b>{" "}
          <button
            type="button"
            onClick={() => navigate("Company Settings", "settings")}
            style={{
              marginLeft: 8,
              border: "1px solid #000",
              background: "#D4EABD",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Open Settings
          </button>
        </div>
      ) : null}

      {!currentFiscalYear ? (
        <div style={{ ...panelStyle, padding: 10, marginBottom: 8 }}>
          <b>No active fiscal year.</b>{" "}
          <button
            type="button"
            onClick={() => navigate("Fiscal Year", "fiscal-year")}
            style={{
              marginLeft: 8,
              border: "1px solid #000",
              background: "#D4EABD",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Open Fiscal Year
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-2">
        <div className="flex flex-col gap-2">
          <div style={panelStyle}>
            <div style={sectionHeaderStyle}>Company & Period</div>
            <div className="grid grid-cols-2 gap-2" style={{ padding: 8 }}>
              <div>
                <div style={labelStyle}>Company</div>
                <div style={valueStyle}>{companyName}</div>
              </div>
              <div>
                <div style={labelStyle}>Fiscal Year</div>
                <div style={valueStyle}>{fiscalYearLabel}</div>
              </div>
              <div>
                <div style={labelStyle}>PAN</div>
                <div style={valueStyle}>{companySettings?.panNumber || "—"}</div>
              </div>
              <div>
                <div style={labelStyle}>VAT Reg No</div>
                <div style={valueStyle}>{companySettings?.vatNumber || "—"}</div>
              </div>
              <div>
                <div style={labelStyle}>FY Start</div>
                <div style={valueStyle}>
                  {safeDateBS(currentFiscalYear?.startDate)}{" "}
                  <span style={{ fontSize: 10 }}>({currentFiscalYear?.startDate || "—"})</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>FY End</div>
                <div style={valueStyle}>
                  {safeDateBS(currentFiscalYear?.endDate)}{" "}
                  <span style={{ fontSize: 10 }}>({currentFiscalYear?.endDate || "—"})</span>
                </div>
              </div>
              <div className="col-span-2">
                <div style={labelStyle}>Today</div>
                <div style={valueStyle}>
                  {getBSTodayLong()} · AD {new Date().toLocaleDateString()}
                </div>
              </div>
              <div>
                <div style={labelStyle}>User</div>
                <div style={valueStyle}>{currentUser?.name || currentUser?.username || "—"}</div>
              </div>
              <div>
                <div style={labelStyle}>Role</div>
                <div style={valueStyle}>{role || "—"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5" style={{ padding: "0 8px 8px" }}>
              <button
                type="button"
                onClick={() => {
                  setDatePanelOpen((v) => !v);
                  setTimeout(() => dateInputRef.current?.focus(), 0);
                }}
                style={{
                  border: "1px solid #000",
                  background: "#C9DEB5",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Change Date [F2]
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPanelOpen((v) => !v);
                  setTimeout(() => periodFromRef.current?.focus(), 0);
                }}
                style={{
                  border: "1px solid #000",
                  background: "#C9DEB5",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Change Period [Alt+F2]
              </button>
            </div>

            {datePanelOpen ? (
              <div style={{ padding: 8, borderTop: "1px solid #000", background: "#C9DEB5" }}>
                <div style={labelStyle}>Active Voucher Date</div>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={activeVoucherDate}
                  onChange={(e) => setLocalActiveVoucherDate(e.target.value)}
                  style={{
                    height: 28,
                    width: "100%",
                    border: "1px solid #000",
                    background: "#EBF5E2",
                    color: "#000",
                    padding: "0 6px",
                    marginTop: 4,
                  }}
                />
                <div style={{ fontSize: 11, marginTop: 4 }}>BS: {safeDateBS(activeVoucherDate)}</div>
              </div>
            ) : null}

            {periodPanelOpen ? (
              <div style={{ padding: 8, borderTop: "1px solid #000", background: "#C9DEB5" }}>
                <div style={labelStyle}>Report Period</div>
                <div className="grid grid-cols-2 gap-2" style={{ marginTop: 4 }}>
                  <input
                    ref={periodFromRef}
                    type="date"
                    value={reportPeriodFrom}
                    onChange={(e) => setReportPeriodFrom(e.target.value)}
                    style={{
                      height: 28,
                      border: "1px solid #000",
                      background: "#EBF5E2",
                      color: "#000",
                      padding: "0 6px",
                    }}
                  />
                  <input
                    type="date"
                    value={reportPeriodTo}
                    onChange={(e) => setReportPeriodTo(e.target.value)}
                    style={{
                      height: 28,
                      border: "1px solid #000",
                      background: "#EBF5E2",
                      color: "#000",
                      padding: "0 6px",
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  BS: {safeDateBS(reportPeriodFrom)} to {safeDateBS(reportPeriodTo)}
                </div>
              </div>
            ) : null}
          </div>

          <div style={panelStyle}>
            <div
              style={{
                ...sectionHeaderStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Recent Activity</span>
              {recentActivity.length ? (
                <button
                  type="button"
                  onClick={clearActivity}
                  style={{
                    border: "1px solid #000",
                    background: "#C9DEB5",
                    fontSize: 10,
                    padding: "1px 6px",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div style={{ padding: 4 }}>
              {recentActivity.length === 0 ? (
                <div style={{ padding: 8, fontSize: 11 }}>No recent activity</div>
              ) : (
                recentActivity.slice(0, 8).map((item) => (
                  <button
                    key={`${item.page}-${item.timestamp}`}
                    type="button"
                    onClick={() => navigate(item.label, item.page)}
                    className="hover:bg-[#B8D4A0]"
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "5px 6px",
                      border: "1px solid transparent",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <div style={{ fontSize: 10 }}>{activityTimestamp(item.timestamp)}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={sectionHeaderStyle}>Alerts / Notifications</div>
            <div style={{ padding: 6 }}>
              {businessAlerts.map((alert) => (
                <div
                  key={alert}
                  style={{
                    border: "1px solid #000",
                    background: "#C9DEB5",
                    padding: "5px 6px",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  {alert}
                </div>
              ))}

              {unreadNotifications.length === 0 && businessAlerts.length === 0 ? (
                <div style={{ padding: 4, fontSize: 11 }}>No pending alerts.</div>
              ) : null}

              {unreadNotifications.map((n: any, idx: number) => (
                <button
                  key={n.id || idx}
                  type="button"
                  onClick={() => navigate("Audit Log", "audit-log")}
                  className="hover:bg-[#B8D4A0]"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "1px solid #000",
                    background: "#D4EABD",
                    padding: "5px 6px",
                    marginTop: 4,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{n.message || n.title || "Notification"}</div>
                  <div style={{ fontSize: 10 }}>
                    {n.timestamp || n.createdAt ? activityTimestamp(n.timestamp || n.createdAt) : "—"}
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => navigate("Audit Log", "audit-log")}
                style={{
                  marginTop: 6,
                  border: "none",
                  background: "transparent",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                View All
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {Object.entries(menuSections).map(([section, rows]) => (
            <React.Fragment key={section}>{renderMenuSection(section, rows)}</React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 8 }}>
        <div style={sectionHeaderStyle}>Business Snapshot</div>
        <div className="flex flex-wrap gap-1.5" style={{ padding: 6 }}>
          <GatewayTile
            label="Cash Balance"
            value={money(snapshot.cashBalance)}
            onClick={() => navigate("Cash Book", "cash-book")}
          />
          <GatewayTile
            label="Bank Balance"
            value={money(snapshot.bankBalance)}
            onClick={() => navigate("Bank Book", "bank-book")}
          />
          <GatewayTile
            label="Total Receivables"
            value={money(snapshot.receivables)}
            onClick={() => navigate("Aging Report", "aging-report")}
          />
          <GatewayTile
            label="Total Payables"
            value={money(snapshot.payables)}
            onClick={() => navigate("Bill-wise Pending", "bill-wise-pending")}
          />
          <GatewayTile
            label="Today's Sales"
            value={money(snapshot.todaysSales)}
            onClick={() => navigate("Sales Invoice", "billing")}
          />
          <GatewayTile
            label="Today's Purchases"
            value={money(snapshot.todaysPurchases)}
            onClick={() => navigate("Purchase Register", "purchase-register")}
          />
          <GatewayTile
            label="VAT Payable"
            value={money(snapshot.vatPayable)}
            onClick={() => navigate("VAT Reports", "vat-reports")}
          />
          <GatewayTile
            label="Stock Value"
            value={money(snapshot.stockValue)}
            onClick={() => navigate("Stock Summary", "stock-summary")}
          />
        </div>
      </div>
    </div>
  );
};

export default Gateway;
