// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { TitleBar, StatusBar, CommandHintBar, ShortcutSidebar } from "./BusyShell";
import BusyMenuBar from "./BusyMenuBar";
import { useIsMobile } from "../hooks/use-mobile";
import { LayoutDashboard, FileText, BookOpen, TrendingUp, Settings, Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import toast from "react-hot-toast";

interface LayoutProps { children: React.ReactNode; }

const HINT_MAP: Record<string, string[]> = {
  default: ["Esc-Quit", "F2-Save", "F5-List", "F6-Type", "F9-DelRow", "Ctrl+P-Print", "Alt+C-Company", "?-Shortcuts"],
  vouchers: ["Esc-Quit", "F2-Save", "F4-Narration", "F6-Type", "F9-DelRow", "Alt+S-Submit", "Ctrl+P-Print"],
  reports: ["Esc-Back", "Ctrl+P-Print", "F5-Refresh", "Alt+E-Export"],
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated, isDbReady, initializeApp, login, currentUser, currentPage, setCurrentPage } = useStore();
  const { rawShortcuts } = useKeyboardShortcuts();
  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed] = useState(false);

  useEffect(() => { initializeApp(); }, [initializeApp]);

  const getHints = () => {
    if (["journal","payment","receipt","contra","sales-invoice","purchase-invoice","sales-return","purchase-return","billing"].includes(currentPage)) return HINT_MAP.vouchers;
    if (["trial-balance","profit-loss","balance-sheet","ledger","day-book","cash-book","bank-book","vat-reports"].includes(currentPage)) return HINT_MAP.reports;
    return HINT_MAP.default;
  };

  const handleSidebarShortcut = (key: string) => {
    const found = rawShortcuts?.find((s: any) => s.key_combo?.toUpperCase() === key.toUpperCase() && s.is_active);
    if (found) {
      if (found.action_type === "navigate") {
        let page = found.action_value.replace(/^\//, "");
        if (page === "company/settings") page = "settings";
        setCurrentPage(page);
      } else if (found.action_type === "report") {
        setCurrentPage(found.action_value.replace(/_/g, "-"));
      }
    } else {
      const FALLBACK: Record<string, string> = {
        F1: "dashboard", F2: "accounts", F3: "items", F4: "accounts",
        F5: "parties", F6: "payment", F7: "receipt", F8: "journal",
        F9: "sales-invoice", F10: "trial-balance", F11: "settings", F12: "billing",
        B: "balance-sheet", T: "trial-balance", P: "profit-loss",
        L: "ledger", D: "day-book", V: "vat-reports", S: "stock-summary",
        O: "bill-pending", "?": "dashboard",
      };
      if (FALLBACK[key]) setCurrentPage(FALLBACK[key]);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { toast.error("Credentials cannot be empty."); return; }
    setLoading(true);
    try {
      const ok = await login(username.trim(), password.trim());
      if (ok) toast.success(`Access Granted: ${username}`);
    } catch (err: any) {
      toast.error(err.message || "Login failed.");
    } finally { setLoading(false); }
  };

  /* ── Loading ── */
  if (!isDbReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, background: "#1557b0", border: "2px solid #0f4a96", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 24, color: "#fff", margin: "0 auto 16px", borderRadius: 4 }}>S</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a2a3a", letterSpacing: 1, textTransform: "uppercase" }}>Sutra ERP</div>
          <div style={{ fontSize: 12, color: "#5a7a9a", marginTop: 6 }}>Initializing accounting system...</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
            {[0,1,2].map((i) => (
              <div key={i} style={{ width: 8, height: 8, background: "#1557b0", borderRadius: "50%", animation: "bounce 1.2s infinite", animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Login ── */
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: "#f0f0f0" }}>
        {/* Left brand panel */}
        <div style={{ width: 380, background: "#1a2a3a", color: "#c8d8e8", padding: "40px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", flexShrink: 0 }} className="hidden lg:flex">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
              <div style={{ width: 36, height: 36, background: "#1557b0", border: "2px solid #4080c0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff", borderRadius: 4 }}>S</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>Sutra ERP</div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, color: "#a0b8d0" }}>Nepal's Professional Accounting</div>
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e0e8ff", marginBottom: 8 }}>Built for Nepal's Businesses</div>
            <div style={{ fontSize: 12, color: "#a0b8d0", marginBottom: 28, lineHeight: 1.6 }}>
              Complete ERP with Nepali BS Calendar, 13% VAT, TDS, IRD compliance and multi-company support.
            </div>
            {["BS Calendar & VAT Ready", "Multi-Company & Multi-User", "Inventory + Double-Entry Ledger", "Trial Balance, P&L, Balance Sheet"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 18, height: 18, background: "#1557b0", border: "1px solid #4080c0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 12, color: "#c8d8e8" }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#5a7a9a" }}>© 2082 B.S. Sutra Software Pvt. Ltd. · Nepal</div>
        </div>

        {/* Right login form */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ width: "100%", maxWidth: 360 }}>
            <div style={{ background: "#fff", border: "1px solid #c8d8e8", borderRadius: 4, padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, background: "#1557b0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, color: "#fff", margin: "0 auto 12px", borderRadius: 4 }}>S</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2a3a" }}>Sign In to Sutra ERP</div>
                <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 4 }}>Enter your credentials to continue</div>
              </div>
              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#2a3a5a", marginBottom: 4 }}>
                    Username / Operator ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    placeholder="admin"
                    className="busy-input"
                    style={{ height: 32, fontSize: 13 }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#2a3a5a", marginBottom: 4 }}>
                    Password / Access Code
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="busy-input"
                    style={{ height: 32, fontSize: 13 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", height: 36,
                    background: loading ? "#6a9ac0" : "#1557b0",
                    border: "1px solid #0f4a96",
                    borderRadius: 3,
                    fontSize: 13, fontWeight: 700,
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    letterSpacing: "0.03em",
                  }}
                >
                  {loading ? "Authenticating..." : "Sign In →"}
                </button>
              </form>
            </div>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: "#8a9ab0" }}>
              All sessions are logged for compliance audit.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Mobile ── */
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <header style={{ height: 44, background: "#1557b0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#1557b0", borderRadius: 3 }}>S</div>
            <span style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, " ")}
            </span>
          </div>
          <button onClick={() => setDrawerOpen(true)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 3, padding: 6, cursor: "pointer", color: "#fff" }}>
            <Menu style={{ width: 18, height: 18 }} />
          </button>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: 12, paddingBottom: 64, background: "#f0f0f0" }}>{children}</main>
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 52, background: "#1a2a3a", borderTop: "1px solid #2d3d4e", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 40 }}>
          {[
            { page: "dashboard", icon: LayoutDashboard, label: "Home" },
            { page: "billing", icon: FileText, label: "Invoice" },
            { page: "journal", icon: BookOpen, label: "Voucher" },
            { page: "profit-loss", icon: TrendingUp, label: "Reports" },
            { page: "settings", icon: Settings, label: "Settings" },
          ].map(({ page, icon: Icon, label }) => (
            <button key={page} onClick={() => setCurrentPage(page)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "transparent", border: "none", cursor: "pointer", color: currentPage === page ? "#60a5fa" : "#8a9ab0" }}>
              <Icon style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
            </button>
          ))}
        </nav>
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)" }} onClick={() => setDrawerOpen(false)} />
            <div style={{ position: "relative", width: 260, height: "100%", overflowY: "auto", background: "#1a2a3a" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #2d3d4e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#fff" }}>Menu</span>
                <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#c8d8e8" }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
              <Sidebar collapsed={false} setCollapsed={() => {}} />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Desktop ── */
  return (
    <div className="busy-app">
      <TitleBar onMinimize={() => setIsMinimized((prev) => !prev)} />
      {!isMinimized && (
        <>
          <BusyMenuBar />
          <div className="busy-body">
            <main className="busy-content-area">
              <div className="busy-page-content animate-fadeIn">
                {children}
              </div>
            </main>
            <ShortcutSidebar onShortcut={handleSidebarShortcut} />
          </div>
          <CommandHintBar hints={getHints()} />
          <StatusBar />
        </>
      )}
      {isMinimized && (
        <div
          onClick={() => setIsMinimized(false)}
          style={{ flex: 1, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#5a7a9a", fontSize: 13, cursor: "pointer", userSelect: "none" }}
        >
          Click here to restore Sutra ERP
        </div>
      )}
    </div>
  );
};

export default Layout;
