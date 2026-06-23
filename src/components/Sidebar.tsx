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
    companySettings,
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
      className={`flex flex-col h-full overflow-hidden select-none relative shrink-0 ${collapsed ? "w-[56px]" : "w-[224px]"}`}
      style={{ background: "var(--color-sidebar-bg)", transition: "width 200ms ease" }}
    >
      {/* Logo Area */}
      <div className={`flex items-center ${collapsed ? "justify-center" : ""} h-16 shrink-0`} style={{ padding: collapsed ? "0" : "0 16px" }}>
        {!collapsed ? (
          <div className="flex items-center gap-3 mt-2">
            <div style={{ width: 28, height: 28, background: "var(--color-accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>S</div>
            <div className="flex flex-col leading-none">
              <span style={{ color: "white", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>Sutra ERP</span>
              <span style={{ color: "var(--color-sidebar-text)", fontSize: 10, marginTop: 4 }} className="truncate max-w-[130px]">{companySettings?.company_name || "Company"}</span>
            </div>
          </div>
        ) : (
          <div className="mt-2" style={{ width: 28, height: 28, background: "var(--color-accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 15 }}>S</div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-2 mt-2">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title] !== false;
          return (
            <div key={group.title} className="mb-2">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => handleGroupToggle(group.title)}
                  className="w-full flex items-center justify-between text-left"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.10em",
                    color: "var(--color-sidebar-group-label)",
                    padding: "12px 14px 4px",
                  }}
                >
                  <span>{group.title}</span>
                  <ChevronRight style={{ color: "var(--color-sidebar-text)", width: 14, height: 14, transition: "transform 150ms ease", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                </button>
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
                        className={`group flex items-center relative text-left ${active ? "" : "hover:bg-[var(--color-sidebar-hover-bg)]"}`}
                        style={{
                          height: 36,
                          padding: collapsed ? "0" : "0 10px 0 12px",
                          justifyContent: collapsed ? "center" : "flex-start",
                          gap: collapsed ? 0 : 9,
                          borderRadius: "var(--radius-md)",
                          margin: "1px 8px",
                          cursor: "pointer",
                          transition: "background-color var(--transition-fast)",
                          background: active ? "var(--color-sidebar-active-bg)" : "transparent",
                        }}
                      >
                        {active && (
                          <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)", width: 3, height: 22, background: "var(--color-sidebar-active-indicator)", borderRadius: "0 3px 3px 0" }} />
                        )}
                        <Icon
                          style={{
                            width: 16, height: 16, flexShrink: 0,
                            color: active ? "var(--color-sidebar-icon-active)" : "var(--color-sidebar-icon)",
                          }}
                          className={!active ? "group-hover:text-[rgba(255,255,255,0.65)] transition-colors" : ""}
                        />
                        {!collapsed && (
                          <div className="flex flex-col flex-1 min-w-0">
                            <span
                              className={`truncate ${!active ? "group-hover:text-[rgba(255,255,255,0.65)] transition-colors" : ""}`}
                              style={{
                                fontSize: 13,
                                fontWeight: active ? 500 : 400,
                                color: active ? "var(--color-sidebar-text-active)" : "var(--color-sidebar-text)",
                              }}
                            >
                              {item.label}
                            </span>
                          </div>
                        )}
                        {!collapsed && item.label === "Stock Items" && reorderAlertCount > 0 && (
                          <span style={{
                            background: "var(--color-negative-bg)",
                            color: "var(--color-negative)",
                            borderRadius: 3,
                            padding: "1px 6px",
                            fontSize: 10,
                            fontWeight: 700
                          }}>
                            {reorderAlertCount}
                          </span>
                        )}
                        {collapsed && item.label === "Stock Items" && reorderAlertCount > 0 && (
                          <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, background: "var(--color-negative)", borderRadius: "50%" }} />
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

      {/* Footer / User Info */}
      <div className="shrink-0 flex flex-col items-center" style={{ borderTop: "1px solid var(--color-sidebar-border)", padding: collapsed ? "12px 0" : "12px 16px" }}>
        {!collapsed && (
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.10)", color: "white", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {currentUser?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate" style={{ color: "var(--color-sidebar-text-active)", fontSize: 12, fontWeight: 500 }}>{currentUser?.name || "User"}</span>
                <span className="truncate" style={{ color: "var(--color-sidebar-text)", fontSize: 10 }}>{currentUser?.role || "Role"}</span>
              </div>
            </div>
            <button type="button" onClick={logout} className="flex-shrink-0 group flex items-center justify-center" style={{ width: 28, height: 28, background: "transparent", border: "none", cursor: "pointer" }}>
              <LogOut className="w-4 h-4 text-[var(--color-sidebar-text)] group-hover:text-[var(--color-negative)] transition-colors" />
            </button>
          </div>
        )}
        
        {/* Logout button when collapsed */}
        {collapsed && (
          <button type="button" onClick={logout} className="group flex items-center justify-center mb-2" style={{ width: 32, height: 32, background: "transparent", border: "none", cursor: "pointer" }}>
            <div className="w-full h-full flex items-center justify-center rounded-md hover:bg-white/[0.06] transition-colors">
              <LogOut className="w-4 h-4 text-[var(--color-sidebar-text)] group-hover:text-[var(--color-negative)] transition-colors" />
            </div>
          </button>
        )}

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="group flex items-center justify-center"
          style={{
            width: 32, height: 32, background: "transparent", border: "none", cursor: "pointer", borderRadius: "var(--radius-md)"
          }}
        >
          <div className="w-full h-full flex items-center justify-center rounded-md hover:bg-white/[0.06] transition-colors">
            <ChevronRight className={`w-4 h-4 text-[var(--color-sidebar-text)] transition-transform duration-200 ${!collapsed ? "rotate-180" : ""}`} />
          </div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
