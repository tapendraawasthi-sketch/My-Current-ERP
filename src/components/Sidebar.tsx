import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getCurrentStock } from "../lib/stockUtils";
import { 
  LayoutDashboard, FolderOpen, Users, Package, Tags, BookOpen, Wallet, 
  Download, ArrowLeftRight, ScrollText, FileText, CreditCard, ShoppingCart, 
  ClipboardList, Truck, Archive, RefreshCw, Store, Scale, TrendingUp, 
  TrendingDown, BarChart2, Activity, FileBarChart, BookMarked, Calendar, 
  Banknote, Landmark, Layers, PieChart, Map, Settings, Shield, Database, 
  FileClock, ChevronDown, ChevronRight, LogOut, Sliders, ChevronLeft 
} from "lucide-react";

interface NavItem {
  label: string;
  nepaliLabel?: string;
  page: string;
  icon: React.ComponentType<{ className?: string, size?: number }>;
}

interface MenuGroup {
  title: string;
  items: NavItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Gateway",
    items: [
      { label: "Dashboard", page: "dashboard", icon: LayoutDashboard },
      { label: "Reports Hub", page: "reports-hub", icon: BarChart2 },
      { label: "Configuration Hub", page: "configuration-hub", icon: Sliders },
      { label: "Data Import/Export", page: "data-import-export", icon: Download },
    ],
  },
  {
    title: "Overview",
    items: [
      { label: "Dashboard", page: "dashboard", icon: LayoutDashboard },
      { label: "Day Book", page: "day-book", icon: FileText },
      { label: "General Ledger", page: "general-ledger", icon: BookOpen },
      { label: "Trial Balance", page: "trial-balance", icon: FileText },
      { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
      { label: "Balance Sheet", page: "balance-sheet", icon: FileText },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Master Control Centre", page: "master-control-centre", icon: LayoutDashboard },
      { label: "Chart of Accounts", page: "accounts", icon: FolderOpen },
      { label: "Ledger Master", page: "ledgers", icon: BookOpen },
      { label: "Parties Directory", page: "parties", icon: Users },
      { label: "Stock Items", page: "items", icon: Package },
      { label: "Cost Centers", page: "cost-centers", icon: Map },
      { label: "Warehouses / Godowns", page: "warehouses", icon: Archive },
      { label: "Units of Measure", page: "units", icon: Tags },
      { label: "Bank Accounts", page: "bank-accounts", icon: Landmark },
    ],
  },
  {
    title: "Inventory Masters",
    items: [
      { label: "Item Groups", page: "item-groups", icon: Layers },
      { label: "Stock Categories", page: "stock-categories", icon: FolderOpen },
      { label: "Unit Conversions", page: "unit-conversions", icon: ArrowLeftRight },
      { label: "Reorder Levels", page: "reorder-levels", icon: RefreshCw },
      { label: "Price Levels", page: "price-levels", icon: Tags },
      { label: "Price Lists", page: "price-lists", icon: FileText },
      { label: "HS Codes (Nepal)", page: "hs-codes", icon: FileBarChart },
      { label: "Batch Master", page: "batches", icon: Archive },
    ],
  },
  {
    title: "Accounting Masters",
    items: [
      { label: "Account Groups", page: "account-groups", icon: FolderOpen },
      { label: "Voucher Types", page: "voucher-types", icon: ScrollText },
      { label: "Cost Categories", page: "cost-categories", icon: Map },
      { label: "Cost Centre Classes", page: "cost-centre-classes", icon: Layers },
      { label: "Budget Master", page: "budget", icon: TrendingUp },
      { label: "Scenario Master", page: "scenarios", icon: Activity },
      { label: "Currency Master", page: "currency-master", icon: Banknote },
    ],
  },
  {
    title: "Statutory Masters (Nepal)",
    items: [
      { label: "VAT Classifications", page: "vat-classifications", icon: FileBarChart },
      { label: "TDS Nature of Payment", page: "tds-nature-of-payments", icon: FileText },
      { label: "Sale Types (VAT)", page: "sale-types", icon: TrendingUp },
      { label: "Purchase Types", page: "purchase-types", icon: TrendingDown },
      { label: "Tax Categories", page: "tax-categories", icon: FileBarChart },
      { label: "Bill Sundries", page: "bill-sundries", icon: FileText },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Vouchers Log", page: "vouchers-log", icon: FileText },
      { label: "Journal Entries", page: "journal", icon: FileText },
      { label: "Payment Voucher", page: "payment", icon: CreditCard },
      { label: "Receipt Voucher", page: "receipt", icon: Wallet },
      { label: "Sales Invoice", page: "sales-invoice", icon: ShoppingCart },
      { label: "Purchase Invoice", page: "purchase-invoice", icon: Truck },
      { label: "Delivery Challan", page: "delivery-challan", icon: Package },
      { label: "Goods Receipt Note", page: "grn", icon: Package },
      { label: "Stock Journal", page: "stock-journal", icon: ArrowLeftRight },
      { label: "Debit/Credit Note", page: "debit-note", icon: FileText },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock Book", page: "stock-book", icon: Package },
      { label: "Stock Summary", page: "stock-summary", icon: Package },
      { label: "Stock Valuation", page: "stock-valuation", icon: Scale },
      { label: "Reorder Alerts", page: "reorder-alerts", icon: RefreshCw },
      { label: "Physical Stock", page: "physical-stock", icon: Package },
    ],
  },
  {
    title: "Books",
    items: [
      { label: "Day Book", page: "day-book", icon: FileText },
      { label: "Cash Book", page: "cash-book", icon: Wallet },
      { label: "Bank Book", page: "bank-book", icon: Landmark },
      { label: "Ledger Report", page: "ledger-report", icon: BookOpen },
      { label: "Trial Balance", page: "trial-balance", icon: FileText },
      { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
      { label: "Balance Sheet", page: "balance-sheet", icon: FileText },
    ],
  },
  {
    title: "Payroll",
    items: [
      { label: "Payroll Run", page: "payroll-run", icon: ClipboardList },
    ],
  },
  {
    title: "Payroll Masters",
    items: [
      { label: "Employees", page: "employees", icon: Users },
      { label: "Employee Groups", page: "employee-groups", icon: Users },
      { label: "Pay Heads", page: "pay-heads", icon: Banknote },
      { label: "Salary Details", page: "salary-details", icon: ClipboardList },
      { label: "Payroll Units", page: "payroll-units", icon: Tags },
      { label: "Attendance Types", page: "attendance-types", icon: Calendar },
      { label: "Payroll Run", page: "payroll-run", icon: ClipboardList },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Day Book", page: "day-book", icon: FileText },
      { label: "Cash Flow", page: "cash-flow", icon: TrendingUp },
      { label: "Balance Sheet", page: "balance-sheet", icon: FileText },
      { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
      { label: "Stock Summary", page: "stock-summary", icon: Package },
      { label: "Stock Valuation", page: "stock-valuation", icon: Scale },
      { label: "Sales Analysis", page: "sales-analysis", icon: TrendingUp },
      { label: "Purchase Analysis", page: "purchase-analysis", icon: TrendingDown },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "User Management", page: "users", icon: Users },
      { label: "System Settings", page: "settings", icon: Settings },
      { label: "Backup & Restore", page: "backup", icon: Database },
      { label: "Audit Logs", page: "audit-log", icon: Shield },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Company Settings", page: "company-settings", icon: Settings },
      { label: "Fiscal Years", page: "fiscal-year", icon: Calendar },
      { label: "Voucher Types", page: "voucher-types", icon: ScrollText },
      { label: "Account Groups", page: "account-groups", icon: FolderOpen },
    ],
  },
  {
    title: "Bulk Operations",
    items: [
      { label: "Import Vouchers", page: "import-vouchers", icon: Download },
      { label: "Import Items", page: "import-items", icon: Download },
      { label: "Import Parties", page: "import-parties", icon: Download },
      { label: "Import Stock", page: "import-stock", icon: Download },
    ],
  },
  {
    title: "Misc Entry",
    items: [
      { label: "Misc Data Entry", page: "misc-data-entry", icon: FileText },
    ],
  },
];

const Sidebar: React.FC<{ collapsed: boolean; setCollapsed: (b: boolean) => void }> = ({ collapsed, setCollapsed }) => {
  const { currentPage, setCurrentPage, currentUser, logout, currentFiscalYear, companySettings, users, items, stockMovements } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Gateway: true, Overview: true, Masters: false, Transactions: true, Payroll: false,
    Inventory: false, Books: false, Reports: false, Admin: false,
    "Inventory Masters": false,
    "Accounting Masters": false,
    "Statutory Masters (Nepal)": false,
    "Payroll Masters": false,
    Configuration: false, "Bulk Operations": false, "Misc Entry": false,
  });

  const toggleGroup = (title: string) => {
    if (collapsed) {
      setCollapsed(false);
      setExpandedGroups(prev => ({ ...prev, [title]: true }));
      return;
    }
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const reorderAlertCount = useMemo(() => {
    return items.filter((i) => {
      if (!i.reorderLevel) return false;
      const stock = getCurrentStock(i.id, undefined, stockMovements);
      return stock <= i.reorderLevel;
    }).length;
  }, [items, stockMovements]);

  const currentCompany = companySettings?.name || "Company";
  const currentFY = currentFiscalYear?.year || "FY";
  const userCount = users.length;

  const renderedGroups = useMemo(() => {
    return menuGroups.map(group => {
      const isExpanded = expandedGroups[group.title] ?? false;
      const visibleItems = isExpanded || collapsed ? group.items : [];

      return (
        <div key={group.title} className="mb-2">
          {!collapsed ? (
            <button
              className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-200 transition-colors"
              onClick={() => toggleGroup(group.title)}
            >
              <span>{group.title}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          ) : (
            <div className="h-px bg-[#2d3748] mx-2 my-2" />
          )}
          
          {(isExpanded || collapsed) && (
            <div className="mt-1 space-y-0.5">
              {visibleItems.map(item => {
                const isActive = currentPage === item.page;
                return (
                  <button
                    key={item.page + item.label}
                    className={`
                      w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors relative
                      ${isActive 
                        ? "bg-[#1557b0] text-white" 
                        : "text-gray-300 hover:bg-[#273148] hover:text-white"
                      }
                      ${collapsed ? "justify-center" : "justify-start"}
                    `}
                    onClick={() => setCurrentPage(item.page)}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="flex-shrink-0">
                      <item.icon size={14} className={isActive ? "text-white" : "text-gray-400"} />
                    </div>
                    {!collapsed && (
                      <span className="text-[12px] truncate">{item.label}</span>
                    )}
                    {!collapsed && item.page === "items" && reorderAlertCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {reorderAlertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }, [expandedGroups, currentPage, setCurrentPage, collapsed, reorderAlertCount]);

  return (
    <aside
      className={`h-full bg-[#1e2433] border-r border-[#2d3748] flex flex-col transition-all duration-300 ease-in-out shrink-0 ${
        collapsed ? "w-[48px]" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="h-12 border-b border-[#2d3748] flex items-center px-3 justify-between shrink-0">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#1557b0] flex items-center justify-center text-white font-bold text-xs shrink-0">
                S
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-bold text-white leading-tight">Sutra</span>
                <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-widest leading-none">ERP Cloud</span>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#273148] rounded transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        ) : (
          <div
            className="w-6 h-6 mx-auto rounded-md bg-[#1557b0] flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:bg-blue-600 transition-colors"
            onClick={() => setCollapsed(false)}
          >
            S
          </div>
        )}
      </div>

      {/* FY Tag */}
      {!collapsed && currentFiscalYear && (
        <div className="m-3 p-2 bg-[#273148] border border-[#2d3748] rounded-md">
          <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Active FY</div>
          <div className="text-[11px] font-medium text-gray-200 mt-0.5">{currentFiscalYear.name} BS</div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto sidebar-scroll py-2">
        {renderedGroups}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#2d3748]">
        {!collapsed && currentUser && (
          <div className="flex items-center gap-2 p-3 bg-[#1e2433] border-b border-[#2d3748]">
            <div className="w-7 h-7 rounded-full bg-[#273148] flex items-center justify-center text-[11px] font-bold text-gray-300">
              {currentUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-gray-200 truncate">{currentUser.name}</span>
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{currentUser.role}</span>
            </div>
          </div>
        )}
        
        <div className="p-1.5 flex flex-col gap-0.5">
          <button
            onClick={() => setCurrentPage("settings")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-gray-300 hover:text-white hover:bg-[#273148] transition-colors ${collapsed ? "justify-center" : "justify-start"}`}
          >
            <Sliders size={14} />
            {!collapsed && <span className="text-[11px]">Settings</span>}
          </button>
          <button
            onClick={logout}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-[#273148] transition-colors ${collapsed ? "justify-center" : "justify-start"}`}
          >
            <LogOut size={14} />
            {!collapsed && <span className="text-[11px]">Logout</span>}
          </button>
        </div>
        
        {!collapsed && (
          <div className="text-center text-[9px] py-2 text-gray-500 border-t border-[#2d3748]">
            Sutra ERP v2.0 · Nepal Edition
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
