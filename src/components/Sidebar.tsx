// Removed @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  LayoutDashboard,
  Users,
  Package,
  Tags,
  BookOpen,
  Wallet,
  ArrowLeftRight,
  ScrollText,
  FileText,
  CreditCard,
  ClipboardList,
  Truck,
  Archive,
  RefreshCw,
  Scale,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Activity,
  BookMarked,
  Calendar,
  Banknote,
  Layers,
  PieChart,
  Map,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  ChevronLeft,
  Building2,
  ShieldCheck,
  Repeat,
  Receipt,
  Calculator,
} from "lucide-react";

interface NavItem {
  label: string;
  nepaliLabel?: string;
  page: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

interface MenuGroup {
  title: string;
  items: NavItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Home",
    items: [
      { label: "Dashboard",        page: "dashboard",           icon: LayoutDashboard },
      { label: "Financial Dashboard", page: "financial-dashboard", icon: BarChart2 },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Sales Invoice",     page: "billing",             icon: TrendingUp },
      { label: "Purchase Invoice",  page: "purchase",            icon: TrendingDown },
      { label: "Sales Return",      page: "sales-return",        icon: RefreshCw },
      { label: "Purchase Return",   page: "purchase-return",     icon: RefreshCw },
      { label: "Receipt",           page: "receipt",             icon: Receipt },
      { label: "Payment",           page: "payment",             icon: Banknote },
      { label: "Journal",           page: "journal",             icon: FileText },
      { label: "Contra",            page: "contra",              icon: ArrowLeftRight },
      { label: "Debit Note",        page: "debit-note",          icon: FileText },
      { label: "Credit Note",       page: "credit-note",         icon: FileText },
      { label: "Delivery Challan",  page: "delivery-challan",    icon: Truck },
      { label: "Goods Receipt Note",page: "goods-receipt",       icon: Archive },
      { label: "Sales Order",       page: "sales-order",         icon: ClipboardList },
      { label: "Purchase Order",    page: "purchase-order",      icon: ClipboardList },
    ],
  },
  {
    title: "Books & Reports",
    items: [
      { label: "Day Book",                  page: "day-book",                  icon: BookMarked },
      { label: "General Ledger",            page: "ledger",                    icon: BookOpen },
      { label: "Trial Balance",             page: "trial-balance",             icon: Scale },
      { label: "Profit & Loss",             page: "profit-loss",               icon: TrendingUp },
      { label: "Balance Sheet",             page: "balance-sheet",             icon: PieChart },
      { label: "Cash Flow",                 page: "cash-flow",                 icon: Activity },
      { label: "Party Statement",           page: "party-statement",           icon: Users },
      { label: "Outstanding Receivables",   page: "outstanding-receivables",   icon: TrendingUp },
      { label: "Outstanding Payables",      page: "outstanding-payables",      icon: TrendingDown },
      { label: "Aging Report",              page: "aging-report",              icon: Calendar },
      { label: "VAT Reports",               page: "vat-reports",               icon: FileText },
      { label: "Ratio Analysis",            page: "ratio-analysis",            icon: PieChart },
      { label: "Budget vs Actual",          page: "budget-vs-actual",          icon: BarChart2 },
      { label: "Income & Expenditure",      page: "income-expenditure",        icon: BookOpen },
      { label: "Interest Calculation",      page: "interest-calculation",      icon: Calculator },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Item Master",      page: "item-master",      icon: Package },
      { label: "Item Groups",      page: "item-groups",      icon: Layers },
      { label: "Stock Summary",    page: "stock-summary",    icon: Package },
      { label: "Stock Ledger",     page: "stock-ledger",     icon: BookOpen },
      { label: "Stock Transfer",   page: "stock-transfer",   icon: ArrowLeftRight },
      { label: "Stock Journal",    page: "stock-journal",    icon: FileText },
      { label: "Physical Stock",   page: "physical-stock",   icon: Archive },
      { label: "Batch Management", page: "batch-management", icon: Layers },
      { label: "Warehouses",       page: "warehouses",       icon: Building2 },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Chart of Accounts", page: "accounts",           icon: BookOpen },
      { label: "Parties",           page: "parties",            icon: Users },
      { label: "Units",             page: "units",              icon: Calculator },
      { label: "Price Lists",       page: "price-lists",        icon: Tags },
      { label: "Cost Centers",      page: "cost-centers",       icon: Map },
      { label: "Narrations",        page: "standard-narration", icon: ScrollText },
      { label: "Bill Sundries",     page: "bill-sundry",        icon: Tags },
      { label: "Fiscal Year",       page: "fiscal-year",        icon: Calendar },
      { label: "Budget Master",     page: "budget",             icon: Wallet },
      { label: "Fixed Assets",      page: "fixed-assets",       icon: Building2 },
      { label: "Payroll",           page: "payroll",            icon: Wallet },
      { label: "PDC Management",    page: "pdc-management",     icon: CreditCard },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Audit Log",              page: "audit-log",              icon: ShieldCheck },
      { label: "Users",                  page: "users",                  icon: Users },
      { label: "Accounts Config",        page: "accounts-configuration", icon: Settings },
      { label: "Inventory Config",       page: "inventory-config",       icon: Settings },
      { label: "Recurring Vouchers",     page: "recurring-vouchers",     icon: Repeat },
    ],
  },
];

const SidebarTooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute",
          left: "calc(100% + 8px)",
          top: "50%",
          transform: "translateY(-50%)",
          background: "#1e2433",
          color: "#ffffff",
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          {label}
          <div style={{
            position: "absolute",
            left: -4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderTop: "4px solid transparent",
            borderBottom: "4px solid transparent",
            borderRight: "4px solid #1e2433",
          }} />
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<{ collapsed: boolean; setCollapsed: (b: boolean) => void }> = ({
  collapsed,
  setCollapsed,
}) => {
  const {
    currentPage,
    setCurrentPage,
    currentUser,
    logout,
    currentFiscalYear,
    users,
    items,
    stockMovements,
  } = useStore();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach((group) => {
      const hasActive = group.items.some((item) => item.page === currentPage);
      initial[group.title] = hasActive || group.title === "Home" || group.title === "Transactions";
    });
    return initial;
  });

  useEffect(() => {
    menuGroups.forEach((group) => {
      const hasActive = group.items.some((item) => item.page === currentPage);
      if (hasActive) {
        setExpandedGroups((prev) => ({ ...prev, [group.title]: true }));
      }
    });
  }, [currentPage]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const groupedNavItems = useMemo(() => {
    const itemsWithCounts: Record<string, { item: NavItem; count?: number }[]> = {};

    menuGroups.forEach((group) => {
      itemsWithCounts[group.title] = group.items.map((item) => {
        let count: number | undefined;

        if (item.page === "users") {
          count = users?.length || 0;
        } else if (item.page === "items" || item.page === "item-master") {
          count = items?.length || 0;
        } else if (item.page === "stock-summary") {
          count = stockMovements?.length || 0;
        }

        return { item, count };
      });
    });

    return itemsWithCounts;
  }, [users, items, stockMovements]);

  const isActive = (page: string) => currentPage === page;

  const getItemStyle = (page: string): React.CSSProperties => {
    const isAct = isActive(page);
    return {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: collapsed ? "8px" : "7px 12px",
      justifyContent: collapsed ? "center" : "flex-start",
      background: isAct ? "#1557b010" : "transparent",
      border: "none",
      borderLeft: isAct ? "3px solid #1557b0" : "3px solid transparent",
      borderRadius: "0 4px 4px 0",
      color: isAct ? "#1557b0" : "#cbd5e1",
      fontSize: 12,
      fontWeight: isAct ? 700 : 400,
      cursor: "pointer",
      transition: "all 150ms ease",
      paddingLeft: collapsed ? undefined : isAct ? 9 : 12,
    };
  };

  return (
    <div
      className={`bg-[#1e2433] text-white transition-all duration-300 ${collapsed ? "w-[60px]" : "w-[240px]"} flex flex-col border-r border-[#2d3748] h-full`}
    >
      <div className="p-3 border-b border-[#2d3748] flex justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-7 h-7 rounded bg-transparent hover:bg-[#273148] text-gray-300 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title];
          const groupItems = groupedNavItems[group.title] || [];

          if (groupItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-1.5">
              <button
                onClick={() => !collapsed && toggleGroup(group.title)}
                className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
                  collapsed ? "justify-center" : ""
                } hover:bg-[#273148] group`}
                title={collapsed ? group.title : undefined}
                style={{ cursor: collapsed ? "default" : "pointer" }}
              >
                {!collapsed && (
                  <>
                    <span className="text-[10px] font-semibold uppercase text-[#475c8a] tracking-wider group-hover:text-[#5f7ab3] transition-colors">
                      {group.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-gray-500 group-hover:text-gray-300" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500 group-hover:text-gray-300" />
                    )}
                  </>
                )}
                {collapsed && (
                  <span className="text-[10px] font-bold text-[#475c8a] uppercase tracking-wider">
                    {group.title.substring(0, 3)}
                  </span>
                )}
              </button>

              {(isExpanded || collapsed) && (
                <div className="mt-0.5 mb-1 px-1 space-y-0.5">
                  {groupItems.map(({ item, count }, index) => {
                    const active = isActive(item.page);
                    
                    const btn = (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(item.page)}
                        style={getItemStyle(item.page)}
                        className="group hover:bg-[#273148]"
                      >
                        <item.icon
                          size={collapsed ? 16 : 14}
                          style={{ color: active ? "#1557b0" : "#94a3b8", flexShrink: 0 }}
                        />
                        {!collapsed && (
                          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
                            <span>{item.label}</span>
                            {count !== undefined && count > 0 && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                                  active ? "bg-white/20 text-[#1557b0]" : "bg-[#2d3748] text-gray-300"
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );

                    return collapsed ? (
                      <SidebarTooltip key={index} label={item.label}>
                        {btn}
                      </SidebarTooltip>
                    ) : (
                      <React.Fragment key={index}>
                        {btn}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#2d3748] bg-[#1a1f2c]">
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium text-gray-300 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded transition-all ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={14} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        {!collapsed && currentUser && (
          <div className="mt-3 px-1">
            <div className="text-[11px] font-semibold text-gray-200 truncate">
              {currentUser.username}
            </div>
            {currentFiscalYear && (
              <div className="text-[10px] text-gray-500 truncate mt-0.5">
                {currentFiscalYear.label}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
