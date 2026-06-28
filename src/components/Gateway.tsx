// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import GatewayTile from "./GatewayTile";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { formatADToBS, getBSTodayLong } from "../lib/nepaliDate";
import { formatNumber } from "../lib/utils";
import { useScreenF12 } from "../hooks/useF12Config";
import { 
  Database, 
  Users, 
  Package, 
  FileText, 
  Calculator, 
  BarChart3, 
  Settings, 
  Factory, 
  MessageSquare, 
  CalendarCheck, 
  Repeat, 
  Receipt, 
  Clock 
} from "lucide-react";

type PermissionScope = 
  | "accounting" 
  | "inventory" 
  | "billing" 
  | "reports" 
  | "masters" 
  | "settings"
  | "view_only";

interface GatewayMenuItem {
  label: string;
  page: string;
  permission?: PermissionScope;
}

const todayISO = () => new Date().toISOString().split("T")[0];
const money = (n: number) => "Rs. " + formatNumber(n || 0);

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
    { label: "Voucher Types", page: "voucher-types", permission: "accounting" },
    { label: "Warehouses", page: "warehouses", permission: "inventory" },
  ],
  VOUCHERS: [
    { label: "Sales Voucher", page: "sales", permission: "accounting" },
    { label: "Purchase Voucher", page: "purchase", permission: "accounting" },
    { label: "Payment Voucher", page: "payment", permission: "accounting" },
    { label: "Receipt Voucher", page: "receipt", permission: "accounting" },
    { label: "Journal Voucher", page: "journal", permission: "accounting" },
    { label: "Contra Voucher", page: "contra", permission: "accounting" },
    { label: "Credit Note", page: "credit-note", permission: "accounting" },
    { label: "Debit Note", page: "debit-note", permission: "accounting" },
  ],
  INVENTORY: [
    { label: "Stock Movement", page: "stock-movements", permission: "inventory" },
    { label: "Stock Valuation", page: "stock-valuation", permission: "inventory" },
    { label: "Stock Summary", page: "stock-summary", permission: "inventory" },
    { label: "Physical Stock", page: "physical-stock", permission: "inventory" },
    { label: "Stock Journal", page: "stock-journal", permission: "inventory" },
    { label: "Batch Tracking", page: "batch-tracking", permission: "inventory" },
    { label: "Serial Number Tracking", page: "serial-number-tracking", permission: "inventory" },
  ],
  ACCOUNTING: [
    { label: "General Ledger", page: "general-ledger", permission: "accounting" },
    { label: "Trial Balance", page: "trial-balance", permission: "accounting" },
    { label: "Profit & Loss", page: "profit-loss", permission: "accounting" },
    { label: "Balance Sheet", page: "balance-sheet", permission: "accounting" },
    { label: "Cash Flow Statement", page: "cash-flow", permission: "accounting" },
    { label: "Bank Reconciliation", page: "bank-reconciliation", permission: "accounting" },
    { label: "Day Book", page: "day-book", permission: "accounting" },
  ],
  REPORTS: [
    { label: "Sales Register", page: "sales-register", permission: "reports" },
    { label: "Purchase Register", page: "purchase-register", permission: "reports" },
    { label: "Ledger Report", page: "ledger-report", permission: "reports" },
    { label: "Ageing Report", page: "ageing-report", permission: "reports" },
    { label: "Bill Wise Pending", page: "bill-wise-pending", permission: "reports" },
    { label: "Stock Reports", page: "stock-reports", permission: "reports" },
    { label: "VAT Reports", page: "vat-reports", permission: "reports" },
    { label: "TDS Reports", page: "tds-reports", permission: "reports" },
  ],
  SETTINGS: [
    { label: "Company Settings", page: "settings", permission: "settings" },
    { label: "Fiscal Year", page: "fiscal-year", permission: "settings" },
    { label: "User Management", page: "user-management", permission: "settings" },
    { label: "Backup & Restore", page: "backup-restore", permission: "settings" },
    { label: "Audit Log", page: "audit-log", permission: "settings" },
    { label: "Permissions", page: "permissions", permission: "settings" },
  ]
};

const QUICK_ACTIONS = [
  { label: "Create New Party", page: "create-party", permission: "accounting" },
  { label: "Add New Item", page: "create-item", permission: "inventory" },
  { label: "Record Sale", page: "sales", permission: "accounting" },
  { label: "Record Purchase", page: "purchase", permission: "accounting" },
  { label: "Make Payment", page: "payment", permission: "accounting" },
  { label: "Receive Payment", page: "receipt", permission: "accounting" },
  { label: "View Cash Book", page: "cash-book", permission: "accounting" },
  { label: "View Day Book", page: "day-book", permission: "accounting" },
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

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const snapshot = useMemo(() => {
    const receivables = accounts
      .filter(acc => acc.type === 'Sundry Debtors')
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    
    const payables = accounts
      .filter(acc => acc.type === 'Sundry Creditors')
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    
    const cashBalance = accounts
      .filter(acc => acc.type === 'Cash-in-Hand')
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    
    const bankBalance = accounts
      .filter(acc => acc.type === 'Bank Accounts')
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    
    const todaysSales = invoices
      .filter(inv => inv.date === todayISO() && inv.type === 'sales')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    return { receivables, payables, cashBalance, bankBalance, todaysSales };
  }, [accounts, invoices]);

  const canSee = (item: GatewayMenuItem) => {
    const perm = item.permission;
    if (!perm) return true;
    if (perm === 'view_only') return true;
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.permissions) {
      return currentUser.permissions.includes(perm);
    }
    return false;
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: { section: string; item: GatewayMenuItem }[] = [];

    Object.entries(MENU_SECTIONS).forEach(([section, items]) => {
      items.forEach(item => {
        if (
          canSee(item) &&
          (item.label.toLowerCase().includes(query) || 
           section.toLowerCase().includes(query))
        ) {
          results.push({ section, item });
        }
      });
    });

    return results;
  }, [searchQuery, MENU_SECTIONS, canSee]);

  const navigate = (label: string, page: string) => {
    setCurrentPage(page);
    setSearchQuery("");
    setActiveSection(null);
  };

  const renderMenuSection = (section: string, sectionItems: GatewayMenuItem[]) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
        {sectionItems.filter(canSee).map((item, idx) => (
          <button key={idx} onClick={() => navigate(item.label, item.page)}
            className="text-left px-3 py-2 text-[12px] border border-gray-200 rounded hover:border-[#1557b0] hover:bg-[#e8f1ff] hover:text-[#1557b0] text-gray-700 transition-colors bg-white">
            {item.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa] overflow-hidden">
      {/* Row 1: Company Context Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1557b0] rounded flex items-center justify-center text-white text-[12px] font-bold">S</div>
            <div>
              <div className="text-[13px] font-semibold text-gray-800">{companySettings?.companyNameEn || companySettings?.name || "Company"}</div>
              <div className="text-[10px] text-gray-500">Sutra ERP • Nepal Edition</div>
            </div>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div className="text-[11px] text-gray-600">
            <span className="font-medium">FY:</span> {currentFiscalYear?.name || "—"}
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div className="text-[11px] text-gray-600">
            <span className="font-medium">Period:</span> <span className="text-green-600">Open</span>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div className="text-[11px] text-gray-600">
            <span className="font-medium">Today:</span> {new Date().toISOString().split("T")[0]} | {getBSTodayLong()}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-gray-500">
            <span className="font-medium">User:</span> {currentUser?.username || currentUser?.name || "—"}
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500" title="System Online" />
        </div>
      </div>

      {/* Row 2: Search Bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="relative max-w-xl">
          <input
            type="text"
            placeholder="Search modules, reports, masters... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
          {/* Search icon */}
          <svg className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
              {filteredItems.length > 0 ? filteredItems.map(({ section, item }, idx) => (
                <button key={idx} onClick={() => { navigate(item.label, item.page); setSearchQuery(""); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-[12px]">
                  <div className="font-medium text-gray-800">{item.label}</div>
                  <div className="text-[10px] text-gray-500">{section}</div>
                </button>
              )) : (
                <div className="px-4 py-3 text-[12px] text-gray-500">No results for "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Row 3: 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Receivables", value: money(snapshot.receivables), sub: "Outstanding from customers", page: "aging-report", color: "text-[#1557b0]" },
            { label: "Total Payables", value: money(snapshot.payables), sub: "Due to vendors", page: "bill-wise-pending", color: "text-[#dc2626]" },
            { label: "Cash + Bank Balance", value: money(snapshot.cashBalance + snapshot.bankBalance), sub: `Cash: ${money(snapshot.cashBalance)}`, page: "cash-book", color: "text-[#059669]" },
            { label: "Net Sales This Month", value: money(snapshot.todaysSales), sub: "Today's sales", page: "sales-register", color: "text-[#1557b0]" },
          ].map((kpi) => (
            <button key={kpi.label} onClick={() => navigate(kpi.label, kpi.page)}
              className="bg-white border border-gray-200 rounded-md p-3 text-left hover:border-[#1557b0] hover:shadow-sm transition-all cursor-pointer">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{kpi.label}</div>
              <div className={`text-[18px] font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</div>
            </button>
          ))}
        </div>

        {/* Row 4 + Row 5: Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT — Quick Actions column */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-white border border-gray-200 rounded-md p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Actions</div>
              <div className="space-y-1">
                {QUICK_ACTIONS.filter(canSee).map((action, idx) => (
                  <button key={idx} onClick={() => navigate(action.label, action.page)}
                    className="w-full text-left px-2 py-1.5 text-[12px] rounded hover:bg-[#e8f1ff] hover:text-[#1557b0] text-gray-700 transition-colors">
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Navigation</div>
              <nav className="space-y-0.5">
                {Object.keys(MENU_SECTIONS).map((section) => (
                  <button key={section} onClick={() => setActiveSection(activeSection === section ? null : section)}
                    className={`w-full text-left px-2 py-1.5 rounded text-[12px] flex justify-between items-center transition-colors ${
                      activeSection === section ? "bg-[#e8f1ff] text-[#1557b0] font-medium" : "hover:bg-gray-50 text-gray-700"
                    }`}>
                    <span>{section}</span>
                    <span className="text-[10px] text-gray-400">{MENU_SECTIONS[section].filter(canSee).length}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* RIGHT — Section content (4 cols) */}
          <div className="lg:col-span-4">
            {activeSection ? (
              <div className="bg-white border border-gray-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-semibold text-gray-800">{activeSection}</h2>
                  <button onClick={() => setActiveSection(null)} className="text-[12px] text-gray-500 hover:text-[#1557b0] px-2 py-1 rounded hover:bg-gray-50">✕ Close</button>
                </div>
                {renderMenuSection(activeSection, MENU_SECTIONS[activeSection])}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {Object.entries(MENU_SECTIONS).map(([section, items]) => {
                  const visibleItems = items.filter(canSee);
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={section} className="bg-white border border-gray-200 rounded-md p-3">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2 pb-1.5 border-b border-gray-100">{section}</div>
                      <div className="space-y-0.5">
                        {visibleItems.slice(0, 8).map((item, idx) => (
                          <button key={idx} onClick={() => navigate(item.label, item.page)}
                            className="w-full text-left px-2 py-1 text-[12px] rounded hover:bg-[#e8f1ff] hover:text-[#1557b0] text-gray-700 transition-colors">
                            {item.label}
                          </button>
                        ))}
                        {visibleItems.length > 8 && (
                          <button onClick={() => setActiveSection(section)}
                            className="w-full text-left px-2 py-1 text-[11px] text-[#1557b0] hover:underline">
                            +{visibleItems.length - 8} more...
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gateway;
