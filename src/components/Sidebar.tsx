/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import SutraLogo from "./SutraLogo";
import Tooltip from "./ui/Tooltip";
import { getCurrentStock } from "../lib/stockUtils";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Package,
  Tags,
  UserCog,
  BookOpen,
  Wallet,
  Download,
  ArrowLeftRight,
  ScrollText,
  FileText,
  CreditCard,
  ShoppingCart,
  ClipboardList,
  Truck,
  Archive,
  RefreshCw,
  Store,
  Scale,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Activity,
  FileBarChart,
  DollarSign,
  AlertCircle,
  BookMarked,
  Calendar,
  Banknote,
  Landmark,
  Layers,
  PieChart,
  Building,
  Map,
  Settings,
  Shield,
  Database,
  FileClock,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sliders,
  ShieldCheck,
  ChevronLeft,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (b: boolean) => void;
}

interface NavItem {
  label: string;
  page: string;
  subPage?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  title: string;
  items: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const {
    currentPage,
    setCurrentPage,
    currentUser,
    logout,
    reportFilters,
    setReportFilters,
    currentFiscalYear,
    items,
    stockMovements,
  } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Overview: true, Masters: false, Transactions: true, Payroll: true, Inventory: false, "Accounts Books": false, Reports: false, Administration: false });

  const reorderAlertCount = useMemo(() => {
    return items.filter(i => {
      if (!i.reorderLevel) return false;
      const stock = getCurrentStock(i.id, undefined, stockMovements);
      return stock <= i.reorderLevel;
    }).length;
  }, [items, stockMovements]);

  const menuGroups: MenuGroup[] = [
    {
      title: "Overview",
      items: [{ label: "Dashboard", page: "dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Masters",
      items: [
        { label: "Chart of Accounts", page: "accounts", icon: FolderOpen },
        { label: "Parties Directory", page: "parties", icon: Users },
        { label: "Stock Items", page: "items", icon: Package },
        { label: "Cost Centers", page: "cost-centers", icon: Map },
        { label: "Warehouses", page: "warehouses", icon: Archive },
        { label: "Units of Measure", page: "units", icon: Tags },
        { label: "Bank Accounts", page: "accounts", icon: Landmark },
      ],
    },
    {
      title: "Transactions",
      items: [
        { label: "Sales Invoice", page: "sales-invoice", icon: FileText },
        { label: "Purchase Invoice", page: "purchase-invoice", icon: FileText },
        { label: "Sales Return", page: "sales-return", icon: RefreshCw },
        { label: "Purchase Return", page: "purchase-return", icon: RefreshCw },
        { label: "Receipt Voucher", page: "receipt", icon: Download },
        { label: "Payment Voucher", page: "payment", icon: Wallet },
        { label: "Journal Voucher", page: "journal", icon: BookOpen },
        { label: "Contra Voucher", page: "contra", icon: ArrowLeftRight },
        { label: "Debit Note", page: "debit-note", icon: CreditCard },
        { label: "Credit Note", page: "credit-note", icon: CreditCard },
      ],
    },
    {
      title: "Payroll",
      items: [
        { label: "Employees", page: "employees", icon: Users },
        { label: "Payroll Run", page: "payroll-run", icon: ClipboardList },
        { label: "Payslip", page: "payslip", icon: FileText },
      ],
    },
    {
      title: "Inventory",
      items: [
        { label: "Sales Orders", page: "sales-order", icon: ShoppingCart },
        { label: "Purchase Orders", page: "purchase-order", icon: ClipboardList },
        { label: "Delivery Challan", page: "delivery-challan", icon: Truck },
        { label: "Goods Receipt Note", page: "grn", icon: Archive },
        { label: "Stock Journal", page: "stock-journal", icon: ArrowLeftRight },
        { label: "POS/Counter Sale", page: "pos", icon: Store },
      ],
    },
    {
      title: "Accounts Books",
      items: [
        { label: "Day Book", page: "day-book", icon: Calendar },
        { label: "Cash Book", page: "cash-book", icon: Banknote },
        { label: "Bank Book", page: "bank-book", icon: Landmark },
        { label: "General Ledger", page: "ledger", icon: BookOpen },
        { label: "Party Ledger", page: "party-statement", icon: BookMarked },
        { label: "Vouchers Register", page: "vouchers", icon: ScrollText },
        { label: "Bank Reconciliation", page: "bank-reconciliation", icon: Landmark },
      ],
    },
    {
      title: "Reports",
      items: [
        { label: "Trial Balance", page: "trial-balance", icon: Scale },
        { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
        { label: "Balance Sheet", page: "balance-sheet", icon: BarChart2 },
        { label: "Ratio Analysis", page: "ratio-analysis", icon: FileBarChart },
        { label: "Cash Flow", page: "cash-flow", icon: Activity },
        { label: "Sales Register", page: "sales-register", icon: TrendingUp },
        { label: "Purchase Register", page: "purchase-register", icon: TrendingDown },
        { label: "Stock Summary", page: "stock-summary", icon: PieChart },
        { label: "Inventory Report", page: "inventory-report", icon: Layers },
        { label: "Aging Report", page: "aging-report", icon: AlertCircle },
        { label: "Bill-wise Pending", page: "bill-pending", icon: FileClock },
        { label: "VAT Report", page: "vat-reports", icon: FileBarChart },
        { label: "TDS Report", page: "tds-report", icon: DollarSign },
        { label: "Cost Center Report", page: "cost-center-report", icon: Map },
        { label: "Budget vs Actual", page: "budget-vs-actual", icon: TrendingUp },
      ],
    },
    {
      title: "Administration",
      items: [
        { label: "Company Settings", page: "settings", icon: Settings },
        { label: "Fiscal Year", page: "fiscal-year", icon: Calendar },
        { label: "Users & Roles", page: "users", icon: Shield },
        { label: "Budget Master", page: "budget", icon: ScrollText },
        { label: "Recurring Vouchers", page: "recurring-vouchers", icon: RefreshCw },
        { label: "Audit Log", page: "audit-log", icon: FileClock },
        { label: "Backup & Restore", page: "backup", icon: Database },
      ],
    },
  ];

  const handleGroupToggle = (groupTitle: string) => {
    if (collapsed) {
      setCollapsed(false);
      setExpandedGroups((prev) => ({ ...prev, [groupTitle]: true }));
      return;
    }
    setExpandedGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  const handleNavigation = (item: NavItem) => {
    setCurrentPage(item.page);
    if (item.subPage) {
      setReportFilters({ selectedReport: item.subPage });
    }
  };

  const isItemActive = (item: NavItem): boolean => {
    if (currentPage !== item.page) return false;
    if (item.subPage && reportFilters.selectedReport !== item.subPage) return false;
    return true;
  };

  return (
    <aside
      className={`flex flex-col h-full overflow-hidden select-none transition-all duration-200 relative shrink-0 ${collapsed ? "w-[48px]" : "w-[216px]"}`}
      style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* Header */}
      <div className="h-11 flex items-center justify-between px-2.5 shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-[#1557b0] flex items-center justify-center text-white font-bold text-sm shrink-0">S</div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-bold text-white">Sutra</span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">ERP Cloud</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto h-6 w-6 rounded-md bg-[#1557b0] flex items-center justify-center text-white font-bold text-sm">S</div>
        )}
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#1e3060] transition-colors" title="Collapse">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Fiscal Year tag */}
      {!collapsed && currentFiscalYear && (
        <div className="mx-2.5 mt-2 mb-1 px-2 py-1 rounded" style={{ background: "#0f1b35" }}>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Active FY</div>
          <div className="text-[10px] font-semibold text-slate-300 mt-0.5">{currentFiscalYear.name}</div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-1.5">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title] !== false;
          return (
            <div key={group.title} className="mb-1">
              {!collapsed ? (
                <button type="button" onClick={() => handleGroupToggle(group.title)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors text-left"
                  style={{ color: "#475c8a" }}>
                  <span>{group.title}</span>
                  {isExpanded ? <ChevronDown className="h-3 w-3 opacity-60" /> : <ChevronRight className="h-3 w-3 opacity-60" />}
                </button>
              ) : (
                <div className="h-px mx-2 my-1.5" style={{ background: "var(--sidebar-border)" }} />
              )}
              {(isExpanded || collapsed) && (
                <div className="flex flex-col">
                  {group.items.map((item) => {
                    const active = isItemActive(item);
                    const Icon = item.icon;
                    const btn = (
                      <button type="button" onClick={() => handleNavigation(item)} title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 text-[12px] font-medium transition-all relative ${collapsed ? "justify-center py-2 px-0" : "px-3 py-[6px]"} ${active ? "text-white" : "hover:text-slate-100 text-slate-400"}`}
                        style={active ? { background: "var(--sidebar-accent)", borderLeft: "3px solid #3b82f6", paddingLeft: collapsed ? undefined : "9px" } : { borderLeft: "3px solid transparent" }}>
                        <Icon className={`shrink-0 ${collapsed ? "h-4 w-4" : "h-[14px] w-[14px]"} ${active ? "text-[#60a5fa]" : "text-slate-500"}`} />
                        {!collapsed && <span className="truncate leading-none flex-1">{item.label}</span>}
                        {!collapsed && item.label === "Stock Items" && reorderAlertCount > 0 && (
                          <span className="ml-auto bg-amber-500 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {reorderAlertCount}
                          </span>
                        )}
                        {collapsed && item.label === "Stock Items" && reorderAlertCount > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                        )}
                      </button>
                    );
                    return (
                      <React.Fragment key={`${item.label}-${item.page}`}>
                        {collapsed ? <Tooltip content={item.label} position="right">{btn}</Tooltip> : btn}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        {!collapsed && currentUser && (
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#0f1b35" }}>
            <div className="h-7 w-7 rounded-full bg-[#1557b0] flex items-center justify-center text-[11px] font-bold text-white flex-none border border-blue-500">
              {currentUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-bold text-slate-100 truncate">{currentUser.name}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{currentUser.role}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-0 py-1 px-1">
          <button type="button" onClick={() => setCurrentPage("settings")}
            className={`w-full flex items-center gap-2.5 text-[11px] text-slate-400 hover:bg-[#1e3060] hover:text-slate-100 rounded transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}>
            <Sliders className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="font-medium">Settings</span>}
          </button>
          <button type="button" onClick={logout}
            className={`w-full flex items-center gap-2.5 text-[11px] text-red-400 hover:bg-[#1e3060] hover:text-red-200 rounded transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}>
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
        {collapsed && (
          <button type="button" onClick={() => setCollapsed(false)} className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-[#1e3060] rounded transition-colors" title="Expand sidebar">
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!collapsed && <div className="text-[9px] text-center py-1.5 font-medium" style={{ color: "#2d4070" }}>Sutra ERP v2.0 · Nepal Edition</div>}
      </div>
    </aside>
  );
};

export default Sidebar;
