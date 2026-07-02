// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store";

interface MenuItem {
  label: string;
  page?: string;
  children?: MenuItem[];
  separator?: boolean;
}

const PAGE_SHORTCUTS: Record<string, string> = {
  "balance-sheet":         "Ctrl+B",
  "trial-balance":         "Ctrl+T",
  "ledger":                "Ctrl+L",
  "vat-reports":           "Ctrl+G",
  "users":                 "Ctrl+U",
  "billing":               "F9",
  "purchase":              "F10",
  "journal":               "F5",
  "payment":               "F6",
  "receipt":               "F7",
  "contra":                "F8",
  "day-book":              "D",
  "accounts":              "F4",
  "items":                 "F3",
  "profit-loss":           "Ctrl+P",
};

const MENU_TREE: { title: string; items: MenuItem[] }[] = [
  // ── Company ────────────────────────────────────────────────────────────────
  {
    title: "Company",
    items: [
      { label: "Gateway / Home", page: "gateway" },
      { label: "Company Settings", page: "settings" },
      { label: "Fiscal Year", page: "fiscal-year" },
      { separator: true, label: "" },
      { label: "Backup / Restore", page: "backup" },
      { label: "Audit Log", page: "audit-log" },
    ],
  },

  // ── Masters ─────────────────────────────────────────────────────────────────
  {
    title: "Masters",
    items: [
      // Accounts group
      {
        label: "Accounts",
        children: [
          { label: "Chart of Accounts", page: "accounts" },
          { label: "Cost Centers", page: "cost-centers" },
          { label: "Budget Master", page: "budget" },
        ],
      },
      // Parties group
      {
        label: "Parties",
        children: [
          { label: "Parties Directory", page: "parties" },
          { label: "Sales Persons", page: "sales-persons" },
        ],
      },
      // Inventory group
      {
        label: "Inventory",
        children: [
          { label: "Item Groups", page: "item-groups" },
          { label: "Item Master", page: "item-master" },
          { label: "Units of Measure", page: "units" },
          { label: "Unit Conversions", page: "unit-conversion" },
          { label: "Price Lists", page: "price-lists" },
          { label: "Bill of Material", page: "bill-of-material" },
          { label: "Schemes / Offers", page: "schemes" },
          { label: "Misc Masters", page: "misc-masters" },
        ],
      },
      // Operations group
      {
        label: "Operations",
        children: [
          { label: "Standard Narrations", page: "standard-narration" },
          { label: "Bill Sundries", page: "bill-sundry" },
        ],
      },
    ],
  },

  // ── Transactions ────────────────────────────────────────────────────────────
  {
    title: "Transactions",
    items: [
      // Sales
      {
        label: "Sales",
        children: [
          { label: "Sales Voucher", page: "sales" },
          { label: "Sales Return", page: "sales-return" },
          { label: "Delivery Challan", page: "delivery-challan" },
          { label: "Quotation / Estimate", page: "quotation" },
          { label: "Sales Order", page: "sales-order" },
        ],
      },
      // Purchase
      {
        label: "Purchase",
        children: [
          { label: "Purchase Voucher", page: "purchase" },
          { label: "Purchase Return", page: "purchase-return" },
          { label: "Goods Receipt Note", page: "goods-receipt" },
          { label: "Purchase Order", page: "purchase-order" },
        ],
      },
      // Inventory Movements
      {
        label: "Inventory",
        children: [
          { label: "Stock Transfer", page: "stock-transfer" },
          { label: "Stock Journal", page: "stock-journal" },
          { label: "Production Voucher", page: "production" },
          { label: "Physical Stock", page: "physical-stock" },
        ],
      },
      // Quotations
      {
        label: "Quotations",
        children: [
          { label: "Sales Quotation", page: "sales-quotation" },
          { label: "Purchase Quotation", page: "purchase-quotation" },
        ],
      },
      // Finance / Accounts
      {
        label: "Finance",
        children: [
          { label: "Journal Voucher", page: "journal" },
          { label: "Payment Voucher", page: "payment" },
          { label: "Receipt Voucher", page: "receipt" },
          { label: "Contra Voucher", page: "contra" },
          { label: "Credit Note", page: "credit-note" },
          { label: "Debit Note", page: "debit-note" },
        ],
      },
    ],
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  {
    title: "Reports",
    items: [
      // Financial Reports
      {
        label: "Financial",
        children: [
          { label: "Balance Sheet", page: "balance-sheet" },
          { label: "Profit & Loss", page: "profit-loss" },
          { label: "Trial Balance", page: "trial-balance" },
          { label: "Cash Flow", page: "cash-flow" },
          { label: "Day Book", page: "day-book" },
          { label: "Ledger Report", page: "ledger-report" },
        ],
      },
      // Party Reports
      {
        label: "Party",
        children: [
          { label: "Outstanding Receivables", page: "outstanding-receivables" },
          { label: "Outstanding Payables", page: "outstanding-payables" },
          { label: "Aging Report", page: "aging-report" },
          { label: "Party Statement", page: "party-statement" },
          { label: "Interest Calculation", page: "interest-calculation" },
        ],
      },
      // Inventory Reports
      {
        label: "Inventory",
        children: [
          { label: "Stock Status", page: "stock-status" },
          { label: "Stock Ledger", page: "stock-ledger" },
          { label: "Stock Summary", page: "stock-summary" },
          { label: "Sales Analysis", page: "sales-analysis" },
          { label: "Purchase Analysis", page: "sales-analysis" },
          { label: "Stock Aging", page: "stock-status" },
          { label: "Critical Level", page: "stock-summary" },
          { label: "Unmoved Items", page: "stock-summary" },
        ],
      },
      // GST Reports
      {
        label: "GST",
        children: [
          { label: "GSTR-1", page: "gstr1" },
          { label: "GSTR-2", page: "gstr2" },
          { label: "GSTR-3B", page: "gstr3b" },
          { label: "GST Summary", page: "gst-summary" },
        ],
      },
    ],
  },

  // ── Utilities ───────────────────────────────────────────────────────────────
  {
    title: "Utilities",
    items: [
      { label: "Data Import / Export", page: "data-import-export" },
      { label: "Users", page: "users" },
      { label: "Inventory Configuration", page: "inventory-config" },
      { label: "Approval Workflow", page: "approval-workflow" },
      { separator: true, label: "" },
      { label: "About", page: "settings" },
    ],
  },
];

const BusyMenuBar: React.FC = () => {
  const { setCurrentPage } = useStore();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollBottom, setScrollBottom] = useState(999);
  const dropdownScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setOpenSub(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (openMenu !== null && dropdownScrollRef.current) {
      const el = dropdownScrollRef.current;
      setScrollTop(el.scrollTop);
      setScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight);
    }
  }, [openMenu, openSub]);

  const navigate = (page: string) => {
    setCurrentPage(page);
    setOpenMenu(null);
    setOpenSub(null);
    setTimeout(() => {
      const main = document.querySelector("main");
      if (main) {
        main.setAttribute("tabIndex", "-1");
        main.focus();
      }
    }, 0);
  };

  const toggleMenu = (idx: number) => {
    setOpenMenu((prev) => (prev === idx ? null : idx));
    setOpenSub(null);
  };

  const toggleSub = (label: string) => {
    setOpenSub((prev) => (prev === label ? null : label));
  };

  const renderItems = (items: MenuItem[], depth = 0) =>
    items.map((item, i) => {
      if (item.separator) {
        return <div key={`sep-${i}`} className="my-1 border-t border-gray-200" />;
      }

      if (item.children && item.children.length > 0) {
        const isSubOpen = openSub === item.label;
        return (
          <div key={item.label} className="relative">
            <button
              onClick={() => toggleSub(item.label)}
              className={`w-full flex items-center justify-between px-4 py-2 text-[12px] text-left
                hover:bg-[#1557b0]/10 hover:text-[#1557b0] transition-colors
                ${depth > 0 ? "pl-6" : ""}
                ${isSubOpen ? "bg-[#1557b0]/10 text-[#1557b0]" : "text-gray-700"}
              `}
            >
              <span>{item.label}</span>
              <svg
                className={`w-3.5 h-3.5 ml-2 transition-transform ${isSubOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {isSubOpen && (
              <div className="bg-gray-50 border-l-2 border-[#1557b0]/20 ml-2">
                {renderItems(item.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // Leaf item
      return (
        <button
          key={item.label}
          onClick={() => item.page && navigate(item.page)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 16px",
            fontSize: 12,
            color: "#374151",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            transition: "background 100ms ease",
            paddingLeft: depth > 0 ? 32 : 16,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff";
            (e.currentTarget as HTMLButtonElement).style.color = "#1557b0";
            (e.currentTarget as HTMLButtonElement).style.borderLeft = "3px solid #1557b0";
            // paddingLeft needs adjustment because of borderLeft addition?
            // standard approach is box-sizing: border-box, but we can set border-left: 3px solid transparent below
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#374151";
            (e.currentTarget as HTMLButtonElement).style.borderLeft = "3px solid transparent";
          }}
        >
          <span>{item.label}</span>

          {item.page && PAGE_SHORTCUTS[item.page] && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#9ca3af",
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 3,
              padding: "1px 5px",
              fontFamily: "monospace",
              flexShrink: 0,
              marginLeft: 8,
              whiteSpace: "nowrap",
            }}>
              {PAGE_SHORTCUTS[item.page]}
            </span>
          )}
        </button>
      );
    });

  return (
    <div
      ref={barRef}
      className="bg-white border-b border-gray-200 shadow-sm select-none h-10"
      style={{ display: "flex", alignItems: "stretch" }}
    >
      {MENU_TREE.map((section, idx) => {
        const isOpen = openMenu === idx;
        return (
          <div key={section.title} className="relative h-full flex flex-col justify-center">
            <button
              onClick={() => toggleMenu(idx)}
              style={{
                padding: "0 16px",
                height: "100%",
                fontSize: 12,
                fontWeight: isOpen ? 700 : 500,
                background: isOpen ? "#f0f6ff" : "transparent",
                border: "none",
                borderBottom: isOpen ? "2px solid #1557b0" : "2px solid transparent",
                color: isOpen ? "#1557b0" : "#374151",
                cursor: "pointer",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
              }}
            >
              {section.title}
            </button>

            {isOpen && (
              <div style={{ position: "absolute", left: 0, top: "100%", width: 224, zIndex: 50, marginTop: 0 }}>
                <div style={{ position: "relative" }}>
                  <div
                    className="overflow-y-auto"
                    style={{
                      maxHeight: "80vh",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0 0 6px 6px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      setScrollTop(el.scrollTop);
                      setScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight);
                    }}
                    ref={dropdownScrollRef}
                  >
                    {scrollTop > 4 && (
                      <div style={{
                        position: "sticky",
                        top: 0,
                        height: 20,
                        background: "linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)",
                        zIndex: 2,
                        pointerEvents: "none",
                        marginBottom: -20,
                      }} />
                    )}

                    <div style={{ padding: "4px 0" }}>
                      {renderItems(section.items)}
                    </div>

                    {scrollBottom > 4 && (
                      <div style={{
                        position: "sticky",
                        bottom: 0,
                        height: 20,
                        background: "linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)",
                        zIndex: 2,
                        pointerEvents: "none",
                        marginTop: -20,
                      }} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BusyMenuBar;
