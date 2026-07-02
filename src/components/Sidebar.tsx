// src/components/Sidebar.tsx
// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  LayoutDashboard, Users, Package, Tags, BookOpen, Wallet,
  ArrowLeftRight, ScrollText, FileText, CreditCard, ClipboardList,
  Truck, Archive, RefreshCw, Scale, TrendingUp, TrendingDown,
  BarChart2, Activity, BookMarked, Calendar, Banknote, Layers,
  PieChart, Map, Settings, ChevronDown, ChevronRight, LogOut,
  ChevronLeft, Building2, ShieldCheck, Repeat, Receipt, Calculator,
} from "lucide-react";

interface NavItem {
  label: string;
  page: string;
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
  /**
   * showCount: true  → show count badge
   * showCount: false → never show count
   * undefined        → follow default (show if count > 0)
   */
  showCount?: boolean;
}

interface MenuGroup { title: string; items: NavItem[]; }

const menuGroups: MenuGroup[] = [
  {
    title: "Home",
    items: [
      { label: "Dashboard",           page: "dashboard",           icon: LayoutDashboard },
      { label: "Financial Dashboard", page: "financial-dashboard", icon: BarChart2 },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Sales Invoice",     page: "billing",          icon: TrendingUp    },
      { label: "Purchase Invoice",  page: "purchase",         icon: TrendingDown  },
      { label: "Sales Return",      page: "sales-return",     icon: RefreshCw     },
      { label: "Purchase Return",   page: "purchase-return",  icon: RefreshCw     },
      { label: "Receipt",           page: "receipt",          icon: Receipt       },
      { label: "Payment",           page: "payment",          icon: Banknote      },
      { label: "Journal",           page: "journal",          icon: FileText      },
      { label: "Contra",            page: "contra",           icon: ArrowLeftRight},
      { label: "Debit Note",        page: "debit-note",       icon: FileText      },
      { label: "Credit Note",       page: "credit-note",      icon: FileText      },
      { label: "Delivery Challan",  page: "delivery-challan", icon: Truck         },
      { label: "Goods Receipt Note",page: "goods-receipt",    icon: Archive       },
      { label: "Sales Order",       page: "sales-order",      icon: ClipboardList },
      { label: "Purchase Order",    page: "purchase-order",   icon: ClipboardList },
    ],
  },
  {
    title: "Books & Reports",
    items: [
      { label: "Day Book",                page: "day-book",                icon: BookMarked  },
      { label: "General Ledger",          page: "ledger",                  icon: BookOpen    },
      { label: "Trial Balance",           page: "trial-balance",           icon: Scale       },
      { label: "Profit & Loss",           page: "profit-loss",             icon: TrendingUp  },
      { label: "Balance Sheet",           page: "balance-sheet",           icon: PieChart    },
      { label: "Cash Flow",               page: "cash-flow",               icon: Activity    },
      { label: "Party Statement",         page: "party-statement",         icon: Users       },
      { label: "Outstanding Receivables", page: "outstanding-receivables", icon: TrendingUp  },
      { label: "Outstanding Payables",    page: "outstanding-payables",    icon: TrendingDown},
      { label: "Aging Report",            page: "aging-report",            icon: Calendar    },
      { label: "VAT Reports",             page: "vat-reports",             icon: FileText    },
      { label: "Ratio Analysis",          page: "ratio-analysis",          icon: PieChart    },
      { label: "Budget vs Actual",        page: "budget-vs-actual",        icon: BarChart2   },
      { label: "Income & Expenditure",    page: "income-expenditure",      icon: BookOpen    },
      { label: "Interest Calculation",    page: "interest-calculation",    icon: Calculator  },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Item Master",      page: "item-master",       icon: Package       },
      { label: "Item Groups",      page: "item-groups",       icon: Layers        },
      { label: "Stock Summary",    page: "stock-summary",     icon: Package,     showCount: false }, // removed — count = movements, not useful
      { label: "Stock Ledger",     page: "stock-ledger",      icon: BookOpen      },
      { label: "Stock Transfer",   page: "stock-transfer",    icon: ArrowLeftRight},
      { label: "Stock Journal",    page: "stock-journal",     icon: FileText      },
      { label: "Physical Stock",   page: "physical-stock",    icon: Archive       },
      { label: "Batch Management", page: "batch-management",  icon: Layers        },
      { label: "Warehouses",       page: "warehouses",        icon: Building2     },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Chart of Accounts", page: "accounts",           icon: BookOpen    },
      { label: "Parties",           page: "parties",            icon: Users       },
      { label: "Units",             page: "units",              icon: Calculator  },
      { label: "Price Lists",       page: "price-lists",        icon: Tags        },
      { label: "Cost Centers",      page: "cost-centers",       icon: Map         },
      { label: "Narrations",        page: "standard-narration", icon: ScrollText  },
      { label: "Bill Sundries",     page: "bill-sundry",        icon: Tags        },
      { label: "Fiscal Year",       page: "fiscal-year",        icon: Calendar    },
      { label: "Budget Master",     page: "budget",             icon: Wallet      },
      { label: "Fixed Assets",      page: "fixed-assets",       icon: Building2   },
      { label: "Payroll",           page: "payroll",            icon: Wallet      },
      { label: "PDC Management",    page: "pdc-management",     icon: CreditCard  },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Audit Log",         page: "audit-log",              icon: ShieldCheck,   showCount: false },
      { label: "Users",             page: "users",                  icon: Users,         showCount: true  }, // only useful count
      { label: "Accounts Config",   page: "accounts-configuration", icon: Settings,      showCount: false },
      { label: "Inventory Config",  page: "inventory-config",       icon: Settings,      showCount: false },
      { label: "Recurring Vouchers",page: "recurring-vouchers",     icon: Repeat,        showCount: false },
    ],
  },
];

// ─── Tooltip component — uses .sidebar-tooltip CSS class ─────────────────────

const SidebarTooltip: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="sidebar-tooltip">
          {label}
        </div>
      )}
    </div>
  );
};

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

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

  // Track whether the session has been idle for a while
  const [sessionIdle, setSessionIdle] = useState(false);
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      setSessionIdle(false);
      clearTimeout(idleTimer);
      // Show the session expiry dot after 25 minutes of inactivity
      idleTimer = setTimeout(() => setSessionIdle(true), 25 * 60 * 1000);
    };
    resetIdle();
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
    };
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach((group) => {
      const hasActive = group.items.some((item) => item.page === currentPage);
      initial[group.title] = hasActive || group.title === "Home" || group.title === "Transactions";
    });
    return initial;
  });

  // Auto-expand group containing active page
  useEffect(() => {
    menuGroups.forEach((group) => {
      if (group.items.some((item) => item.page === currentPage)) {
        setExpandedGroups((prev) => ({ ...prev, [group.title]: true }));
      }
    });
  }, [currentPage]);

  const toggleGroup = (groupName: string) => {
    if (collapsed) return;
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Build per-item counts — only for items where showCount !== false
  const itemCounts = useMemo<Record<string, number>>(() => {
    return {
      users:    users?.length || 0,
      items:    items?.length || 0,
      // stock-summary count intentionally omitted (showCount: false on item)
    };
  }, [users, items]);

  const getCount = (item: NavItem): number | null => {
    if (item.showCount === false) return null;
    if (item.showCount === true || item.page === "users") {
      return itemCounts[item.page] ?? itemCounts.users ?? null;
    }
    if (item.page === "item-master" || item.page === "items") {
      return itemCounts.items > 0 ? itemCounts.items : null;
    }
    return null;
  };

  const isActive = (page: string) => currentPage === page;

  // ── Nav item button ──────────────────────────────────────────
  const NavButton: React.FC<{ item: NavItem }> = ({ item }) => {
    const active = isActive(item.page);
    const count  = getCount(item);
    const Icon   = item.icon;

    return (
      <button
        onClick={() => setCurrentPage(item.page)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 8,
          padding: collapsed ? "8px" : "6px 10px",
          justifyContent: collapsed ? "center" : "flex-start",
          background: active ? "rgba(21, 87, 176, 0.15)" : "transparent",
          border: "none",
          borderLeft: active ? "3px solid #1557b0" : "3px solid transparent",
          borderRadius: "0 4px 4px 0",
          cursor: "pointer",
          transition: "all 120ms ease",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }
        }}
      >
        <Icon
          size={collapsed ? 16 : 14}
          style={{
            color: active ? "#60a5fa" : "#94a3b8",   /* active = lighter blue */
            flexShrink: 0,
            transition: "color 100ms ease",
          }}
        />

        {!collapsed && (
          <>
            <span style={{
              flex: 1,
              fontSize: 12,
              color: active ? "#e2e8f0" : "#cbd5e1",
              fontWeight: active ? 600 : 400,
              transition: "color 100ms ease",
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {item.label}
            </span>

            {/* Count badge — standardised single style, only for useful counts */}
            {count !== null && count > 0 && (
              <span className="sidebar-count">{count}</span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <div style={{
      background: "#1e2433",
      color: "#ffffff",
      transition: "width 300ms ease",
      width: collapsed ? 60 : 240,
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid #2d3748",
      height: "100%",
      flexShrink: 0,
    }}>

      {/* Collapse toggle */}
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid #2d3748",
        display: "flex",
        justifyContent: "flex-end",
      }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 4,
            background: "transparent",
            border: "1px solid #2d3748",
            cursor: "pointer",
            color: "#64748b",
            transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#273148";
            (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "8px 0",
      }}
        className="custom-scrollbar"
      >
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups[group.title];

          return (
            <div key={group.title} style={{ marginBottom: 4 }}>

              {/* Group header — toggles expansion when not collapsed */}
              <button
                onClick={() => toggleGroup(group.title)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "space-between",
                  padding: collapsed ? "6px 0" : "5px 14px",
                  background: "transparent",
                  border: "none",
                  cursor: collapsed ? "default" : "pointer",
                }}
              >
                {!collapsed && (
                  <>
                    {/* .sidebar-group-label class — 11px, #5f7ab3 */}
                    <span className="sidebar-group-label">
                      {group.title}
                    </span>
                    {isExpanded
                      ? <ChevronDown  size={13} style={{ color: "#475c8a" }} />
                      : <ChevronRight size={13} style={{ color: "#475c8a" }} />
                    }
                  </>
                )}
                {collapsed && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#475c8a",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}>
                    {group.title.substring(0, 3)}
                  </span>
                )}
              </button>

              {/* Items — shown when expanded or sidebar is collapsed */}
              {(isExpanded || collapsed) && (
                <div style={{ padding: "2px 4px" }}>
                  {group.items.map((item) => {
                    const btn = <NavButton key={item.page} item={item} />;
                    return collapsed ? (
                      <SidebarTooltip key={item.page} label={item.label}>
                        {btn}
                      </SidebarTooltip>
                    ) : (
                      <React.Fragment key={item.page}>{btn}</React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom — FY label first (more important context), then username */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid #2d3748",
        background: "#1a1f2c",
      }}>

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            justifyContent: collapsed ? "center" : "flex-start",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
            color: "#94a3b8",
            transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.2)";
            (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
          }}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={14} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}

          {/* Session expiry indicator — pulsing red dot after 25min idle */}
          {sessionIdle && (
            <div
              className="session-expiry-dot"
              title="Session may expire soon — activity detected as idle"
              style={{ marginLeft: "auto" }}
            />
          )}
        </button>

        {/* User info — FY first (accounting context), username below */}
        {!collapsed && (
          <div style={{ paddingLeft: 8, marginTop: 8 }}>
            {/* FY label — more prominent (accounting context matters most) */}
            {currentFiscalYear && (
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#e2e8f0",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                FY {currentFiscalYear.name || currentFiscalYear.label}
              </div>
            )}
            {/* Username — secondary */}
            {currentUser && (
              <div style={{
                fontSize: 10,
                color: "#64748b",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {currentUser.username || currentUser.name}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
