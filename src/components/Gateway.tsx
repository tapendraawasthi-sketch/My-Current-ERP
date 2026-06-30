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
import { PaymentStatus, VoucherStatus, VoucherType } from "../lib/types";
import { useScreenF12 } from "../hooks/useF12Config";

type PermissionScope = "all" | "accounting" | "admin";

interface GatewayMenuItem {
  label: string;
  page: string;
  permission?: PermissionScope;
}

const todayISO = () => new Date().toISOString().split("T")[0];
const money = (value: number) => {
  const num = Number(value) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const MENU_SECTIONS: Record<string, GatewayMenuItem[]> = {
  MASTERS: [
    { label: "Master Control Centre", page: "master-control-centre", permission: "accounting" },
    { label: "Chart of Accounts", page: "accounts", permission: "accounting" },
    { label: "Ledgers", page: "ledgers", permission: "accounting" },
    { label: "Account Groups", page: "account-groups", permission: "accounting" },
    { label: "Parties Directory", page: "parties", permission: "accounting" },
    { label: "Stock Items", page: "items", permission: "accounting" },
    { label: "Item Groups", page: "item-groups", permission: "accounting" },
    { label: "Units of Measure", page: "units", permission: "accounting" },
    { label: "Cost Centers", page: "cost-centers", permission: "accounting" },
    { label: "Bank Accounts", page: "bank-accounts", permission: "accounting" },
    { label: "Employees", page: "employees", permission: "accounting" },
    { label: "TDS Natures of Payment", page: "tds-nature-of-payments", permission: "accounting" },
    { label: "Employee Groups", page: "employee-groups", permission: "accounting" },
    { label: "Pay Heads", page: "pay-heads", permission: "accounting" },
    { label: "Salary Details", page: "salary-details", permission: "accounting" },
    { label: "Payroll Units", page: "payroll-units", permission: "accounting" },
    { label: "Attendance Types", page: "attendance-types", permission: "accounting" },
    { label: "Voucher Types", page: "voucher-types", permission: "accounting" },
    { label: "Budget Master", page: "budget", permission: "accounting" },
    { label: "Currency Master", page: "currency-master", permission: "accounting" },
    { label: "Standard Narrations", page: "standard-narrations", permission: "accounting" },
    { label: "Tax Categories", page: "tax-categories", permission: "accounting" },
    { label: "Sale Types", page: "sale-types", permission: "accounting" },
    { label: "Purchase Types", page: "purchase-types", permission: "accounting" },
  ],

  TRANSACTIONS: [
    { label: "New Sales Invoice", page: "billing", permission: "accounting" },
    { label: "New Purchase Invoice", page: "purchase", permission: "accounting" },
    { label: "New Receipt", page: "receipt", permission: "accounting" },
    { label: "New Payment", page: "payment", permission: "accounting" },
    { label: "New Journal", page: "journal", permission: "accounting" },
    { label: "New Contra", page: "contra", permission: "accounting" },
    { label: "New Debit Note", page: "debit-note", permission: "accounting" },
    { label: "New Credit Note", page: "credit-note", permission: "accounting" },
    { label: "Sales Order", page: "sales-order", permission: "accounting" },
    { label: "Purchase Order", page: "purchase-order", permission: "accounting" },
    { label: "Delivery Challan", page: "delivery-challan", permission: "accounting" },
    { label: "Scenarios", page: "scenarios", permission: "accounting" },
    { label: "Warehouses", page: "warehouses", permission: "accounting" },
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
    { label: "Stock Summary", page: "stock-summary", permission: "accounting" },
    { label: "VAT Reports", page: "vat-reports", permission: "accounting" },
    { label: "TDS Report", page: "tds-report", permission: "accounting" },
    { label: "Bill-wise Pending", page: "bill-wise-pending", permission: "accounting" },
    { label: "Party Ledger", page: "party-ledger", permission: "accounting" },
    { label: "Cost Center Report", page: "cost-center-report", permission: "accounting" },
    { label: "Budget vs Actual", page: "budget-vs-actual", permission: "accounting" },
    { label: "Vouchers Log", page: "vouchers-log", permission: "accounting" },
    { label: "Aging Report", page: "aging-report", permission: "accounting" },
  ],

  BANKING: [
    { label: "Banking Hub", page: "banking-hub", permission: "accounting" },
    { label: "Cheque Printing", page: "cheque-printing", permission: "accounting" },
    { label: "Cheque Register", page: "cheque-register", permission: "accounting" },
    { label: "Deposit Slip", page: "deposit-slip", permission: "accounting" },
    { label: "Payment Advice", page: "payment-advice", permission: "accounting" },
    { label: "Bank Reconciliation", page: "bank-reconciliation", permission: "accounting" },
    {
      label: "Auto Bank Reconciliation",
      page: "auto-bank-reconciliation",
      permission: "accounting",
    },
    { label: "e-Payments", page: "e-payments", permission: "accounting" },
    { label: "PDC Summary", page: "pdc-summary", permission: "accounting" },
  ],

  UTILITIES: [
    { label: "Data Export/Import", page: "data-export-import", permission: "accounting" },
    { label: "Backup & Restore", page: "backup", permission: "admin" },
    { label: "Audit Log", page: "audit-log", permission: "admin" },
    { label: "Users Management", page: "users", permission: "admin" },
    { label: "Company Settings", page: "settings", permission: "admin" },
    { label: "F11: Company Features", page: "f11-company-features", permission: "admin" },
    { label: "Fiscal Year", page: "fiscal-year", permission: "admin" },
    { label: "Opening Balance", page: "opening-balance", permission: "accounting" },
    { label: "Overdue Bills Interest", page: "overdue-bills-interest", permission: "accounting" },
    { label: "Bulk Updations", page: "bulk-updations", permission: "accounting" },
  ],
};

const QUICK_ACTIONS: GatewayMenuItem[] = [
  { label: "New Sales Invoice", page: "billing", permission: "accounting" },
  { label: "New Purchase Invoice", page: "purchase", permission: "accounting" },
  { label: "New Receipt", page: "receipt", permission: "accounting" },
  { label: "New Payment", page: "payment", permission: "accounting" },
  { label: "New Journal", page: "journal", permission: "accounting" },
  { label: "Bank Reconciliation", page: "bank-reconciliation", permission: "accounting" },
  { label: "VAT Reports", page: "vat-reports", permission: "accounting" },
  { label: "Day Book", page: "day-book", permission: "accounting" },
];

const Gateway: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("global");

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

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const mastersRef = useRef<HTMLDivElement>(null);
  const transactionsRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);
  const utilitiesRef = useRef<HTMLDivElement>(null);
  const bankingRef = useRef<HTMLDivElement>(null);

  // Dashboard snapshot computed locally from store data
  useEffect(() => {
    // Notifications and recent activities are loaded via initializeApp
  }, []);

  useEffect(() => {
    if (storeActiveVoucherDate) {
      setActiveVoucherDate(storeActiveVoucherDate);
    } else {
      setActiveVoucherDate(todayISO());
    }
  }, [storeActiveVoucherDate]);

  const role = currentUser?.role;

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

  const { pushActivity } = useRecentActivity();

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

  const stockPositions = useMemo(() => {
    try {
      return computeAllStockPositions(stockMovements, items);
    } catch {
      return [];
    }
  }, [stockMovements, items]);
  const snapshot = useMemo(() => {
    const today = todayISO();
    const postedVouchers = (vouchers || []).filter((v: any) => v.status === "posted");

    // Cash balance from cash accounts
    const cashAccounts = (accounts || []).filter((a: any) =>
      a.name?.toLowerCase().includes("cash"),
    );
    const cashBalance = cashAccounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);

    // Bank balance from bank accounts
    const bankAccounts = (accounts || []).filter(
      (a: any) => a.type === "bank" || a.name?.toLowerCase().includes("bank"),
    );
    const bankBalance = bankAccounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);

    // Receivables from unpaid/partial sales invoices
    const receivables = (invoices || [])
      .filter(
        (i: any) =>
          (i.type === "sales-invoice" || i.type === "sales_invoice") &&
          i.status === "posted" &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"),
      )
      .reduce((sum: number, i: any) => sum + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0);

    // Payables from unpaid/partial purchase invoices
    const payables = (invoices || [])
      .filter(
        (i: any) =>
          (i.type === "purchase-invoice" || i.type === "purchase_invoice") &&
          i.status === "posted" &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"),
      )
      .reduce((sum: number, i: any) => sum + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0);

    // Today's sales
    const todaysSales = (invoices || [])
      .filter(
        (i: any) =>
          i.date === today &&
          (i.type === "sales-invoice" || i.type === "sales_invoice") &&
          i.status === "posted",
      )
      .reduce((sum: number, i: any) => sum + (i.grandTotal || 0), 0);

    // Today's purchases
    const todaysPurchases = (invoices || [])
      .filter(
        (i: any) =>
          i.date === today &&
          (i.type === "purchase-invoice" || i.type === "purchase_invoice") &&
          i.status === "posted",
      )
      .reduce((sum: number, i: any) => sum + (i.grandTotal || 0), 0);

    // VAT Liability
    const outputVat = (invoices || [])
      .filter((i: any) => (i.type === "sales-invoice" || i.type === "sales_invoice") && i.status === "posted")
      .reduce((sum: number, i: any) => sum + (Number(i.vatAmount) || 0), 0);
    const inputVat = (invoices || [])
      .filter((i: any) => (i.type === "purchase-invoice" || i.type === "purchase_invoice") && i.status === "posted")
      .reduce((sum: number, i: any) => sum + (Number(i.vatAmount) || 0), 0);
    const vatPayable = Math.max(0, outputVat - inputVat);

    // Stock value
    const stockValue = stockPositions.reduce((sum: number, sp: any) => sum + (sp.value || 0), 0);

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
  }, [vouchers, accounts, invoices, stockPositions]);

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "No company configured";
  const fiscalYearLabel =
    currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || "No active fiscal year";

  const sectionRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    MASTERS: mastersRef,
    TRANSACTIONS: transactionsRef,
    REPORTS: reportsRef,
    BANKING: bankingRef,
    UTILITIES: utilitiesRef,
  };

  const renderMenuSection = (section: string, rows: GatewayMenuItem[]) => {
    const visibleRows = rows.filter(canSee);
    return (
      <div key={section} ref={sectionRefs[section]} className="space-y-1">
        {visibleRows.map((item, idx) => (
          <button
            key={idx}
            onClick={() => navigate(item.label, item.page)}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-[#EBF5E2] transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return [];

    const allItems: { section: string; item: GatewayMenuItem }[] = [];
    Object.entries(MENU_SECTIONS).forEach(([section, items]) => {
      items.forEach((item) => {
        if (canSee(item) && item.label.toLowerCase().includes(searchQuery.toLowerCase())) {
          allItems.push({ section, item });
        }
      });
    });

    return allItems;
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{companyName}</h1>
            <p className="text-sm text-gray-500">
              {fiscalYearLabel} • {getBSTodayLong()}
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-sm"
            />
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-10 max-h-60 overflow-y-auto">
                {filteredItems.length > 0 ? (
                  filteredItems.map(({ section, item }, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(item.label, item.page);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{section}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-gray-500">No results found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {searchQuery ? (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Search Results</h2>
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map(({ section, item }, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      navigate(item.label, item.page);
                      setSearchQuery("");
                    }}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-[#1557b0] transition-all cursor-pointer"
                  >
                    <div className="font-medium text-gray-800">{item.label}</div>
                    <div className="text-xs text-gray-500">{section}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No features found matching "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Quick Stats */}
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

            {/* Navigation Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Sidebar Navigation */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-3">Navigation</h2>
                  <nav className="space-y-1">
                    {Object.keys(MENU_SECTIONS).map((section) => (
                      <button
                        key={section}
                        onClick={() => setActiveSection(activeSection === section ? null : section)}
                        className={`w-full text-left px-3 py-2 rounded flex justify-between items-center ${
                          activeSection === section
                            ? "bg-[#eef2ff] text-[#1557b0] font-medium"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {section}
                        <span className="text-xs">
                          {Object.values(MENU_SECTIONS[section]).filter(canSee).length}
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-3">Quick Actions</h2>
                  <div className="space-y-2">
                    {QUICK_ACTIONS.filter(canSee).map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigate(action.label, action.page)}
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-50 text-gray-700 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="lg:col-span-4">
                {activeSection ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-gray-800">{activeSection}</h2>
                      <button
                        onClick={() => setActiveSection(null)}
                        className="text-sm text-gray-500 hover:text-[#1557b0]"
                      >
                        Close
                      </button>
                    </div>
                    {renderMenuSection(activeSection, MENU_SECTIONS[activeSection])}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(MENU_SECTIONS).map(([section, items]) => {
                      const visibleItems = items.filter(canSee);
                      if (visibleItems.length === 0) return null;

                      return (
                        <div
                          key={section}
                          className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
                        >
                          <h2 className="text-lg font-bold text-gray-800 mb-4">{section}</h2>
                          <div className="space-y-2">
                            {visibleItems.map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => navigate(item.label, item.page)}
                                className="w-full text-left px-3 py-2 text-sm rounded text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gateway;

// ===END OF FILE===
