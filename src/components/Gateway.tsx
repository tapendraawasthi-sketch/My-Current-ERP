import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import GatewayTile from "./GatewayTile";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { formatADToBS, getBSTodayLong } from "../lib/nepaliDate";
import { formatNumber } from "../lib/utils";
import { computeOutstandingReceivables } from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { isAdminOrOwner, isAccountantOrAdmin } from "../lib/permissions";
import { PaymentStatus, VoucherStatus, VoucherType } from "../lib/types";
import { useScreenF12 } from '../hooks/useF12Config';

type PermissionScope = "all" | "accounting" | "admin";

interface GatewayMenuItem {
  label: string;
  page: string;
  permission?: PermissionScope;
}

const todayISO = () => new Date().toISOString().split("T")[0];

const money = (value: number) => `रू ${formatNumber(Number(value) || 0)}`;

const safeLower = (value: unknown) => String(value || "").toLowerCase();

const safeBS = (date?: string) => {
  try {
    if (!date) return "—";
    return formatADToBS(date) || date;
  } catch {
    return date || "—";
  }
};

const safeTimestamp = (timestamp?: string) => {
  try {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp || "—";
  }
};

// --- Tailwind CSS class strings ---
const sectionHeaderClass = "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const panelClass = "bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden";
const labelClass = "text-[11px] font-medium text-gray-500";
const valueClass = "text-[12px] font-semibold text-gray-800";
const smallButtonClass = "h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50 transition-colors inline-flex items-center justify-center whitespace-nowrap";
const inputClass = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";

const MENU_SECTIONS: Record<string, GatewayMenuItem[]> = {
  MASTERS: [
    { label: "Master Control Centre", page: "master-control-centre", permission: "accounting" },
    { label: "Chart of Accounts", page: "accounts", permission: "accounting" },
    { label: "Ledgers", page: "ledgers", permission: "accounting" },
    { label: "Account Groups", page: "account-groups", permission: "accounting" },
    { label: "Parties Directory", page: "parties", permission: "accounting" },
    { label: "Stock Items", page: "items", permission: "accounting" },
    { label: "Item Groups", page: "item-groups", permission: "accounting" },
    { label: "Stock Categories", page: "stock-categories", permission: "accounting" },
    { label: "Reorder Levels", page: "reorder-levels", permission: "accounting" },
    { label: "Price Levels", page: "price-levels", permission: "accounting" },
    { label: "Price Lists", page: "price-lists", permission: "accounting" },
    { label: "HS Codes", page: "hs-codes", permission: "accounting" },
    { label: "Batches", page: "batches", permission: "accounting" },
    { label: "VAT Classifications", page: "vat-classifications", permission: "accounting" },
    { label: "TDS Natures of Payment", page: "tds-nature-of-payments", permission: "accounting" },
    { label: "Employee Groups", page: "employee-groups", permission: "accounting" },
    { label: "Pay Heads", page: "pay-heads", permission: "accounting" },
    { label: "Salary Details", page: "salary-details", permission: "accounting" },
    { label: "Payroll Units", page: "payroll-units", permission: "accounting" },
    { label: "Attendance Types", page: "attendance-types", permission: "accounting" },
    { label: "Voucher Types", page: "voucher-types", permission: "accounting" },
    { label: "Scenarios", page: "scenarios", permission: "accounting" },
    { label: "Warehouses", page: "warehouses", permission: "accounting" },
    { label: "Units of Measure", page: "units", permission: "accounting" },
    { label: "Cost Centers", page: "cost-centers", permission: "accounting" },
    { label: "Cost Categories", page: "cost-categories", permission: "accounting" },
    { label: "Cost Centre Classes", page: "cost-centre-classes", permission: "accounting" },
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
    { label: "F11: Company Features", page: "f11-company-features", permission: "admin" },
    { label: "Fiscal Year", page: "fiscal-year", permission: "admin" },
    { label: "Bulk Updations", page: "bulk-updations", permission: "accounting" },
    { label: "Opening Balance", page: "opening-balance", permission: "accounting" },
    { label: "Overdue Bills Interest", page: "overdue-bills-interest", permission: "accounting" },
  ],
};

const QUICK_ACTIONS: GatewayMenuItem[] = [
  { label: "New Sales Invoice", page: "billing", permission: "accounting" },
  { label: "New Purchase Invoice", page: "purchase-register", permission: "accounting" },
  { label: "New Receipt", page: "receipt", permission: "accounting" },
  { label: "New Payment", page: "payment", permission: "accounting" },
  { label: "New Journal", page: "journal", permission: "accounting" },
  { label: "Bank Reconciliation", page: "bank-reconciliation", permission: "accounting" },
  { label: "VAT Reports", page: "vat-reports", permission: "accounting" },
  { label: "Day Book", page: "day-book", permission: "accounting" },
];

const Gateway: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12('global');

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
    activeVoucherDate: storeActiveVoucherDate,
    setActiveVoucherDate,
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

  const role = currentUser?.role || currentUser?.userRole || currentUser?.type || "";

  useEffect(() => {
    if (currentFiscalYear?.startDate) {
      setReportPeriodFrom(currentFiscalYear.startDate);
    }
  }, [currentFiscalYear?.startDate]);

  useEffect(() => {
    try {
      setActiveVoucherDate?.(activeVoucherDate);
    } catch {
      // store may not be hydrated yet
    }
  }, [activeVoucherDate, setActiveVoucherDate]);

  const isEditableTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;

    const tag = element.tagName?.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      element.getAttribute("contenteditable") === "true"
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "m") mastersRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (key === "t")
        transactionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (key === "r") reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (key === "u") utilitiesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const canAdmin = useMemo(() => {
    try {
      return isAdminOrOwner(role) || isAdminOrOwner(currentUser);
    } catch {
      try {
        return isAdminOrOwner(currentUser);
      } catch {
        return false;
      }
    }
  }, [role, currentUser]);

  const canAccounting = useMemo(() => {
    try {
      return isAccountantOrAdmin(role) || isAccountantOrAdmin(currentUser) || canAdmin;
    } catch {
      try {
        return isAccountantOrAdmin(currentUser) || canAdmin;
      } catch {
        return canAdmin;
      }
    }
  }, [role, currentUser, canAdmin]);

  const canSee = (item: GatewayMenuItem) => {
    if (!item.permission || item.permission === "all") return true;
    if (item.permission === "admin") return canAdmin;
    if (item.permission === "accounting") return canAccounting;
    return true;
  };

  const navigate = (label: string, page: string) => {
    pushActivity(label, page);
    setCurrentPage(page);
  };

  const unreadNotifications = useMemo(() => {
    try {
      return (notifications || []).filter((notification: any) => !notification.read).slice(0, 5);
    } catch {
      return [];
    }
  }, [notifications]);

  const stockPositions = useMemo(() => {
    try {
      return computeAllStockPositions(stockMovements || [], items || [], warehouses || []);
    } catch {
      try {
        return computeAllStockPositions(items || [], stockMovements || [], warehouses || []);
      } catch {
        return [];
      }
    }
  }, [stockMovements, items, warehouses]);

  const businessAlerts = useMemo(() => {
    const alerts: string[] = [];

    try {
      const negativeCash = (accounts || []).some(
        (account: any) =>
          safeLower(account.name).includes("cash") && Number(account.balance || 0) < 0,
      );
      if (negativeCash) alerts.push("Negative cash balance detected");
    } catch {
      // ignore
    }

    try {
      const lowStock = (stockPositions || []).some((position: any) => {
        const item = (items || []).find((candidate: any) => candidate.id === position.itemId);
        const reorderLevel = Number(item?.reorderLevel || 0);
        const qty = Number(
          position.qty ??
            position.closingQty ??
            position.quantity ??
            position.currentQty ??
            position.balanceQty ??
            0,
        );

        return reorderLevel > 0 && qty <= reorderLevel;
      });

      if (lowStock) alerts.push("Low stock alert");
    } catch {
      // ignore
    }

    try {
      const overdueCount = (invoices || []).filter((invoice: any) => {
        const status = safeLower(invoice.paymentStatus);
        return (
          (invoice.paymentStatus === PaymentStatus.UNPAID || status === "unpaid") &&
          invoice.dueDate &&
          invoice.dueDate < todayISO()
        );
      }).length;

      if (overdueCount > 0) alerts.push(`${overdueCount} overdue receivables`);
    } catch {
      // ignore
    }

    return alerts;
  }, [accounts, stockPositions, items, invoices]);

  const snapshot = useMemo(() => {
    try {
      const today = todayISO();

      const cashBalance = (accounts || [])
        .filter((account: any) => safeLower(account.name).includes("cash"))
        .reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0);

      const bankBalance = (accounts || [])
        .filter((account: any) => safeLower(account.name).includes("bank"))
        .reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0);

      let receivables = 0;
      try {
        receivables =
          computeOutstandingReceivables(parties || [], invoices || [], vouchers || [])
            ?.totalAmount || 0;
      } catch {
        receivables = 0;
      }

      const payables = (accounts || [])
        .filter((account: any) => {
          const group = safeLower(account.group || account.groupName || account.parentName);
          const name = safeLower(account.name);
          return group.includes("sundry creditors") || name.includes("sundry creditors");
        })
        .reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0);

      const todaysSales = (invoices || [])
        .filter(
          (invoice: any) =>
            invoice.type === VoucherType.SALES_INVOICE &&
            invoice.status === VoucherStatus.POSTED &&
            invoice.date === today,
        )
        .reduce((sum: number, invoice: any) => sum + Number(invoice.grandTotal || 0), 0);

      const todaysPurchases = (invoices || [])
        .filter(
          (invoice: any) =>
            invoice.type === VoucherType.PURCHASE_INVOICE &&
            invoice.status === VoucherStatus.POSTED &&
            invoice.date === today,
        )
        .reduce((sum: number, invoice: any) => sum + Number(invoice.grandTotal || 0), 0);

      const vatPayable = (accounts || [])
        .filter((account: any) => safeLower(account.name).includes("vat payable"))
        .reduce((sum: number, account: any) => sum + Number(account.balance || 0), 0);

      const stockValue = (stockPositions || []).reduce((sum: number, position: any) => {
        const item = (items || []).find((candidate: any) => candidate.id === position.itemId);
        const qty = Number(
          position.qty ??
            position.closingQty ??
            position.quantity ??
            position.currentQty ??
            position.balanceQty ??
            0,
        );

        const rate = Number(
          position.avgRate ??
            position.avg_rate ??
            position.rate ??
            item?.purchaseRate ??
            item?.openingStockRate ??
            item?.openingRate ??
            0,
        );

        const value = Number(
          position.value ??
            position.closingValue ??
            position.stockValue ??
            position.amount ??
            qty * rate,
        );

        return sum + value;
      }, 0);

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
      return {
        cashBalance: 0,
        bankBalance: 0,
        receivables: 0,
        payables: 0,
        todaysSales: 0,
        todaysPurchases: 0,
        vatPayable: 0,
        stockValue: 0,
      };
    }
  }, [accounts, parties, invoices, vouchers, stockPositions, items]);

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
      <div ref={sectionRefs[section]} className={panelClass}>
        <div className={sectionHeaderClass}>{section}</div>

        <div className="p-1 divide-y divide-gray-50">
          {visibleRows.length === 0 ? (
            <div className="p-2 text-[11px] text-gray-500">No permitted items.</div>
          ) : (
            visibleRows.map((item) => (
              <button
                key={`${section}-${item.label}-${item.page}`}
                type="button"
                onClick={() => navigate(item.label, item.page)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-[#f5f6fa] text-[12px] text-gray-700 transition-colors"
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-[#f5f6fa] p-4">
      {/* QUICK ACTIONS */}
      <div className={`${panelClass} mb-3`}>
        <div className={`${sectionHeaderClass} flex items-center justify-between bg-white border-b border-gray-200`}>
          <span className="text-[14px] text-gray-800 font-semibold tracking-normal normal-case">Gateway / Main Home</span>
          <span className="text-[11px] font-medium text-gray-500 normal-case tracking-normal">
            Active Date: <span className="font-bold text-[#1557b0]">{safeBS(activeVoucherDate)}</span> <span className="mx-1">·</span> AD {activeVoucherDate}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 p-3 bg-gray-50">
          {QUICK_ACTIONS.filter(canSee).map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => navigate(item.label, item.page)}
              className={smallButtonClass}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* MISSING CONFIG WARNINGS */}
      {!companySettings ? (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-3 mb-3 flex items-center justify-between shadow-sm">
          <span className="text-[12px] font-medium">No company configured.</span>
          <button
            type="button"
            onClick={() => navigate("Company Settings", "settings")}
            className="h-7 px-3 bg-white border border-amber-300 text-amber-800 text-[11px] font-medium rounded hover:bg-amber-100 transition-colors"
          >
            Configure Company
          </button>
        </div>
      ) : null}

      {!currentFiscalYear ? (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-3 mb-3 flex items-center justify-between shadow-sm">
          <span className="text-[12px] font-medium">No active fiscal year.</span>
          <button
            type="button"
            onClick={() => navigate("Fiscal Year", "fiscal-year")}
            className="h-7 px-3 bg-white border border-amber-300 text-amber-800 text-[11px] font-medium rounded hover:bg-amber-100 transition-colors"
          >
            Open Fiscal Year
          </button>
        </div>
      ) : null}

      {/* MAIN BODY */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-3">
        {/* LEFT PANEL */}
        <div className="flex flex-col gap-3">
          {/* Company Info */}
          <div className={panelClass}>
            <div className={sectionHeaderClass}>Company & Period Info</div>

            <div className="grid grid-cols-2 gap-y-3 gap-x-4 p-4">
              <div>
                <div className={labelClass}>Company</div>
                <div className={valueClass}>{companyName}</div>
              </div>

              <div>
                <div className={labelClass}>Fiscal Year</div>
                <div className={valueClass}>{fiscalYearLabel}</div>
              </div>

              <div>
                <div className={labelClass}>PAN</div>
                <div className={valueClass}>{companySettings?.panNumber || "—"}</div>
              </div>

              <div>
                <div className={labelClass}>VAT Reg No</div>
                <div className={valueClass}>{companySettings?.vatNumber || "—"}</div>
              </div>

              <div>
                <div className={labelClass}>FY Start</div>
                <div className={valueClass}>
                  {safeBS(currentFiscalYear?.startDate)}
                  <div className="text-[10px] text-gray-500 font-normal mt-0.5">AD {currentFiscalYear?.startDate || "—"}</div>
                </div>
              </div>

              <div>
                <div className={labelClass}>FY End</div>
                <div className={valueClass}>
                  {safeBS(currentFiscalYear?.endDate)}
                  <div className="text-[10px] text-gray-500 font-normal mt-0.5">AD {currentFiscalYear?.endDate || "—"}</div>
                </div>
              </div>

              <div className="col-span-2 border-t border-gray-100 pt-3">
                <div className={labelClass}>Today</div>
                <div className={valueClass}>
                  {getBSTodayLong()} <span className="text-gray-400 mx-1">·</span> <span className="text-gray-500 font-medium">AD {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <div className={labelClass}>User</div>
                <div className={valueClass}>{currentUser?.name || currentUser?.username || "—"}</div>
              </div>

              <div>
                <div className={labelClass}>Role</div>
                <div className={valueClass}>{role || "—"}</div>
              </div>

              <div className="col-span-2 pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDatePanelOpen((open) => !open);
                    window.setTimeout(() => dateInputRef.current?.focus(), 0);
                  }}
                  className={smallButtonClass}
                >
                  Change Date [F2]
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPeriodPanelOpen((open) => !open);
                    window.setTimeout(() => periodFromRef.current?.focus(), 0);
                  }}
                  className={smallButtonClass}
                >
                  Change Period [Alt+F2]
                </button>
              </div>
            </div>

            {datePanelOpen ? (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <div className={labelClass}>Active Voucher Date</div>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={activeVoucherDate}
                  onChange={(event) => setLocalActiveVoucherDate(event.target.value)}
                  className={`${inputClass} mt-1.5 max-w-[200px]`}
                />
                <div className="text-[10px] text-gray-500 mt-1.5 font-medium">BS: {safeBS(activeVoucherDate)}</div>
              </div>
            ) : null}

            {periodPanelOpen ? (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <div className={labelClass}>Report Period</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    ref={periodFromRef}
                    type="date"
                    value={reportPeriodFrom}
                    onChange={(event) => setReportPeriodFrom(event.target.value)}
                    className={`${inputClass} max-w-[140px]`}
                  />
                  <span className="text-gray-400 text-[11px] font-medium">to</span>
                  <input
                    type="date"
                    value={reportPeriodTo}
                    onChange={(event) => setReportPeriodTo(event.target.value)}
                    className={`${inputClass} max-w-[140px]`}
                  />
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5 font-medium">
                  BS: {safeBS(reportPeriodFrom)} to {safeBS(reportPeriodTo)}
                </div>
              </div>
            ) : null}
          </div>

          {/* Recent Activity */}
          <div className={panelClass}>
            <div className={`${sectionHeaderClass} flex items-center justify-between`}>
              <span>Recent Activity</span>
              {recentActivity.length ? (
                <button
                  type="button"
                  onClick={clearActivity}
                  className="text-[10px] text-gray-400 hover:text-red-600 transition-colors normal-case tracking-normal font-medium px-1"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="divide-y divide-gray-100">
              {recentActivity.length === 0 ? (
                <div className="p-4 text-[11px] text-gray-500 text-center">No recent activity</div>
              ) : (
                recentActivity.slice(0, 8).map((item) => (
                  <button
                    key={`${item.page}-${item.timestamp}`}
                    type="button"
                    onClick={() => navigate(item.label, item.page)}
                    className="w-full text-left px-3 py-2 hover:bg-[#f5f6fa] transition-colors"
                  >
                    <div className="text-[12px] font-medium text-gray-800">{item.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{safeTimestamp(item.timestamp)}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className={panelClass}>
            <div className={sectionHeaderClass}>Alerts / Notifications</div>

            <div className="p-3">
              {businessAlerts.map((alert) => (
                <div
                  key={alert}
                  className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-md mb-2 text-[12px] font-medium shadow-sm"
                >
                  {alert}
                </div>
              ))}

              {unreadNotifications.map((notification: any, index: number) => (
                <button
                  key={notification.id || index}
                  type="button"
                  onClick={() => navigate("Audit Log", "audit-log")}
                  className="w-full text-left bg-white border border-gray-200 px-3 py-2 rounded-md mb-2 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <div className="font-semibold text-[12px] text-gray-800">
                    {notification.message || notification.title || "Notification"}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {safeTimestamp(notification.timestamp || notification.createdAt)}
                  </div>
                </button>
              ))}

              {businessAlerts.length === 0 && unreadNotifications.length === 0 ? (
                <div className="text-[11px] text-gray-500 py-2 text-center">No pending alerts.</div>
              ) : null}

              {(businessAlerts.length > 0 || unreadNotifications.length > 0) && (
                <button
                  type="button"
                  onClick={() => navigate("Audit Log", "audit-log")}
                  className="mt-1 text-[#1557b0] hover:text-[#0f4a96] hover:underline text-[11px] font-medium block text-center w-full"
                >
                  View All Activity Logs
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT MENU PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
          {Object.entries(MENU_SECTIONS).map(([section, rows]) => (
            <React.Fragment key={section}>{renderMenuSection(section, rows)}</React.Fragment>
          ))}
        </div>
      </div>

      {/* SNAPSHOT */}
      <div className={`${panelClass} mt-3`}>
        <div className={sectionHeaderClass}>Business Snapshot</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50">
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
