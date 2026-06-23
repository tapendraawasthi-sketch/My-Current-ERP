/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { TitleBar, StatusBar } from "./BusyShell";
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

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const cached = localStorage.getItem("sutra_sidebar_collapsed");
    return cached === "true";
  });

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#16213e" }}>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="h-16 w-16 bg-[#1557b0] rounded-2xl flex items-center justify-center text-white font-bold text-3xl border-2 border-blue-400 shadow-2xl">S</div>
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
      <div className="min-h-screen flex bg-[var(--color-canvas)]">
        {/* LEFT PANEL */}
        <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 shrink-0" style={{ background: "var(--color-sidebar-bg)" }}>
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div style={{ width: 40, height: 40, background: "var(--color-accent)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 20 }}>S</div>
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>Sutra ERP</div>
                <div style={{ color: "var(--color-accent-border)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Nepal's Cloud Accounting</div>
              </div>
            </div>
            <h2 style={{ color: "white", fontSize: 32, fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}>Powerful accounting<br/>built for Nepal</h2>
            <p style={{ color: "var(--color-sidebar-text)", fontSize: 14, lineHeight: 1.6, marginBottom: 40 }}>Complete ERP with VAT, TDS, Nepali calendar, IRD compliance and multi-company support.</p>
            <div className="space-y-6">
              {[
                { title: "BS Calendar & VAT Ready", desc: "Bikram Sambat dates, 13% VAT, TDS withholding built-in" },
                { title: "Multi-Company & Users", desc: "Role-based access with complete audit trail" },
                { title: "Inventory + Accounting", desc: "Integrated stock, invoicing and double-entry ledger" },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-4">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>✓</div>
                  <div>
                    <div style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{f.title}</div>
                    <div style={{ color: "var(--color-sidebar-text)", fontSize: 12, fontWeight: 400 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ color: "var(--color-sidebar-text)", fontSize: 11, fontWeight: 500 }}>© 2081 B.S. Sutra Software Pvt. Ltd. · Kathmandu, Nepal</div>
        </div>
        
        {/* RIGHT PANEL */}
        <div className="flex-1 flex items-center justify-center p-8 bg-[var(--color-canvas)]">
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
              <div style={{ width: 36, height: 36, background: "var(--color-accent)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18 }}>S</div>
              <div style={{ color: "var(--color-text-primary)", fontWeight: 700, fontSize: 20 }}>Sutra ERP</div>
            </div>
            
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: 36, boxShadow: "var(--shadow-modal)" }}>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: 4 }}>Sign In</h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 24 }}>Enter your credentials to access the system</p>
              
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                    System Operator ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="e.g. admin"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                    Access Code / Code word
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2"
                    style={{
                      height: 36, background: "var(--color-accent)", color: "white", fontWeight: 600, borderRadius: "var(--radius-md)", fontSize: 13, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading && <Spinner size="sm" className="text-white" />}
                    <span>Authorize Entry</span>
                  </button>
                </div>
              </form>
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-1.5" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
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
        <header className="h-12 bg-[var(--color-sidebar-bg)] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-[var(--color-accent)] rounded-lg flex items-center justify-center text-white font-bold text-sm">
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
        <main className="flex-1 overflow-y-auto p-4 pb-20 bg-[var(--color-canvas)]">{children}</main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center justify-around z-40 shadow-lg">
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
              className={`flex flex-col items-center gap-0.5 ${currentPage === page ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
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
              <div className="p-4 border-b border-[var(--color-sidebar-border)] flex items-center justify-between text-slate-300 bg-[var(--color-sidebar-bg)]">
                <span className="font-semibold text-slate-200">Menu</span>
                <button onClick={() => setDrawerOpen(false)}>
                  <X className="h-5 w-5 text-slate-400" />
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
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--color-canvas)]">
      <TitleBar />
      <div className="flex flex-row flex-1 overflow-hidden" style={{ height: "calc(100vh - 36px)" }}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-5 bg-[var(--color-canvas)] relative">
            {children}
          </main>
          <StatusBar />
        </div>
      </div>
    </div>
  );
};

export default Layout;
