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
      { label: "Company Settings", page: "settings" },
      { label: "Fiscal Year", page: "fiscal-year" },
      { separator: true, label: "" },
      { label: "Backup / Restore", page: "backup" },
      { label: "Audit Log", page: "audit-log" },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Chart of Accounts", page: "accounts" },
      { label: "Parties Directory", page: "parties" },
      { label: "Stock Items", page: "items" },
      { label: "Warehouses", page: "warehouses" },
      { label: "Units of Measure", page: "units" },
      { label: "Cost Centers", page: "cost-centers" },
      { label: "Budget Master", page: "budget" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Sales Invoice", page: "billing" },
      { label: "Purchase Invoice", page: "purchase-register" },
      { label: "Sales Return", page: "credit-note" },
      { label: "Purchase Return", page: "debit-note" },
      { separator: true, label: "" },
      { label: "Payment Voucher", page: "payment" },
      { label: "Receipt Voucher", page: "receipt" },
      { label: "Journal Entry", page: "journal" },
      { label: "Contra Voucher", page: "contra" },
      { separator: true, label: "" },
      { label: "Sales Order", page: "sales-order" },
      { label: "Purchase Order", page: "purchase-order" },
      { label: "Delivery Challan", page: "delivery-challan" },
      { label: "GRN", page: "grn" },
      { separator: true, label: "" },
      { label: "Stock Journal", page: "stock-journal" },
    ],
  },
  {
    title: "Display",
    items: [
      { label: "Dashboard", page: "dashboard" },
      { separator: true, label: "" },
      { label: "Trial Balance", page: "trial-balance" },
      { label: "Balance Sheet", page: "balance-sheet" },
      { label: "Profit & Loss", page: "profit-loss" },
      { label: "Cash Flow Statement", page: "cash-flow" },
      { separator: true, label: "" },
      { label: "Day Book", page: "day-book" },
      { label: "Cash Book", page: "cash-book" },
      { label: "Bank Book", page: "bank-book" },
      { label: "General Ledger", page: "ledger" },
      { label: "Party Ledger", page: "party-statement" },
      { separator: true, label: "" },
      { label: "Stock Summary", page: "stock-summary" },
      { label: "Inventory Report", page: "inventory-report" },
      { separator: true, label: "" },
      { label: "Aging Report", page: "aging-report" },
      { label: "Bill-wise Pending", page: "bill-pending" },
      { label: "Ratio Analysis", page: "ratio-analysis" },
    ],
  },
  {
    title: "VAT / Tax",
    items: [
      { label: "VAT Reports", page: "vat-reports" },
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
    title: "House-Keeping",
    items: [
      { label: "Users & Roles", page: "users" },
      { label: "Bank Reconciliation", page: "bank-reconciliation" },
      { label: "Recurring Vouchers", page: "recurring-vouchers" },
      { label: "Opening Balance", page: "opening-balance" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "About Sutra ERP", page: "configuration" },
      { label: "Keyboard Shortcuts", page: "shortcuts" },
      { label: "Audit Log", page: "audit-log" },
      { label: "IRD Nepal Portal", page: "ird-portal" },
      { label: "e-TDS Portal", page: "etds-portal" },
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
    if (page) setCurrentPage(page);
    setOpenMenu(null);
  };

  return (
    <div
      ref={barRef}
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        height: 26,
        background: "#D4EABD",
        borderBottom: "1px solid #000000",
        userSelect: "none",
        zIndex: 100,
        position: "relative",
      }}
    >
      <span style={{ color: "#000000", marginLeft: 4, marginRight: 6, fontWeight: "bold" }}>{">>"}</span>
      {MENU_TREE.map((menu, idx) => (
        <div key={menu.title} style={{ position: "relative" }}>
          <div
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            style={{
              padding: "2px 10px",
              cursor: "pointer",
              background: openMenu === idx ? "#C9DEB5" : "transparent",
              color: "#000000",
              height: 26,
              display: "flex",
              alignItems: "center",
              fontWeight: openMenu === idx ? "bold" : "normal",
              border: openMenu === idx ? "1px solid #000000" : "1px solid transparent",
            }}
          >
            {menu.title}
          </div>
          {openMenu === idx && (
            <div
              style={{
                position: "absolute",
                top: 26,
                left: 0,
                background: "#EBF5E2",
                border: "1px solid #000000",
                minWidth: 200,
                boxShadow: "2px 2px 8px rgba(0,0,0,0.3)",
                zIndex: 200,
              }}
            >
              {menu.items.map((item, iidx) =>
                item.separator ? (
                  <div key={iidx} style={{ height: 1, background: "#000000", margin: "2px 0" }} />
                ) : (
                  <div
                    key={iidx}
                    onClick={() => navigate(item.page)}
                    style={{
                      padding: "3px 20px 3px 28px",
                      cursor: "pointer",
                      color: "#000000",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      position: "relative",
                      background: hoveredItem === `${idx}-${iidx}` ? "#D4EABD" : "transparent",
                    }}
                    onMouseEnter={() => setHoveredItem(`${idx}-${iidx}`)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <span style={{ position: "absolute", left: 8, fontSize: 10 }}>•</span>
                    {item.label}
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
