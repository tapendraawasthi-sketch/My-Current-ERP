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
  nepaliLabel?: string;
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
      items: [{ label: "Dashboard", nepaliLabel: "ड्यासबोर्ड", page: "dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Masters",
      items: [
        { label: "Chart of Accounts", nepaliLabel: "खाताको चार्ट", page: "accounts", icon: FolderOpen },
        { label: "Parties Directory", nepaliLabel: "ग्राहक/आपूर्तिकर्ता", page: "parties", icon: Users },
        { label: "Stock Items", nepaliLabel: "सामानहरू", page: "items", icon: Package },
        { label: "Cost Centers", page: "cost-centers", icon: Map },
        { label: "Warehouses", page: "warehouses", icon: Archive },
        { label: "Units of Measure", page: "units", icon: Tags },
        { label: "Bank Accounts", nepaliLabel: "बैंक खाताहरू", page: "accounts", icon: Landmark },
      ],
    },
    {
      title: "Transactions",
      items: [
        { label: "Sales Invoice", nepaliLabel: "बिक्री बिजक", page: "sales-invoice", icon: FileText },
        { label: "Purchase Invoice", nepaliLabel: "खरिद बिजक", page: "purchase-invoice", icon: FileText },
        { label: "Sales Return", nepaliLabel: "बिक्री फिर्ता", page: "sales-return", icon: RefreshCw },
        { label: "Purchase Return", nepaliLabel: "खरिद फिर्ता", page: "purchase-return", icon: RefreshCw },
        { label: "Receipt Voucher", nepaliLabel: "प्राप्ति भौचर", page: "receipt", icon: Download },
        { label: "Payment Voucher", nepaliLabel: "भुक्तानी भौचर", page: "payment", icon: Wallet },
        { label: "Journal Voucher", nepaliLabel: "गोश्वारा भौचर", page: "journal", icon: BookOpen },
        { label: "Contra Voucher", nepaliLabel: "कन्ट्रा भौचर", page: "contra", icon: ArrowLeftRight },
        { label: "Debit Note", page: "debit-note", icon: CreditCard },
        { label: "Credit Note", page: "credit-note", icon: CreditCard },
      ],
    },
    {
      title: "Payroll",
      items: [
        { label: "Employees", nepaliLabel: "कर्मचारीहरू", page: "employees", icon: Users },
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
        { label: "Day Book", nepaliLabel: "दैनिक पुस्तिका", page: "day-book", icon: Calendar },
        { label: "Cash Book", nepaliLabel: "नगद पुस्तिका", page: "cash-book", icon: Banknote },
        { label: "Bank Book", nepaliLabel: "बैंक पुस्तिका", page: "bank-book", icon: Landmark },
        { label: "General Ledger", nepaliLabel: "साधारण खाता", page: "ledger", icon: BookOpen },
        { label: "Party Ledger", nepaliLabel: "पार्टी खाता", page: "party-statement", icon: BookMarked },
        { label: "Vouchers Register", nepaliLabel: "भौचर दर्ता", page: "vouchers", icon: ScrollText },
        { label: "Bank Reconciliation", page: "bank-reconciliation", icon: Landmark },
      ],
    },
    {
      title: "Reports",
      items: [
        { label: "Trial Balance", nepaliLabel: "सन्तुलन परीक्षण", page: "trial-balance", icon: Scale },
        { label: "Profit & Loss", nepaliLabel: "नाफा नोक्सान", page: "profit-loss", icon: TrendingUp },
        { label: "Balance Sheet", nepaliLabel: "वासलात", page: "balance-sheet", icon: BarChart2 },
        { label: "Ratio Analysis", page: "ratio-analysis", icon: FileBarChart },
        { label: "Cash Flow", page: "cash-flow", icon: Activity },
        { label: "Sales Register", page: "sales-register", icon: TrendingUp },
        { label: "Purchase Register", page: "purchase-register", icon: TrendingDown },
        { label: "Stock Summary", page: "stock-summary", icon: PieChart },
        { label: "Inventory Report", page: "inventory-report", icon: Layers },
        { label: "Aging Report", page: "aging-report", icon: FileClock },
        { label: "Bill-wise Pending", page: "bill-pending", icon: ClipboardList },
        { label: "VAT Report", page: "vat-reports", icon: FileBarChart },
        { label: "TDS Report", page: "tds-report", icon: FileText },
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
            <div className="h-6 w-6 rounded-md bg-[#4A7A30] flex items-center justify-center text-[#111111] font-bold text-sm shrink-0">S</div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-bold text-[#111111]">Sutra</span>
              <span className="text-[9px] text-[#111111] font-semibold uppercase tracking-widest">ERP Cloud</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto h-6 w-6 rounded-md bg-[#4A7A30] flex items-center justify-center text-[#111111] font-bold text-sm">S</div>
        )}
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} className="p-1 rounded text-[#111111] hover:text-[#111111] hover:bg-[#B2D494] transition-colors" title="Collapse">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Fiscal Year tag */}
      {!collapsed && currentFiscalYear && (
        <div className="mx-2.5 mt-2 mb-1 px-2 py-1 rounded" style={{ background: "#B2D494" }}>
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#111111]">Active FY</div>
          <div className="text-[10px] font-semibold text-[#111111] mt-0.5">{currentFiscalYear.name.includes("BS") ? currentFiscalYear.name : `${currentFiscalYear.name} BS`}</div>
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
                  style={{ color: "#111111" }}>
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
                        className={`w-full flex items-center gap-2.5 text-[12px] font-medium transition-all relative ${collapsed ? "justify-center py-2 px-0" : "px-3 py-[6px]"} ${active ? "text-[#111111]" : "hover:text-[#111111] text-[#111111]"}`}
                        style={active ? { background: "var(--sidebar-accent)", borderLeft: "3px solid #F08A2C", paddingLeft: collapsed ? undefined : "9px" } : { borderLeft: "3px solid transparent" }}>
                        <Icon className={`shrink-0 ${collapsed ? "h-4 w-4" : "h-[14px] w-[14px]"} ${active ? "text-[#4A7A30]" : "text-[#111111]"}`} />
                        {!collapsed && (
                          <div className="flex flex-col flex-1 leading-tight text-left min-w-0">
                            <span className="truncate">{item.label}</span>
                            {item.nepaliLabel && (
                              <span className="text-[9px] font-normal text-[#111111] truncate">{item.nepaliLabel}</span>
                            )}
                          </div>
                        )}
                        {!collapsed && item.label === "Stock Items" && reorderAlertCount > 0 && (
                          <span className="ml-auto bg-[#4A7A30] text-[#111111] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {reorderAlertCount}
                          </span>
                        )}
                        {collapsed && item.label === "Stock Items" && reorderAlertCount > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-[#4A7A30] rounded-full"></span>
                        )}
                      </button>
                    );
                    const tooltipContent = item.nepaliLabel ? `${item.label} (${item.nepaliLabel})` : item.label;
                    return (
                      <React.Fragment key={`${item.label}-${item.page}`}>
                        {collapsed ? <Tooltip content={tooltipContent} position="right">{btn}</Tooltip> : btn}
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
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#B2D494" }}>
            <div className="h-7 w-7 rounded-full bg-[#4A7A30] flex items-center justify-center text-[11px] font-bold text-[#111111] flex-none border border-[#9DC07A]">
              {currentUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#111111] truncate">{currentUser.name}</span>
              <span className="text-[9px] font-bold text-[#111111] uppercase tracking-widest">{currentUser.role}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-0 py-1 px-1">
          <button type="button" onClick={() => setCurrentPage("settings")}
            className={`w-full flex items-center gap-2.5 text-[11px] text-[#111111] hover:bg-[#B2D494] hover:text-[#111111] rounded transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}>
            <Sliders className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="font-medium">Settings</span>}
          </button>
          <button type="button" onClick={logout}
            className={`w-full flex items-center gap-2.5 text-[11px] text-red-400 hover:bg-[#B2D494] hover:text-red-200 rounded transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}>
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
        {collapsed && (
          <button type="button" onClick={() => setCollapsed(false)} className="w-full flex items-center justify-center p-2 text-[#111111] hover:text-[#111111] hover:bg-[#B2D494] rounded transition-colors" title="Expand sidebar">
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!collapsed && <div className="text-[9px] text-center py-1.5 font-medium" style={{ color: "#111111" }}>Sutra ERP v2.0 · Nepal Edition</div>}
      </div>
    </aside>
  );
};

export default Sidebar;
