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
      { label: "Backup / Restore", page: "backup-restore" },
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
      { label: "Currency Master", page: "currency-master" },
      { label: "Budget Master", page: "budget-master" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Sales Invoice", page: "billing" },
      { label: "Purchase Invoice", page: "purchase-register" },
      { label: "Sales Return", page: "debit-credit-note" },
      { label: "Purchase Return", page: "debit-credit-note" },
      { separator: true, label: "" },
      { label: "Payment Voucher", page: "payment-voucher" },
      { label: "Receipt Voucher", page: "receipt-voucher" },
      { label: "Journal Entry", page: "journal" },
      { label: "Contra Voucher", page: "contra-voucher" },
      { separator: true, label: "" },
      { label: "Sales Order", page: "sales-order" },
      { label: "Purchase Order", page: "purchase-order" },
      { label: "Delivery Challan", page: "delivery-challan" },
      { label: "GRN", page: "goods-receipt-note" },
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
      { label: "General Ledger", page: "general-ledger" },
      { label: "Party Ledger", page: "party-ledger" },
      { separator: true, label: "" },
      { label: "Stock Summary", page: "stock-summary" },
      { label: "Stock Book", page: "stock-book" },
      { label: "Inventory Report", page: "inventory-report" },
      { separator: true, label: "" },
      { label: "Aging Report", page: "aging-report" },
      { label: "Bill-wise Pending", page: "bill-wise-pending" },
      { label: "Overdue Interest", page: "overdue-bills-interest" },
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
      { label: "Employee Master", page: "employee-master" },
      { label: "Payroll Run", page: "payroll-run" },
    ],
  },
  {
    title: "House-Keeping",
    items: [
      { label: "Users & Roles", page: "users" },
      { label: "Bank Reconciliation", page: "bank-reconciliation" },
      { label: "Bank Statement Import", page: "bank-statement-import" },
      { label: "Recurring Vouchers", page: "recurring-vouchers" },
      { label: "Opening Balance", page: "opening-balance" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "About Sutra ERP", page: "dashboard" },
      { label: "IRD Nepal Guidelines", page: "dashboard" },
    ],
  },
];
 
const BusyMenuBar: React.FC = () => {
  const { setCurrentPage } = useStore();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
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
    if (page) { setCurrentPage(page); }
    setOpenMenu(null);
  };
 
  return (
    <div
      ref={barRef}
      className="flex items-center shrink-0 relative"
      style={{ height: 26, background: "#a8c5e8", borderBottom: "1px solid #6a99cc", userSelect: "none", zIndex: 100 }}
    >
      <span style={{ color: "#333", marginLeft: 4, marginRight: 6, fontWeight: "bold" }}>{">>"}</span>
      {MENU_TREE.map((menu, idx) => (
        <div key={menu.title} style={{ position: "relative" }}>
          <div
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            className="flex items-center"
            style={{
              padding: "2px 10px",
              cursor: "pointer",
              background: openMenu === idx ? "#3b6fb8" : "transparent",
              color: openMenu === idx ? "#ffffff" : "#000000",
              height: 26,
              fontWeight: openMenu === idx ? "bold" : "normal",
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
                background: "#f0f0f0",
                border: "1px solid #808080",
                minWidth: 200,
                boxShadow: "2px 2px 4px rgba(0,0,0,0.3)",
                zIndex: 200,
              }}
            >
              {menu.items.map((item, iidx) =>
                item.separator ? (
                  <div key={iidx} style={{ height: 1, background: "#b0b0b0", margin: "2px 0" }} />
                ) : (
                  <div
                    key={iidx}
                    onClick={() => navigate(item.page)}
                    style={{ padding: "3px 20px 3px 28px", cursor: "pointer", color: "#000", display: "flex", alignItems: "center", gap: 6, position: "relative" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#3b6fb8"; (e.currentTarget as HTMLDivElement).style.color = "#fff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; (e.currentTarget as HTMLDivElement).style.color = "#000"; }}
                  >
                    <span style={{ position: "absolute", left: 8, fontSize: 10 }}>•</span>
                    {item.label}
                  </div>
                )
              )}
              <div style={{ borderTop: "1px solid #b0b0b0", display: "flex", gap: 0 }}>
                <div style={{ flex: 1, padding: "2px 8px", fontSize: 11, cursor: "pointer", textAlign: "center" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "#c0c0c0")}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                >Add To Favourites</div>
                <div style={{ width: 1, background: "#b0b0b0" }} />
                <div style={{ flex: 1, padding: "2px 8px", fontSize: 11, cursor: "pointer", textAlign: "center" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "#c0c0c0")}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                >Create Shortcut</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
 
export default BusyMenuBar;
