// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";

interface MenuItem {
  label: string;
  page?: string;
  separator?: boolean;
  shortcut?: string;
}

const MENU_TREE: { title: string; items: MenuItem[] }[] = [
  {
    title: "Company",
    items: [
      { label: "Company Settings", page: "settings", shortcut: "F11" },
      { label: "Fiscal Year", page: "fiscal-year" },
      { separator: true, label: "" },
      { label: "Users & Roles", page: "users" },
      { label: "Audit Log", page: "audit-log" },
      { separator: true, label: "" },
      { label: "Backup & Restore", page: "backup" },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Chart of Accounts", page: "accounts", shortcut: "F2" },
      { label: "Parties Directory", page: "parties" },
      { label: "Stock Items", page: "items", shortcut: "F3" },
      { separator: true, label: "" },
      { label: "Warehouses", page: "warehouses" },
      { label: "Units of Measure", page: "units" },
      { label: "Cost Centers", page: "cost-centers" },
      { label: "Budget Master", page: "budget" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Sales Invoice", page: "sales-invoice", shortcut: "F9" },
      { label: "Purchase Invoice", page: "purchase-invoice" },
      { label: "Sales Return", page: "sales-return" },
      { label: "Purchase Return", page: "purchase-return" },
      { separator: true, label: "" },
      { label: "Payment Voucher", page: "payment", shortcut: "F6" },
      { label: "Receipt Voucher", page: "receipt", shortcut: "F7" },
      { label: "Journal Entry", page: "journal", shortcut: "F8" },
      { label: "Contra Voucher", page: "contra" },
      { separator: true, label: "" },
      { label: "Sales Order", page: "sales-order" },
      { label: "Purchase Order", page: "purchase-order" },
      { label: "Delivery Challan", page: "delivery-challan" },
      { label: "GRN", page: "grn" },
      { separator: true, label: "" },
      { label: "Stock Journal", page: "stock-journal" },
      { label: "Opening Balance", page: "opening-balance" },
    ],
  },
  {
    title: "Display",
    items: [
      { label: "Dashboard", page: "dashboard" },
      { separator: true, label: "" },
      { label: "Trial Balance", page: "trial-balance", shortcut: "T" },
      { label: "Profit & Loss", page: "profit-loss", shortcut: "P" },
      { label: "Balance Sheet", page: "balance-sheet", shortcut: "B" },
      { label: "Cash Flow", page: "cash-flow" },
      { separator: true, label: "" },
      { label: "Day Book", page: "day-book", shortcut: "D" },
      { label: "Cash Book", page: "cash-book" },
      { label: "Bank Book", page: "bank-book" },
      { label: "General Ledger", page: "ledger", shortcut: "L" },
      { label: "Party Ledger", page: "party-statement" },
      { separator: true, label: "" },
      { label: "Sales Register", page: "sales-register" },
      { label: "Purchase Register", page: "purchase-register" },
      { label: "Stock Summary", page: "stock-summary", shortcut: "S" },
      { label: "Inventory Report", page: "inventory-report" },
      { separator: true, label: "" },
      { label: "Aging Report", page: "aging-report" },
      { label: "Bill-wise Pending", page: "bill-pending", shortcut: "O" },
      { label: "Ratio Analysis", page: "ratio-analysis" },
    ],
  },
  {
    title: "VAT/TDS",
    items: [
      { label: "VAT Reports", page: "vat-reports", shortcut: "V" },
      { label: "TDS Report", page: "tds-report" },
      { label: "TDS Payment", page: "tds-payment" },
    ],
  },
  {
    title: "Payroll",
    items: [
      { label: "Employee Master", page: "employees" },
      { label: "Payroll Run", page: "payroll-run" },
    ],
  },
  {
    title: "Banking",
    items: [
      { label: "Bank Accounts", page: "bank-accounts" },
      { label: "Bank Reconciliation", page: "bank-reconciliation" },
      { label: "Bank Statement Import", page: "bank-import" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Keyboard Shortcuts", page: "dashboard" },
      { label: "IRD Nepal Guidelines", page: "dashboard" },
      { label: "About Sutra ERP", page: "dashboard" },
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

  // Alt+key for menu access
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const navigate = (page?: string) => {
    if (page) setCurrentPage(page);
    setOpenMenu(null);
  };

  return (
    <div ref={barRef} className="busy-menubar">
      <span style={{ color: "#5a7a9a", marginLeft: 6, marginRight: 6, fontWeight: "bold", fontSize: 12 }}>
        {">>"}
      </span>
      {MENU_TREE.map((menu, idx) => (
        <div key={menu.title} style={{ position: "relative" }}>
          <div
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            className={`busy-menubar-item ${openMenu === idx ? "active" : ""}`}
          >
            <u>{menu.title[0]}</u>{menu.title.slice(1)}
          </div>
          {openMenu === idx && (
            <div className="busy-dropdown">
              {menu.items.map((item, iidx) =>
                item.separator ? (
                  <div key={iidx} className="busy-dropdown-separator" />
                ) : (
                  <div
                    key={iidx}
                    onClick={() => navigate(item.page)}
                    className="busy-dropdown-item"
                    style={{
                      background: hoveredItem === `${idx}-${iidx}` ? "var(--busy-table-row-hover)" : undefined,
                    }}
                    onMouseEnter={() => setHoveredItem(`${idx}-${iidx}`)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <span style={{ position: "absolute", left: 8, fontSize: 10, color: "#5a7a9a" }}>●</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.shortcut && (
                      <span style={{ marginLeft: 12, fontSize: 10, color: "#8b4513", fontWeight: 700 }}>
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BusyMenuBar;
