import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../../store/useStore";

interface TopMenuItem {
  label: string;
  shortcut?: string;
  page?: string;
  action?: () => void;
  separator?: boolean;
  children?: TopMenuItem[];
}

const MENUS: { title: string; shortcut: string; items: TopMenuItem[] }[] = [
  {
    title: "Company", shortcut: "Alt+K",
    items: [
      { label: "Gateway / Home", page: "dashboard" },
      { label: "Company Settings", page: "settings" },
      { label: "Fiscal Year", page: "fiscal-year" },
      { label: "", separator: true },
      { label: "Backup / Restore", page: "backup" },
      { label: "Audit Log", page: "audit-log" },
    ],
  },
  {
    title: "Data", shortcut: "Alt+Y",
    items: [
      { label: "Chart of Accounts", page: "accounts" },
      { label: "Parties Directory", page: "parties" },
      { label: "Stock Items", page: "item-master" },
      { label: "Warehouses", page: "warehouses" },
      { label: "Units of Measure", page: "units" },
    ],
  },
  {
    title: "Exchange", shortcut: "Alt+Z",
    items: [
      { label: "Sales Invoice", page: "billing" },
      { label: "Purchase Invoice", page: "purchase" },
      { label: "Journal Entry", page: "journal" },
      { label: "Payment", page: "payment" },
      { label: "Receipt", page: "receipt" },
      { label: "Contra", page: "contra" },
      { label: "", separator: true },
      { label: "Stock Transfer", page: "stock-transfer" },
    ],
  },
  {
    title: "Import", shortcut: "Alt+O",
    items: [
      { label: "Data Import / Export", page: "data-import-export" },
    ],
  },
  {
    title: "Export", shortcut: "Alt+E",
    items: [
      { label: "Export to Excel", page: "data-import-export" },
    ],
  },
  {
    title: "Share", shortcut: "Alt+M",
    items: [
      { label: "Email Reports", page: "settings" },
    ],
  },
  {
    title: "Print", shortcut: "Alt+P",
    items: [
      { label: "Print Current View", action: () => window.print() },
    ],
  },
  {
    title: "Help", shortcut: "F1",
    items: [
      { label: "Documentation", action: () => window.open("https://docs.sutraerp.com","_blank") },
      { label: "About Sutra ERP", page: "settings" },
    ],
  },
  {
    title: "Go To", shortcut: "Alt+G",
    items: [
      { label: "Dashboard", page: "dashboard" },
      { label: "Balance Sheet", page: "balance-sheet" },
      { label: "Profit & Loss", page: "profit-loss" },
      { label: "Trial Balance", page: "trial-balance" },
      { label: "VAT Reports", page: "vat-reports" },
    ],
  },
  {
    title: "Switch To", shortcut: "Ctrl+G",
    items: [
      { label: "POS Mode", page: "billing" },
      { label: "Full Screen", action: () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
        else document.exitFullscreen().catch(()=>{});
      }},
    ],
  },
];

const TopMenuBar: React.FC = () => {
  const { setCurrentPage } = useStore();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleItem = (item: TopMenuItem) => {
    if (item.action) { item.action(); setOpenIdx(null); return; }
    if (item.page) { setCurrentPage(item.page); setOpenIdx(null); }
  };

  return (
    <div
      ref={barRef}
      style={{
        display: "flex",
        alignItems: "center",
        height: 24,
        background: "#C9DEB5",
        borderBottom: "1px solid #000",
        userSelect: "none",
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      {MENUS.map((menu, idx) => (
        <div key={menu.title} style={{ position: "relative" }}>
          {/* Top-level button */}
          <button
            type="button"
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            style={{
              height: 24,
              padding: "0 8px",
              fontSize: 11,
              fontWeight: openIdx === idx ? 700 : 400,
              background: openIdx === idx ? "#1557b0" : "transparent",
              color: openIdx === idx ? "#ffffff" : "#000000",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {menu.title}
            <span style={{ fontSize: 9, color: openIdx === idx ? "#cce" : "#444", marginLeft: 3 }}>
              {menu.shortcut}
            </span>
          </button>

          {/* Dropdown */}
          {openIdx === idx && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                background: "#ffffff",
                border: "1px solid #999",
                boxShadow: "2px 4px 12px rgba(0,0,0,0.18)",
                minWidth: 200,
                zIndex: 9999,
              }}
            >
              {menu.items.map((item, i) => {
                if (item.separator) {
                  return <div key={i} style={{ height: 1, background: "#ccc", margin: "2px 0" }} />;
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleItem(item)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "5px 14px",
                      fontSize: 12,
                      color: "#111111",           // ← FIXED: always dark text
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 400,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = "#1557b0";
                      (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color = "#111111";
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Right side info */}
      <div style={{ marginLeft: "auto", paddingRight: 10, fontSize: 10, color: "#333", display: "flex", gap: 10 }}>
        <span>Connectivity Settings</span>
        <span>Exchange Logs</span>
      </div>
    </div>
  );
};

export default TopMenuBar;
