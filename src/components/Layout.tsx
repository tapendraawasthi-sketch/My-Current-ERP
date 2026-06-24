/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import Sidebar from "./Sidebar";
import { TitleBar, StatusBar, CommandHintBar, ShortcutSidebar } from "./BusyShell";
import BusyMenuBar from "./BusyMenuBar";
import SutraLogo from "./SutraLogo";
import { Button, Input, Card, Spinner } from "./ui";
import {
  LogIn,
  KeyRound,
  Building,
  AlertCircle,
  Database,
  HelpCircle,
  Lock,
  ShieldAlert,
  LayoutDashboard,
  FileText,
  BookOpen,
  TrendingUp,
  Settings,
  Menu,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    isAuthenticated,
    isDbReady,
    initializeApp,
    login,
    currentUser,
    companySettings,
    currentPage,
    setCurrentPage,
  } = useStore();

  const { rawShortcuts } = useKeyboardShortcuts();

  const handleSidebarShortcut = (key: string) => {
    // Find the shortcut from DB config
    const found = rawShortcuts.find(
      (s) => s.key_combo.toUpperCase() === key.toUpperCase() && s.is_active
    );
    if (found) {
      if (found.action_type === "navigate") {
        let page = found.action_value.replace(/^\//, "");
        if (page === "company/settings") page = "settings";
        if (page === "reports/ledger") page = "ledger";
        if (page === "help") page = "dashboard"; // fallback
        setCurrentPage(page);
      } else if (found.action_type === "report") {
        setCurrentPage(found.action_value.replace(/_/g, "-"));
      }
    } else {
      // Fallback hardcoded map
      const FALLBACK: Record<string, string> = {
        F1: "dashboard", F2: "accounts", F3: "items", F4: "accounts",
        F5: "journal", F6: "payment-voucher", F7: "receipt-voucher",
        F8: "journal", F9: "billing", B: "balance-sheet", T: "trial-balance",
        S: "stock-summary", A: "general-ledger", L: "general-ledger",
        V: "vat-reports", D: "day-book", G: "vat-reports", F: "settings", K: "dashboard",
      };
      if (FALLBACK[key]) setCurrentPage(FALLBACK[key]);
    }
  };

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const cached = localStorage.getItem("sutra_sidebar_collapsed");
    return cached === "true";
  });

  const [isMinimized, setIsMinimized] = useState(false);

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    localStorage.setItem("sutra_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Credentials cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const ok = await login(username.trim(), password.trim());
      if (ok) {
        toast.success(`Access Granted: Logged in as ${username}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const selectShortcutUser = (role: string) => {
    setUsername(role);
    if (role === "admin") setPassword("admin123");
    else if (role === "accountant") setPassword("accountant123");
    else if (role === "operator") setPassword("operator123");
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d1b2a" }}>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="h-16 w-16 bg-[#2563eb] rounded-2xl flex items-center justify-center text-white font-bold text-3xl border-2 border-blue-400 shadow-2xl">S</div>
          <div>
            <div className="text-white font-bold text-xl tracking-widest uppercase mb-1">Sutra ERP</div>
            <div className="text-blue-300 text-xs font-medium">Initializing database...</div>
          </div>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
          </div>
        </div>
      </div>
    );
  }

  // Visual gateway for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex bg-[#0d1b2a]">
        {/* LEFT PANEL */}
        <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-[#0d1b2a] flex-col justify-between p-10 shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="h-10 w-10 bg-[#2563eb] rounded-xl flex items-center justify-center text-white font-bold text-xl border border-blue-500">S</div>
              <div>
                <div className="text-white font-bold text-xl tracking-tight">Sutra ERP</div>
                <div className="text-blue-400 text-xs font-semibold tracking-widest uppercase">Nepal's Cloud Accounting</div>
              </div>
            </div>
            <h2 className="text-white text-2xl font-bold mb-2 leading-tight">Powerful accounting<br/>built for Nepal</h2>
            <p className="text-[#E6F2FF] text-sm leading-relaxed mb-10">Complete ERP with VAT, TDS, Nepali calendar, IRD compliance and multi-company support.</p>
            <div className="space-y-4">
              {[
                { title: "BS Calendar & VAT Ready", desc: "Bikram Sambat dates, 13% VAT, TDS withholding built-in" },
                { title: "Multi-Company & Users", desc: "Role-based access with complete audit trail" },
                { title: "Inventory + Accounting", desc: "Integrated stock, invoicing and double-entry ledger" },
                { title: "Reports & Export", desc: "Trial Balance, P&L, Balance Sheet, VAT reports in one click" },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="h-5 w-5 rounded-full bg-[#2563eb] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">✓</span>
                  <div>
                    <div className="text-white text-sm font-semibold leading-none mb-1">{f.title}</div>
                    <div className="text-[#E6F2FF] text-xs">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[#E6F2FF] text-[10px] font-medium">© 2081 B.S. Sutra Software Pvt. Ltd. · Kathmandu, Nepal</div>
        </div>
        {/* RIGHT PANEL */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
              <div className="h-9 w-9 bg-[#2563eb] rounded-xl flex items-center justify-center text-white font-bold text-lg">S</div>
              <div className="text-gray-800 font-bold text-xl">Sutra ERP</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Sign In</h3>
              <p className="text-xs text-gray-500 mb-6">Enter your credentials to access the system</p>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    System Operator ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="e.g. admin"
                    className="block w-full h-9 px-3 bg-white border border-gray-300 text-gray-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Access Code / Code word
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="block w-full h-9 px-3 bg-white border border-gray-300 text-gray-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-9 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading && <Spinner size="sm" className="text-white" />}
                    <span>Authorize Entry</span>
                  </button>
                </div>
              </form>
            </div>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#E6F2FF]">
              <span>All activities are logged for compliance.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Mobile top bar */}
        <header className="h-12 bg-[#0d1b2a] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-[#2563eb] rounded-lg flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-white text-sm">
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, " ")}
            </span>
          </div>
          <button onClick={() => setDrawerOpen(true)} className="p-2 text-slate-300">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20">{children}</main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[#0d1b2a] border-t border-[#1b3a5c] flex items-center justify-around z-40">
          {[
            { page: "dashboard", icon: LayoutDashboard, label: "Home" },
            { page: "billing", icon: FileText, label: "Invoices" },
            { page: "journal", icon: BookOpen, label: "Vouchers" },
            { page: "profit-loss", icon: TrendingUp, label: "Reports" },
            { page: "settings", icon: Settings, label: "More" },
          ].map(({ page, icon: Icon, label }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`flex flex-col items-center gap-0.5 ${currentPage === page ? "text-[#2563eb]" : "text-[#94a3b8]"}`}
            >
              <Icon className="h-5 w-5" /> <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </nav>

        {/* Drawer overlay */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black bg-opacity-40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative w-72 h-full overflow-y-auto shadow-xl">
              <div className="p-4 border-b border-[#1b3a5c] flex items-center justify-between text-slate-300 bg-[#0d1b2a]">
                <span className="font-semibold text-slate-200">Menu</span>
                <button onClick={() => setDrawerOpen(false)}>
                  <X className="h-5 w-5 text-[#E6F2FF]" />
                </button>
              </div>
              <Sidebar collapsed={false} setCollapsed={() => {}} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#1a3a5c" }}>
      {/* 1. Title Bar — always visible */}
      <TitleBar onMinimize={() => setIsMinimized(prev => !prev)} />

      {!isMinimized && (
        <>
          {/* 2. Menu Bar */}
          <BusyMenuBar />

          {/* 3. Main area = workspace + right shortcut sidebar */}
          <div className="flex flex-1 overflow-hidden">
            {/* Central Workspace */}
            <main
              className="flex-1 overflow-y-auto p-3 relative"
              style={{ background: "#1a3a5c" }}
            >
              <div style={{ fontSize: 11, color: "#ffffff", textAlign: "center", marginBottom: 6 }}>
                {currentPage.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              {children}
            </main>

            {/* Right Shortcut Keys Sidebar */}
            <ShortcutSidebar onShortcut={handleSidebarShortcut} />
          </div>

          {/* 4. Command Hint Bar */}
          <CommandHintBar />

          {/* 5. Status Bar */}
          <StatusBar />
        </>
      )}

      {/* Minimized ribbon — click title bar again to restore */}
      {isMinimized && (
        <div
          style={{
            flex: 1,
            background: "#0d1b2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
            fontSize: 13,
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setIsMinimized(false)}
        >
          Click here or press — again to restore Sutra ERP
        </div>
      )}
    </div>
  );
};

export default Layout;
