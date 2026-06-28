import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";

interface MenuItem {
  label: string;
  page?: string;
  children?: MenuItem[];
  separator?: boolean;
}

const MENU_TREE: { title: string; items: MenuItem[] }[] = [
  {
    title: "Company",
    items: [
      { label: "Gateway / Home", page: "gateway" },
      { label: "Company Settings", page: "settings" },
      { label: "Fiscal Year", page: "fiscal-year" },
      { separator: true, label: "" },
      { label: "Change Company", page: "switch-company" },
      { label: "New Company", page: "new-company" },
      { separator: true, label: "" },
      { label: "Backup Data", page: "backup-data" },
      { label: "Restore Data", page: "restore-data" },
      { label: "Data Migration", page: "data-migration" },
      { label: "Data Split", page: "data-split" },
      { label: "Data Repair", page: "data-repair" },
    ],
  },
  {
    title: "Gateway",
    items: [
      { label: "Dashboard", page: "dashboard" },
      { label: "Recent Transactions", page: "recent-transactions" },
      { label: "Quick Reports", page: "quick-reports" },
      { separator: true, label: "" },
      { label: "Find", page: "find" },
      { label: "Go To", page: "go-to" },
      { label: "Switch To", page: "switch-to" },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Parties", page: "parties" },
      { label: "Items", page: "items" },
      { label: "Units", page: "units" },
      { label: "Voucher Types", page: "voucher-types" },
      { label: "Godowns", page: "godowns" },
      { separator: true, label: "" },
      { label: "Ledgers", page: "ledgers" },
      { label: "Groups", page: "groups" },
      { label: "Categories", page: "categories" },
      { label: "Brands", page: "brands" },
      { label: "Sub-ledgers", page: "sub-ledgers" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Vouchers", page: "vouchers" },
      { label: "Sales", page: "sales" },
      { label: "Purchase", page: "purchase" },
      { label: "Journal", page: "journal" },
      { label: "Receipt", page: "receipt" },
      { label: "Payment", page: "payment" },
      { label: "Contra", page: "contra" },
      { label: "Debit Note", page: "debit-note" },
      { label: "Credit Note", page: "credit-note" },
      { label: "Memo", page: "memo" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock Journal", page: "stock-journal" },
      { label: "Physical Stock", page: "physical-stock" },
      { label: "Batch", page: "batch" },
      { label: "Serial Numbers", page: "serial-numbers" },
      { separator: true, label: "" },
      { label: "Stock Summary", page: "stock-summary" },
      { label: "Stock Ageing", page: "stock-ageing" },
      { label: "Stock Valuation", page: "stock-valuation" },
      { label: "ABC Analysis", page: "abc-analysis" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { label: "Ledger", page: "ledger" },
      { label: "Trial Balance", page: "trial-balance" },
      { label: "Profit & Loss", page: "profit-loss" },
      { label: "Balance Sheet", page: "balance-sheet" },
      { label: "Cash Flow", page: "cash-flow" },
      { label: "Fund Flow", page: "fund-flow" },
      { separator: true, label: "" },
      { label: "Bank Reconciliation", page: "bank-reconciliation" },
      { label: "Budget", page: "budget" },
      { label: "Ratio Analysis", page: "ratio-analysis" },
    ],
  },
  {
    title: "Statutory",
    items: [
      { label: "GST Reports", page: "gst-reports" },
      { label: "TDS Reports", page: "tds-reports" },
      { label: "VAT Reports", page: "vat-reports" },
      { label: "Excise Reports", page: "excise-reports" },
      { separator: true, label: "" },
      { label: "Compliance Manager", page: "compliance-manager" },
      { label: "Due Date Tracker", page: "due-date-tracker" },
      { label: "Tax Calculator", page: "tax-calculator" },
    ],
  },
  {
    title: "Payroll",
    items: [
      { label: "Employee", page: "employee" },
      { label: "Attendance", page: "attendance" },
      { label: "Salary Structure", page: "salary-structure" },
      { label: "Pay Slip", page: "pay-slip" },
      { separator: true, label: "" },
      { label: "Payroll Reports", page: "payroll-reports" },
      { label: "PF Reports", page: "pf-reports" },
      { label: "ESI Reports", page: "esi-reports" },
    ],
  },
  {
    title: "Utilities",
    items: [
      { label: "Import Data", page: "import-data" },
      { label: "Export Data", page: "export-data" },
      { label: "Data Audit", page: "data-audit" },
      { label: "System Diagnostics", page: "system-diagnostics" },
      { separator: true, label: "" },
      { label: "User Management", page: "user-management" },
      { label: "Role Management", page: "role-management" },
      { label: "Activity Log", page: "activity-log" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Contents", page: "contents" },
      { label: "Tutorials", page: "tutorials" },
      { label: "Support", page: "support" },
      { label: "Feedback", page: "feedback" },
      { separator: true, label: "" },
      { label: "About Sutra ERP", page: "about" },
      { label: "Check for Updates", page: "check-updates" },
      { label: "System Information", page: "system-info" },
    ],
  },
];

const BusyMenuBar: React.FC = () => {
  const { setCurrentPage } = useStore();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const navigate = (page?: string) => {
    if (page) {
      setCurrentPage(page);
      setOpenMenu(null);
    }
  };

  return (
    <div
      ref={barRef}
      style={{
        height: 26,
        background: "#1e2433",
        borderBottom: "1px solid #2d3748",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {MENU_TREE.map((menu, idx) => (
        <div key={menu.title} style={{ position: "relative" }}>
          <div
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            style={{
              padding: "2px 10px",
              cursor: "pointer",
              background: openMenu === idx ? "#273148" : "transparent",
              color: openMenu === idx ? "#ffffff" : "#cbd5e1",
              height: 22,
              display: "flex",
              alignItems: "center",
              fontWeight: openMenu === idx ? 600 : 500,
              border: openMenu === idx ? "1px solid #374151" : "1px solid transparent",
              fontSize: 12,
            }}
            onMouseEnter={() => setHoveredItem(`${idx}-${-1}`)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {menu.title}
          </div>
          {openMenu === idx && (
            <div
              style={{
                position: "absolute",
                top: 24,
                left: 0,
                background: "#1e2433",
                border: "1px solid #374151",
                minWidth: 200,
                zIndex: 100,
                borderRadius: 4,
                boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
              }}
            >
              {menu.items.map((item, iidx) => {
                if (item.separator) {
                  return (
                    <div
                      key={iidx}
                      style={{
                        background: "#2d3748",
                        height: 1,
                        margin: "2px 8px",
                      }}
                    />
                  );
                }
                return (
                  <div
                    key={iidx}
                    onClick={() => navigate(item.page)}
                    onMouseEnter={() => setHoveredItem(`${idx}-${iidx}`)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      padding: "4px 20px 4px 28px",
                      cursor: "pointer",
                      color: hoveredItem === `${idx}-${iidx}` ? "#ffffff" : "#cbd5e1",
                      background: hoveredItem === `${idx}-${iidx}` ? "#273148" : "transparent",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "#94a3b8", position: "absolute", left: 8, fontSize: 10 }}>•</span>
                    {item.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BusyMenuBar;
