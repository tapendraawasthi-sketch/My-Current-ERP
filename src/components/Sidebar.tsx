// @ts-nocheck
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

const menuGroups = [
  { title: "Overview", items: [{ label: "Dashboard", page: "dashboard", icon: LayoutDashboard }] },
  {
    title: "Masters",
    items: [
      { label: "Chart of Accounts", page: "accounts", icon: FolderOpen },
      { label: "Parties", page: "parties", icon: Users },
      { label: "Stock Items", page: "items", icon: Package },
      { label: "Cost Centers", page: "cost-centers", icon: Map },
      { label: "Warehouses", page: "warehouses", icon: Archive },
      { label: "Units", page: "units", icon: Tags },
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
      { label: "Receipt", page: "receipt", icon: Download },
      { label: "Payment", page: "payment", icon: Wallet },
      { label: "Journal", page: "journal", icon: BookOpen },
      { label: "Contra", page: "contra", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Sales Orders", page: "sales-order", icon: ShoppingCart },
      { label: "Purchase Orders", page: "purchase-order", icon: ClipboardList },
      { label: "Delivery Challan", page: "delivery-challan", icon: Truck },
      { label: "GRN", page: "grn", icon: Archive },
      { label: "Stock Journal", page: "stock-journal", icon: ArrowLeftRight },
      { label: "POS", page: "pos", icon: Store },
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
      { label: "Stock Summary", page: "stock-summary", icon: PieChart },
      { label: "Aging Report", page: "aging-report", icon: FileClock },
      { label: "Bill-wise Pending", page: "bill-pending", icon: ClipboardList },
      { label: "VAT Report", page: "vat-reports", icon: FileBarChart },
      { label: "TDS Report", page: "tds-report", icon: FileText },
      { label: "Budget vs Actual", page: "budget-vs-actual", icon: TrendingUp },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Company Settings", page: "settings", icon: Settings },
      { label: "Fiscal Year", page: "fiscal-year", icon: Calendar },
      { label: "Users & Roles", page: "users", icon: Shield },
      { label: "Recurring Vouchers", page: "recurring-vouchers", icon: RefreshCw },
      { label: "Audit Log", page: "audit-log", icon: FileClock },
      { label: "Backup & Restore", page: "backup", icon: Database },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { currentPage, setCurrentPage, currentUser, logout, currentFiscalYear, items, stockMovements } = useStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Overview: true, Masters: true, Transactions: true,
    Inventory: false, Books: false, Reports: false, Admin: false,
  });

  const reorderAlertCount = useMemo(() => {
    return items.filter((i: any) => {
      if (!i.reorderLevel) return false;
      const stock = getCurrentStock(i.id, undefined, stockMovements);
      return stock <= i.reorderLevel;
    }).length;
  }, [items, stockMovements]);

  const handleGroupToggle = (title: string) => {
    if (collapsed) { setCollapsed(false); setExpandedGroups((p) => ({ ...p, [title]: true })); return; }
    setExpandedGroups((p) => ({ ...p, [title]: !p[title] }));
  };

  return (
    <aside style={{
      background: "#1a2a3a",
      borderRight: "1px solid #2d3d4e",
      color: "#c8d8e8",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      transition: "width 0.2s",
      flexShrink: 0,
      width: collapsed ? 44 : 200,
    }}>
      {/* Header */}
      <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", borderBottom: "1px solid #2d3d4e", flexShrink: 0 }}>
        {!collapsed ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, background: "#1557b0", border: "1px solid #4080c0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0, borderRadius: 2 }}>S</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Sutra ERP</div>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#6a8aa8" }}>Nepal Edition</div>
              </div>
            </div>
            <button onClick={() => setCollapsed(true)} style={{ background: "transparent", border: "1px solid #2d3d4e", borderRadius: 2, width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6a8aa8" }} title="Collapse">
              <ChevronLeft style={{ width: 11, height: 11 }} />
            </button>
          </>
        ) : (
          <div style={{ width: 22, height: 22, background: "#1557b0", border: "1px solid #4080c0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", margin: "0 auto", cursor: "pointer", borderRadius: 2 }} onClick={() => setCollapsed(false)}>S</div>
        )}
      </div>

      {/* FY tag */}
      {!collapsed && currentFiscalYear && (
        <div style={{ margin: "5px 8px", padding: "3px 7px", background: "rgba(21,87,176,0.2)", border: "1px solid rgba(21,87,176,0.4)", borderRadius: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#6a8aa8" }}>Active FY</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#c8d8e8", marginTop: 1 }}>{currentFiscalYear.name} BS</div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto" }} className="sidebar-scroll">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title] !== false;
          return (
            <div key={group.title} style={{ marginBottom: 1 }}>
              {!collapsed ? (
                <button onClick={() => handleGroupToggle(group.title)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", background: "transparent", border: "none", cursor: "pointer", color: "#6a8aa8", textAlign: "left" }}>
                  <span>{group.title}</span>
                  {isExpanded ? <ChevronDown style={{ width: 11, height: 11 }} /> : <ChevronRight style={{ width: 11, height: 11 }} />}
                </button>
              ) : (
                <div style={{ height: 1, background: "#2d3d4e", margin: "3px 6px" }} />
              )}
              {(isExpanded || collapsed) && (
                <div>
                  {group.items.map((item: any) => {
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
                          gap: 7,
                          padding: collapsed ? "7px 0" : "4px 10px",
                          justifyContent: collapsed ? "center" : "flex-start",
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 400,
                          background: isActive ? "rgba(21,87,176,0.35)" : "transparent",
                          border: "none",
                          borderLeft: isActive ? "3px solid #1557b0" : "3px solid transparent",
                          cursor: "pointer",
                          color: isActive ? "#ffffff" : "#c8d8e8",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#253545"; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        <Icon style={{ width: 13, height: 13, color: isActive ? "#60a5fa" : "#6a8aa8", flexShrink: 0 }} />
                        {!collapsed && (
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {item.label}
                          </span>
                        )}
                        {!collapsed && item.page === "items" && reorderAlertCount > 0 && (
                          <span style={{ marginLeft: "auto", background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700, padding: "0 4px", borderRadius: 9999 }}>
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
      <div style={{ flexShrink: 0, borderTop: "1px solid #2d3d4e" }}>
        {!collapsed && currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", background: "#253545", borderBottom: "1px solid #2d3d4e" }}>
            <div style={{ width: 24, height: 24, background: "#1557b0", border: "1px solid #4080c0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(currentUser.name || "U").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#6a8aa8" }}>{currentUser.role}</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", padding: 3, gap: 0 }}>
          {[
            { label: "Settings", icon: Sliders, onClick: () => setCurrentPage("settings") },
            { label: "Logout", icon: LogOut, onClick: logout },
          ].map(({ label, icon: Icon, onClick }) => (
            <button key={label} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 7, padding: collapsed ? "7px 0" : "4px 9px", justifyContent: collapsed ? "center" : "flex-start", fontSize: 11, background: "transparent", border: "none", cursor: "pointer", color: "#6a8aa8", borderRadius: 2, width: "100%" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#253545"; (e.currentTarget as HTMLButtonElement).style.color = "#c8d8e8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#6a8aa8"; }}
            >
              <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </div>
        {!collapsed && (
          <div style={{ textAlign: "center", fontSize: 9, padding: "3px 0", color: "#3a4a5a", borderTop: "1px solid #2d3d4e" }}>
            Sutra ERP v3.0 · Nepal
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
