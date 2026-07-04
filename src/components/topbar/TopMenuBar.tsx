// src/components/topbar/TopMenuBar.tsx
// Top menu bar with ALL Alt+Key shortcuts working via capture-phase listener
// Alt+K=Company, Alt+Y=Data, Alt+7=Exchange, Alt+O=Import, Alt+F=Export,
// Alt+M=Share, Alt+P=Print, Alt+G=GoTo, Ctrl+G=SwitchTo

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useStore } from "../../store/useStore";
import SyncStatusIndicator from "../SyncStatusIndicator";
import {
  Building2,
  Database,
  ArrowLeftRight,
  Upload,
  Download,
  Share2,
  Printer,
  Navigation,
  RefreshCw,
  Wifi,
  WifiOff,
  Moon,
  Sun,
  Settings,
  LogOut,
  ChevronDown,
  X,
  FileText,
  BarChart2,
  BookOpen,
  Users,
  Package,
  HelpCircle,
  Mail,
  Globe,
  Keyboard,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuEntry {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface TopMenu {
  id: string;
  title: string;
  altKey: string; // single char: "K" for Alt+K
  icon?: React.ReactNode;
  entries: MenuEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderTitle(title: string, altChar: string) {
  const idx = title.toUpperCase().indexOf(altChar.toUpperCase());
  if (idx === -1) return <span>{title}</span>;
  return (
    <span>
      {title.slice(0, idx)}
      <u className="underline decoration-yellow-300">{title[idx]}</u>
      {title.slice(idx + 1)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const TopMenuBar: React.FC = () => {
  const {
    setCurrentPage,
    currentUser,
    logout,
    companySettings,
    currentFiscalYear,
    isAuthenticated,
    isDbReady,
  } = useStore();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDark, setIsDark] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const nav = useCallback(
    (page: string) => {
      setCurrentPage(page);
      setOpenMenuId(null);
    },
    [setCurrentPage],
  );

  // ── Online/offline ──────────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    if (!openMenuId) return;
    const fn = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [openMenuId]);

  // ── Menu definitions ────────────────────────────────────────────────────────
  const MENUS: TopMenu[] = useMemo(
    () => [
      {
        id: "company",
        title: "Company",
        altKey: "K",
        icon: <Building2 className="h-3 w-3" />,
        entries: [
          {
            label: "Company Settings",
            shortcut: "Ctrl+Shift+C",
            icon: <Settings className="h-3 w-3" />,
            action: () => nav("settings"),
          },
          {
            label: "Fiscal Year",
            icon: <FileText className="h-3 w-3" />,
            action: () => nav("fiscal-year"),
          },
          { separator: true, label: "" },
          {
            label: "Audit Log",
            icon: <BookOpen className="h-3 w-3" />,
            action: () => nav("audit-log"),
          },
          {
            label: "Backup & Restore",
            icon: <Database className="h-3 w-3" />,
            action: () => nav("backup-restore"),
          },
          { separator: true, label: "" },
          { label: "Switch User", icon: <Users className="h-3 w-3" />, action: () => logout() },
          {
            label: "Logout",
            shortcut: "Ctrl+Shift+L",
            icon: <LogOut className="h-3 w-3" />,
            action: () => logout(),
          },
        ],
      },
      {
        id: "data",
        title: "Data",
        altKey: "Y",
        icon: <Database className="h-3 w-3" />,
        entries: [
          {
            label: "Accounts",
            icon: <BookOpen className="h-3 w-3" />,
            action: () => nav("accounts"),
          },
          { label: "Parties", icon: <Users className="h-3 w-3" />, action: () => nav("parties") },
          {
            label: "Items / Stock",
            icon: <Package className="h-3 w-3" />,
            action: () => nav("item-master"),
          },
          { separator: true, label: "" },
          { label: "Vouchers Register", action: () => nav("day-book") },
          { label: "Invoices Register", action: () => nav("billing") },
          { separator: true, label: "" },
          {
            label: "Refresh All Data",
            shortcut: "Ctrl+Shift+R",
            icon: <RefreshCw className="h-3 w-3" />,
            action: () => window.location.reload(),
          },
        ],
      },
      {
        id: "exchange",
        title: "Exchange",
        altKey: "7",
        icon: <ArrowLeftRight className="h-3 w-3" />,
        entries: [
          { label: "Multi-Currency Setup", action: () => nav("settings") },
          { label: "Exchange Rate Management", action: () => nav("settings") },
          { separator: true, label: "" },
          { label: "Connectivity Settings", action: () => nav("settings") },
          { label: "Exchange Logs", action: () => nav("audit-log") },
        ],
      },
      {
        id: "import",
        title: "Import",
        altKey: "O",
        icon: <Upload className="h-3 w-3" />,
        entries: [
          {
            label: "Import from Excel / CSV",
            icon: <Upload className="h-3 w-3" />,
            action: () => nav("data-import-export"),
          },
          { label: "Import Parties", action: () => nav("parties") },
          { label: "Import Items", action: () => nav("item-master") },
          { label: "Import Opening Balances", action: () => nav("accounts") },
          { separator: true, label: "" },
          { label: "Bank Statement Import", action: () => nav("bank-statement-import") },
        ],
      },
      {
        id: "export",
        title: "Export",
        altKey: "F",
        icon: <Download className="h-3 w-3" />,
        entries: [
          {
            label: "Export to Excel",
            icon: <Download className="h-3 w-3" />,
            action: () => nav("data-import-export"),
          },
          { label: "Export Balance Sheet", action: () => nav("balance-sheet") },
          { label: "Export Trial Balance", action: () => nav("trial-balance") },
          { label: "Export VAT Reports", action: () => nav("vat-reports") },
          { separator: true, label: "" },
          { label: "Export Day Book", action: () => nav("day-book") },
          { label: "Export Ledger", action: () => nav("ledger") },
        ],
      },
      {
        id: "share",
        title: "Share",
        altKey: "M",
        icon: <Share2 className="h-3 w-3" />,
        entries: [
          { label: "Share via Email", icon: <Mail className="h-3 w-3" />, action: () => {} },
          { label: "Share Balance Sheet", action: () => nav("balance-sheet") },
          { label: "Share Report Link", icon: <Globe className="h-3 w-3" />, action: () => {} },
          { separator: true, label: "" },
          {
            label: "User Access Control",
            icon: <Users className="h-3 w-3" />,
            action: () => nav("users"),
          },
        ],
      },
      {
        id: "print",
        title: "Print",
        altKey: "P",
        icon: <Printer className="h-3 w-3" />,
        entries: [
          {
            label: "Print Balance Sheet",
            icon: <Printer className="h-3 w-3" />,
            action: () => {
              nav("balance-sheet");
              setTimeout(() => window.print(), 800);
            },
          },
          {
            label: "Print Trial Balance",
            action: () => {
              nav("trial-balance");
              setTimeout(() => window.print(), 800);
            },
          },
          {
            label: "Print P&L Statement",
            action: () => {
              nav("profit-loss");
              setTimeout(() => window.print(), 800);
            },
          },
          { separator: true, label: "" },
          {
            label: "Print Day Book",
            action: () => {
              nav("day-book");
              setTimeout(() => window.print(), 800);
            },
          },
          {
            label: "Print VAT Report",
            action: () => {
              nav("vat-reports");
              setTimeout(() => window.print(), 800);
            },
          },
          { separator: true, label: "" },
          {
            label: "Print Configuration",
            icon: <Settings className="h-3 w-3" />,
            action: () => nav("settings"),
          },
        ],
      },
      {
        id: "help",
        title: "Help",
        altKey: "H",
        icon: <HelpCircle className="h-3 w-3" />,
        entries: [
          { label: "Keyboard Shortcuts", icon: <Keyboard className="h-3 w-3" />, action: () => {} },
          {
            label: "Documentation",
            icon: <Globe className="h-3 w-3" />,
            action: () => window.open("https://docs.sutraerp.com", "_blank"),
          },
          { separator: true, label: "" },
          { label: "About Sutra ERP", action: () => nav("settings") },
        ],
      },
      {
        id: "goto",
        title: "Go To",
        altKey: "G",
        icon: <Navigation className="h-3 w-3" />,
        entries: [
          { label: "Dashboard", shortcut: "Alt+1", action: () => nav("dashboard") },
          { label: "Sales Invoice", shortcut: "Alt+2", action: () => nav("billing") },
          { label: "Purchase Invoice", shortcut: "Alt+3", action: () => nav("purchase") },
          { label: "Journal Voucher", shortcut: "Alt+4", action: () => nav("journal") },
          { label: "Payment Voucher", shortcut: "Alt+5", action: () => nav("payment") },
          { label: "Receipt Voucher", shortcut: "Alt+6", action: () => nav("receipt") },
          { separator: true, label: "" },
          { label: "Balance Sheet", shortcut: "Ctrl+B", action: () => nav("balance-sheet") },
          { label: "Trial Balance", shortcut: "Ctrl+T", action: () => nav("trial-balance") },
          { label: "Day Book", shortcut: "Ctrl+D", action: () => nav("day-book") },
          { label: "VAT Reports", shortcut: "Ctrl+G", action: () => nav("vat-reports") },
          { label: "General Ledger", shortcut: "Ctrl+L", action: () => nav("ledger") },
        ],
      },
      {
        id: "switchto",
        title: "Switch To",
        altKey: "S",
        icon: <RefreshCw className="h-3 w-3" />,
        entries: [
          { label: "Financial Dashboard", action: () => nav("financial-dashboard") },
          { label: "POS Mode", action: () => nav("pos-mode") },
          { label: "Payroll", action: () => nav("payroll") },
          { separator: true, label: "" },
          { label: "Inventory Reports", action: () => nav("stock-summary") },
          { label: "Sales Analysis", action: () => nav("sales-analysis") },
          { label: "Budget vs Actual", action: () => nav("budget-vs-actual") },
        ],
      },
    ],
    [nav, logout],
  );

  // ── KEYBOARD SHORTCUT HANDLER ────────────────────────────────────────────────
  // Alt+K, Alt+Y, Alt+7, Alt+O, Alt+F, Alt+M, Alt+P, Alt+H, Alt+G, Alt+S
  // Ctrl+G = Switch To (as shown in topbar)
  useEffect(() => {
    if (!isAuthenticated || !isDbReady) return;

    const handler = (e: KeyboardEvent) => {
      // ── Alt + single key → open that menu ──
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toUpperCase();

        // Find menu with matching altKey
        const menu = MENUS.find((m) => m.altKey.toUpperCase() === key);
        if (menu) {
          e.preventDefault();
          e.stopPropagation();
          setOpenMenuId((prev) => (prev === menu.id ? null : menu.id));
          return;
        }
      }

      // Escape closes open menu
      if (e.key === "Escape" && openMenuId) {
        e.preventDefault();
        setOpenMenuId(null);
        return;
      }

      // Arrow navigation inside open menu
      if (openMenuId && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        // Focus management handled by browser naturally for buttons
      }
    };

    // CAPTURE PHASE — runs before everything else including browser Alt default
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [isAuthenticated, isDbReady, openMenuId, MENUS]);

  // ── Company/FY label ────────────────────────────────────────────────────────
  const companyLabel = companySettings?.companyNameEn || companySettings?.name || "Sutra ERP";
  const fyLabel = currentFiscalYear?.name || currentFiscalYear?.fiscalYearBS || "FY 2083/84";
  const userLabel = currentUser?.name || currentUser?.username || "";

  if (!isAuthenticated || !isDbReady) return null;

  return (
    <div
      ref={barRef}
      className="top-menu-bar fixed top-0 left-0 right-0 h-[40px] z-[9999]
        flex items-center bg-[#1e2433] border-b border-[#2d3748] select-none"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Logo pill */}
      <div className="flex items-center gap-1.5 px-3 border-r border-[#2d3748] h-full shrink-0">
        <div className="w-6 h-6 rounded bg-[#1557b0] flex items-center justify-center font-bold text-[13px] text-white shrink-0">
          S
        </div>
        <div className="hidden sm:block">
          <div className="text-[11px] font-bold text-white leading-none truncate max-w-[120px]">
            {companyLabel}
          </div>
          <div className="text-[9px] text-gray-400 leading-none mt-0.5">
            {fyLabel} · {userLabel}
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="flex items-center h-full overflow-x-auto">
        {MENUS.map((menu) => {
          const isOpen = openMenuId === menu.id;
          return (
            <div key={menu.id} className="relative h-full">
              {/* Menu trigger button */}
              <button
                type="button"
                onClick={() => setOpenMenuId((prev) => (prev === menu.id ? null : menu.id))}
                className={[
                  "h-full px-3 flex items-center gap-1 text-[11px] font-medium",
                  "transition-colors whitespace-nowrap",
                  isOpen
                    ? "bg-[#1557b0] text-white"
                    : "text-gray-300 hover:text-white hover:bg-[#273148]",
                ].join(" ")}
                title={`Alt+${menu.altKey}`}
              >
                {renderTitle(menu.title, menu.altKey)}
                <span className="text-[9px] text-gray-500 ml-0.5 hidden lg:inline">
                  Alt+{menu.altKey}
                </span>
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div
                  className="absolute top-full left-0 mt-0 bg-[#1e2433] border border-[#2d3748] rounded-b-lg shadow-2xl z-[10000] py-1 min-w-[220px] max-h-[70vh] overflow-y-auto"
                  style={{ animation: "dropdownEnter 120ms cubic-bezier(0.4, 0, 0.2, 1) both" }}
                >
                  {menu.entries.map((entry, i) => {
                    if (entry.separator) {
                      return <div key={i} className="my-1 border-t border-[#2d3748]" />;
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={entry.disabled}
                        onClick={() => {
                          if (entry.action) entry.action();
                          setOpenMenuId(null);
                        }}
                        className={[
                          "w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px]",
                          "transition-colors",
                          entry.disabled
                            ? "text-gray-600 cursor-not-allowed"
                            : "text-gray-300 hover:bg-[#273148] hover:text-white",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-2">
                          {entry.icon && (
                            <span className="text-gray-500 w-3 flex-shrink-0">{entry.icon}</span>
                          )}
                          {entry.label}
                        </span>
                        {entry.shortcut && (
                          <span className="text-[9px] text-gray-500 ml-4 font-mono shrink-0">
                            {entry.shortcut}
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
      </div>

      {/* Right side status bar */}
      <div className="ml-auto flex items-center gap-2 px-3 shrink-0 border-l border-[#2d3748] h-full">
        <SyncStatusIndicator />

        {/* Online indicator */}
        <div
          className={`flex items-center gap-1 text-[10px] ${isOnline ? "text-green-400" : "text-red-400"}`}
          title={isOnline ? "Online" : "Offline"}
        >
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span className="hidden xl:inline">{isOnline ? "Online" : "Offline"}</span>
        </div>

        {/* Connectivity Settings */}
        <button
          type="button"
          onClick={() => nav("settings")}
          className="text-[10px] text-gray-400 hover:text-white transition-colors hidden lg:block"
        >
          Connectivity Settings
        </button>

        {/* Exchange Logs */}
        <button
          type="button"
          onClick={() => nav("audit-log")}
          className="text-[10px] text-gray-400 hover:text-white transition-colors hidden lg:block"
        >
          Exchange Logs
        </button>
      </div>
    </div>
  );
};

export default TopMenuBar;
