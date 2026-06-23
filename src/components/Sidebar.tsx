/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useStore } from "../store/useStore";
import Tooltip from "./ui/Tooltip";
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  LogOut,
  ChevronLeft,
  Settings,
  TrendingUp,
  TrendingDown,
  // New icons
  Receipt,
  ReceiptText,
  ShoppingBag,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Undo2,
  Redo2,
  ArrowDownToLine,
  ArrowUpFromLine,
  NotebookPen,
  GitCompareArrows,
  MinusCircle,
  PlusCircle,
  FileSpreadsheet,
  CalendarDays,
  Coins,
  Building2,
  BookCheck,
  FileSearch,
  FileMinus,
  FilePlus,
  BarChart3,
  CircleDollarSign,
  AlertTriangle,
  ClockAlert,
  Percent,
  BadgeDollarSign,
  LayoutGrid,
  UserRound,
  Boxes,
  Ruler,
  Warehouse,
  FileSignature,
  ClipboardCheck,
  Handshake,
  ScanBarcode,
  ShieldCheck,
  UserCog2,
  CalendarRange,
  RotateCcw,
  HardDrive,
  ListFilter,
  ChartPie,
  ChartBar,
  FileCheck2,
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
  iconColor?: string;
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
    fiscalYears,
    setCurrentFiscalYear,
  } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Masters: false,
    Transactions: true,
    Inventory: false,
    "Accounts Books": false,
    Reports: false,
    Administration: false,
  });

  const menuGroups: MenuGroup[] = [
    {
      title: "Overview",
      items: [{ label: "Dashboard", page: "dashboard", icon: LayoutGrid }],
    },
    {
      title: "Masters",
      items: [
        { label: "Chart of Accounts", page: "accounts", icon: BookCheck },
        { label: "Parties Directory", page: "parties", icon: Handshake },
        { label: "Stock Items", page: "items", icon: Boxes },
        { label: "Cost Centers", page: "cost-centers", icon: CircleDollarSign },
        { label: "Warehouses", page: "warehouses", icon: Warehouse },
        { label: "Units of Measure", page: "units", icon: Ruler },
        { label: "Bank Accounts", page: "accounts", icon: Building2 },
        { label: "Bill Sundry", page: "bill-sundry", icon: ReceiptText },
        { label: "Standard Narrations", page: "standard-narrations", icon: FileSignature },
      ],
    },
    {
      title: "Transactions",
      items: [
        {
          label: "Sales Invoice",
          page: "sales-invoice",
          icon: FilePlus,
          iconColor: "text-emerald-500",
        },
        {
          label: "Purchase Invoice",
          page: "purchase-invoice",
          icon: FileMinus,
          iconColor: "text-amber-500",
        },
        { label: "Sales Return", page: "sales-return", icon: Undo2 },
        { label: "Purchase Return", page: "purchase-return", icon: Redo2 },
        { label: "Receipt Voucher", page: "receipt", icon: ArrowDownToLine },
        { label: "Payment Voucher", page: "payment", icon: ArrowUpFromLine },
        { label: "Journal Voucher", page: "journal", icon: NotebookPen },
        { label: "Contra Voucher", page: "contra", icon: GitCompareArrows },
        { label: "Debit Note", page: "debit-note", icon: MinusCircle },
        { label: "Credit Note", page: "credit-note", icon: PlusCircle },
      ],
    },
    {
      title: "Inventory",
      items: [
        { label: "Sales Orders", page: "sales-order", icon: ShoppingBag },
        { label: "Purchase Orders", page: "purchase-order", icon: ClipboardCheck },
        { label: "Delivery Challan", page: "delivery-challan", icon: PackageCheck },
        { label: "Goods Receipt Note", page: "grn", icon: PackagePlus },
        { label: "Stock Journal", page: "stock-journal", icon: ScanBarcode },
        { label: "POS/Counter Sale", page: "pos", icon: Receipt },
      ],
    },
    {
      title: "Accounts Books",
      items: [
        { label: "Day Book", page: "day-book", icon: CalendarDays },
        { label: "Cash Book", page: "cash-book", icon: Coins },
        { label: "Bank Book", page: "bank-book", icon: Building2 },
        { label: "General Ledger", page: "ledger", icon: FileSpreadsheet },
        { label: "Party Ledger", page: "party-statement", icon: UserRound },
        { label: "Vouchers Register", page: "vouchers", icon: ListFilter },
        { label: "Bank Reconciliation", page: "bank-reconciliation", icon: GitCompareArrows },
      ],
    },
    {
      title: "Reports",
      items: [
        { label: "Trial Balance", page: "trial-balance", icon: FileSearch },
        { label: "Profit & Loss", page: "profit-loss", icon: TrendingUp },
        { label: "Balance Sheet", page: "balance-sheet", icon: BarChart3 },
        { label: "Cash Flow", page: "cash-flow", icon: ChartPie },
        {
          label: "Sales Register",
          page: "sales-register",
          icon: FilePlus,
          iconColor: "text-emerald-500",
        },
        {
          label: "Purchase Register",
          page: "purchase-register",
          icon: FileMinus,
          iconColor: "text-amber-500",
        },
        { label: "Stock Summary", page: "stock-summary", icon: Boxes },
        { label: "Inventory Report", page: "inventory-report", icon: ChartBar },
        { label: "Aging Report", page: "aging-report", icon: ClockAlert },
        { label: "Bill-wise Pending", page: "bill-pending", icon: FileCheck2 },
        { label: "VAT Report", page: "vat-reports", icon: Percent },
        { label: "TDS Report", page: "tds-report", icon: BadgeDollarSign },
        { label: "Cost Center Report", page: "cost-center-report", icon: CircleDollarSign },
        { label: "Budget vs Actual", page: "budget-vs-actual", icon: TrendingDown },
        { label: "Overdue Interest", page: "overdue-interest", icon: AlertTriangle },
      ],
    },
    {
      title: "Administration",
      items: [
        { label: "Company Settings", page: "settings", icon: UserCog2 },
        { label: "Fiscal Year", page: "fiscal-year", icon: CalendarRange },
        { label: "Users & Roles", page: "users", icon: ShieldCheck },
        { label: "Budget Master", page: "budget", icon: BadgeDollarSign },
        { label: "Recurring Vouchers", page: "recurring-vouchers", icon: RotateCcw },
        { label: "Audit Log", page: "audit-log", icon: FileSignature },
        { label: "Backup & Restore", page: "backup", icon: HardDrive },
        { label: "Interest Slabs", page: "interest-slabs", icon: Percent },
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

  const getGroupDotColor = (groupTitle: string): string => {
    switch (groupTitle) {
      case "Overview":
        return "bg-indigo-500";
      case "Masters":
        return "bg-sky-500";
      case "Transactions":
        return "bg-emerald-500";
      case "Inventory":
        return "bg-amber-500";
      case "Accounts Books":
        return "bg-violet-500";
      case "Reports":
        return "bg-pink-500";
      case "Administration":
        return "bg-slate-500";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <aside
      className={`flex flex-col h-full overflow-hidden select-none transition-all duration-200 relative shrink-0 ${collapsed ? "w-[48px]" : "w-[216px]"}`}
      style={{
        background: "linear-gradient(180deg, #0d0f1a 0%, #0a0c15 100%)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Header */}
      <div
        className="h-11 flex items-center justify-between px-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(79,70,229,0.4)",
              }}
            >
              S
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-black text-white tracking-tight">Sutra</span>
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.15em]">
                ERP Cloud
              </span>
            </div>
          </div>
        ) : (
          <div
            className="mx-auto h-6 w-6 flex items-center justify-center text-white font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(79,70,229,0.4)",
            }}
          >
            S
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-[#1e3060] transition-colors"
            title="Collapse"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Fiscal Year tag */}
      {!collapsed && currentFiscalYear && (
        <div className="mx-2.5 mt-2 mb-1 px-2 py-1 rounded" style={{ background: "#0f1b35" }}>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Active FY
          </div>
          <select
            className="w-full bg-transparent text-[10px] font-semibold text-slate-300 mt-0.5 border-none outline-none focus:ring-0 p-0 cursor-pointer"
            value={currentFiscalYear.id}
            onChange={(e) => {
              if (e.target.value) {
                setCurrentFiscalYear(e.target.value);
              }
            }}
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id} className="bg-[#0f1b35] text-slate-300">
                {fy.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-1.5">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title] !== false;
          return (
            <div key={group.title} className="mb-1">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => handleGroupToggle(group.title)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors text-left"
                  style={{ color: "#4b5563" }}
                >
                  <span className="flex items-center">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 shrink-0 ${getGroupDotColor(group.title)}`}
                    />
                    {group.title}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3 w-3 opacity-60" />
                  )}
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
                      <button
                        type="button"
                        onClick={() => handleNavigation(item)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 text-[12px] font-medium transition-all relative ${collapsed ? "justify-center py-2 px-0" : "px-3 py-[6px]"} ${active ? "text-white" : "hover:text-slate-100 text-slate-500"}`}
                        style={
                          active
                            ? {
                                background:
                                  "linear-gradient(90deg, rgba(79,70,229,0.25) 0%, rgba(79,70,229,0.05) 100%)",
                                borderLeft: "3px solid #6366f1",
                                paddingLeft: collapsed ? undefined : "9px",
                                boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.12)",
                              }
                            : { borderLeft: "3px solid transparent" }
                        }
                      >
                        <Icon
                          className={`shrink-0 ${collapsed ? "h-4 w-4" : "h-[14px] w-[14px]"} ${active ? "text-indigo-400" : item.iconColor || "text-slate-500"}`}
                        />
                        {!collapsed && <span className="truncate leading-none">{item.label}</span>}
                      </button>
                    );
                    return (
                      <React.Fragment key={`${item.label}-${item.page}`}>
                        {collapsed ? (
                          <Tooltip content={item.label} position="right">
                            {btn}
                          </Tooltip>
                        ) : (
                          btn
                        )}
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
          <div
            className="flex items-center gap-2 px-3 py-2.5"
            style={{ background: "linear-gradient(135deg, #0f1528 0%, #0d0f1a 100%)" }}
          >
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-none border"
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: "2px solid rgba(99,102,241,0.5)",
                boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
              }}
            >
              {currentUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] font-bold text-slate-100 truncate">
                {currentUser.name}
              </span>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.12em]">
                {currentUser.role}
              </span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-0 py-1 px-1">
          <button
            type="button"
            onClick={() => setCurrentPage("settings")}
            className={`w-full flex items-center gap-2.5 text-[11px] text-slate-500 hover:bg-[#1e3060] hover:text-slate-100 rounded transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="font-medium">Settings</span>}
          </button>
          <button
            type="button"
            onClick={logout}
            className={`w-full flex items-center gap-2.5 text-[11px] text-red-400 hover:bg-[#1e3060] hover:text-red-200 rounded transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-[#1e3060] rounded transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!collapsed && (
          <div className="text-[9px] text-center py-1.5 font-medium" style={{ color: "#1e2545" }}>
            Sutra ERP v2.0 · Nepal
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
