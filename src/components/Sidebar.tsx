import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getCurrentStock } from "../lib/stockUtils";
import {
  LayoutDashboard, FolderOpen, Users, Package, Tags, BookOpen, Wallet,
  Download, ArrowLeftRight, ScrollText, FileText, CreditCard, ShoppingCart,
  ClipboardList, Truck, Archive, RefreshCw, Store, Scale, TrendingUp,
  TrendingDown, BarChart2, Activity, FileBarChart, BookMarked, Calendar,
  Banknote, Landmark, Layers, PieChart, Map, Settings, Shield, Database,
  FileClock, ChevronDown, ChevronRight, LogOut, Sliders, ChevronLeft,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (b: boolean) => void;
}

interface NavItem {
  label: string;
  nepaliLabel?: string;
  page: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  title: string;
  items: NavItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", nepaliLabel: "ड्यासबोर्ड", page: "dashboard", icon: LayoutDashboard }],
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
      { label: "Bank Accounts", page: "bank-accounts", icon: Landmark },
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
    title: "Books",
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
    title: "Admin",
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

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { currentPage, setCurrentPage, currentUser, logout, currentFiscalYear, items, stockMovements } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Overview: true, Masters: false, Transactions: true, Payroll: false,
    Inventory: false, Books: false, Reports: false, Admin: false,
  });

  const reorderAlertCount = useMemo(() => {
    return items.filter((i) => {
      if (!i.reorderLevel) return false;
      const stock = getCurrentStock(i.id, undefined, stockMovements);
      return stock <= i.reorderLevel;
    }).length;
  }, [items, stockMovements]);

  const handleGroupToggle = (title: string) => {
    if (collapsed) { setCollapsed(false); setExpandedGroups((p) => ({ ...p, [title]: true })); return; }
    setExpandedGroups((p) => ({ ...p, [title]: !p[title] }));
  };

  const sideStyle: React.CSSProperties = {
    background: "#D4EABD",
    borderRight: "1px solid #000000",
    color: "#000000",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    transition: "width 0.2s",
    flexShrink: 0,
    width: collapsed ? 48 : 216,
  };

  const activeStyle: React.CSSProperties = {
    background: "#C9DEB5",
    borderLeft: "3px solid #000000",
    color: "#000000",
  };

  return (
    <aside style={sideStyle}>
      {/* Header */}
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          borderBottom: "1px solid #000000",
          flexShrink: 0,
        }}
      >
        {!collapsed ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: "#C9DEB5",
                  border: "1px solid #000000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                S
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>Sutra</div>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#000000" }}>ERP Cloud</div>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              style={{
                background: "transparent",
                border: "1px solid #000000",
                borderRadius: 3,
                width: 22,
                height: 22,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#000000",
              }}
              title="Collapse"
            >
              <ChevronLeft style={{ width: 12, height: 12, color: "#000000" }} />
            </button>
          </>
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              background: "#C9DEB5",
              border: "1px solid #000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: 14,
              margin: "0 auto",
              cursor: "pointer",
            }}
            onClick={() => setCollapsed(false)}
          >
            S
          </div>
        )}
      </div>

      {/* FY tag */}
      {!collapsed && currentFiscalYear && (
        <div
          style={{
            margin: "6px 10px",
            padding: "4px 8px",
            background: "#C9DEB5",
            border: "1px solid #000000",
            borderRadius: 3,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#000000" }}>Active FY</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#000000", marginTop: 1 }}>{currentFiscalYear.name} BS</div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto" }} className="sidebar-scroll">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title] !== false;
          return (
            <div key={group.title} style={{ marginBottom: 2 }}>
              {!collapsed ? (
                <button
                  onClick={() => handleGroupToggle(group.title)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#000000",
                    textAlign: "left",
                  }}
                >
                  <span>{group.title}</span>
                  {isExpanded
                    ? <ChevronDown style={{ width: 12, height: 12, color: "#000000" }} />
                    : <ChevronRight style={{ width: 12, height: 12, color: "#000000" }} />}
                </button>
              ) : (
                <div style={{ height: 1, background: "#000000", margin: "4px 8px" }} />
              )}

              {(isExpanded || collapsed) && (
                <div>
                  {group.items.map((item) => {
                    const isActive = currentPage === item.page;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.page + item.label}
                        onClick={() => setCurrentPage(item.page)}
                        title={collapsed ? item.label : undefined}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: collapsed ? "8px 0" : "5px 12px",
                          justifyContent: collapsed ? "center" : "flex-start",
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 500,
                          background: isActive ? "#C9DEB5" : "transparent",
                          border: "none",
                          borderLeft: isActive ? "3px solid #000000" : "3px solid transparent",
                          cursor: "pointer",
                          color: "#000000",
                          textAlign: "left",
                        }}
                      >
                        <Icon style={{ width: 14, height: 14, color: "#000000", flexShrink: 0 }} />
                        {!collapsed && (
                          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.label}
                            </span>
                            {item.nepaliLabel && (
                              <span style={{ fontSize: 9, color: "#000000", opacity: 0.6 }}>{item.nepaliLabel}</span>
                            )}
                          </div>
                        )}
                        {!collapsed && item.page === "items" && reorderAlertCount > 0 && (
                          <span
                            style={{
                              marginLeft: "auto",
                              background: "#C9DEB5",
                              border: "1px solid #000000",
                              color: "#000000",
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "0 4px",
                              borderRadius: 9999,
                            }}
                          >
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
        })}
      </nav>

      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: "1px solid #000000" }}>
        {!collapsed && currentUser && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "#C9DEB5",
              borderBottom: "1px solid #000000",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                background: "#D4EABD",
                border: "1px solid #000000",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#000000",
                flexShrink: 0,
              }}
            >
              {currentUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#000000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#000000" }}>
                {currentUser.role}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", padding: 4, gap: 0 }}>
          {[
            { label: "Settings", icon: Sliders, onClick: () => setCurrentPage("settings") },
            { label: "Logout", icon: LogOut, onClick: logout },
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: collapsed ? "8px 0" : "5px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                fontSize: 11,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#000000",
                borderRadius: 3,
                width: "100%",
              }}
            >
              <Icon style={{ width: 14, height: 14, color: "#000000", flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </div>
        {!collapsed && (
          <div style={{ textAlign: "center", fontSize: 9, padding: "4px 0", color: "#000000", borderTop: "1px solid #000000" }}>
            Sutra ERP v2.0 · Nepal Edition
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
