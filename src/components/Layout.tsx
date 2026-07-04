import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGlobalKeyboardShortcuts } from "../hooks/useGlobalKeyboardShortcuts";
import { useF12Keyboard } from "../hooks/useF12Keyboard";
import Sidebar from "./Sidebar";
import { StatusBar, ShortcutSidebar } from "./BusyShell";
import BusyMenuBar from "./BusyMenuBar";
import TopMenuBar from "./topbar/TopMenuBar";
import { useIsMobile } from "../hooks/use-mobile";
import { LayoutDashboard, FileText, BookOpen, TrendingUp, Settings, Menu, X } from "lucide-react";
import toast from "react-hot-toast";
import FalconProvider from "./falcon/FalconProvider";
import SyncStatusIndicator from "./SyncStatusIndicator";
import { startSyncLoop, stopSyncLoop } from "../lib/syncEngine";

interface LayoutProps {
  children: React.ReactNode;
}

// Section 1.3 / 7.1 / 7.2: the old TWO_COLOR palette (#E4F1D9 / #D4EABD /
// #C9DEB5 / hard black borders) has been replaced entirely with a clean
// white/gray/blue theme. Renamed to THEME to make the intent explicit.
const THEME = {
  bg: "#f5f6fa",
  card: "#ffffff",
  muted: "#f9fafb",
  hover: "#eef2ff",
  border: "#e5e7eb",
  text: "#374151",
  accent: "#1557b0",
  accentHover: "#0f4a96",
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    isAuthenticated,
    isDbReady,
    initializeApp,
    login,
    currentUser,
    currentPage,
    setCurrentPage,
  } = useStore();

  const { rawShortcuts } = useKeyboardShortcuts();

  useF12Keyboard();

  useGlobalKeyboardShortcuts((page: string) => {
    if (!isAuthenticated || !isDbReady) return;
    // Don't navigate if user is typing
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if ((activeEl as HTMLElement)?.isContentEditable) return;
    // Don't navigate if modal is open
    const hasOpenModal =
      document.querySelector('[role="dialog"]') !== null ||
      document.querySelector('[aria-modal="true"]') !== null;
    if (hasOpenModal) return;
    setCurrentPage(page);
  });

  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sutra_sidebar_collapsed") === "true";
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("sutra_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (isAuthenticated && isDbReady) {
      startSyncLoop();
      return () => stopSyncLoop();
    }
    return undefined;
  }, [isAuthenticated, isDbReady]);

  const handleSidebarShortcut = (key: string) => {
    // Guard 1: Don't navigate if user is typing
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if ((activeEl as HTMLElement)?.isContentEditable) return;

    // Guard 2: Don't navigate if any modal/dialog is open
    const openDialog =
      document.querySelector('[role="dialog"][aria-hidden="false"]') ||
      document.querySelector('[data-state="open"]') ||
      document.querySelector(".modal-backdrop");
    if (openDialog) return;
    const ACTION_VALUE_TO_PAGE: Record<string, string> = {
      journal: "journal",
      billing: "billing",
      vouchers: "vouchers",
      "/help": "dashboard",
      "/masters": "accounts",
      dashboard: "dashboard",
      accounts: "accounts",
      parties: "parties",
      items: "items",
      payment: "payment",
      receipt: "receipt",
      "company/settings": "settings",
      "/company/settings": "settings",
      "/reports/ledger": "ledger",
      balance_sheet: "balance-sheet",
      "balance-sheet": "balance-sheet",
      trial_balance: "trial-balance",
      "trial-balance": "trial-balance",
      stock_status: "stock-summary",
      "stock-status": "stock-summary",
      acc_summary: "ledger",
      "acc-summary": "ledger",
      vat_report: "vat-reports",
      "vat-report": "vat-reports",
      day_book: "day-book",
      "day-book": "day-book",
      gst_vat_summary: "vat-reports",
      "gst-vat-summary": "vat-reports",
      AddAccountModal: "accounts",
      AddItemModal: "items",
      AddVoucherModal: "journal",
      AddPaymentModal: "payment",
      AddReceiptModal: "receipt",
      AddJournalModal: "journal",
      AddSalesModal: "billing",
      SwitchUserModal: "dashboard",
      LockProgramModal: "dashboard",
    };

    const KEY_FALLBACK: Record<string, string> = {
      F1: "dashboard",
      F2: "accounts",
      F3: "items",
      F4: "accounts",
      F5: "journal",
      F6: "payment",
      F7: "receipt",
      F8: "journal",
      F9: "billing",
      F10: "settings",
      B: "balance-sheet",
      T: "trial-balance",
      S: "stock-summary",
      A: "ledger",
      L: "ledger",
      V: "vat-reports",
      D: "day-book",
      G: "vat-reports",
      U: "dashboard",
      F: "settings",
      K: "dashboard",
    };

    const found = rawShortcuts.find(
      (shortcut) => shortcut.key_combo.toUpperCase() === key.toUpperCase() && shortcut.is_active,
    );

    if (found) {
      const actionValue = found.action_value;
      if (found.action_type === "save" || found.action_type === "search") return;
      if (found.action_type === "help") return;

      const page =
        ACTION_VALUE_TO_PAGE[actionValue] || ACTION_VALUE_TO_PAGE[actionValue.replace(/^\//, "")];

      if (page) {
        setCurrentPage(page);
      } else if (KEY_FALLBACK[key]) {
        setCurrentPage(KEY_FALLBACK[key]);
      }
    } else if (KEY_FALLBACK[key]) {
      setCurrentPage(KEY_FALLBACK[key]);
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!username.trim() || !password.trim()) {
      toast.error("Credentials cannot be empty.");
      return;
    }
    setLoading(true);

    try {
      const ok = await login(username.trim(), password.trim());
      if (ok) toast.success(`Signed in as ${username}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error occurred.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Database initializing screen (Section 11.3: blue spinner, white bg) ──
  if (!isDbReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME.bg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: THEME.accent,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 28,
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(21,87,176,0.25)",
            }}
          >
            S
          </div>

          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: "#1f2937",
                letterSpacing: 1,
              }}
            >
              Sutra ERP
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              Initializing database...
            </div>
          </div>

          <div
            style={{
              width: 28,
              height: 28,
              border: `3px solid ${THEME.hover}`,
              borderTopColor: THEME.accent,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  // ── Login screen (Section 1.4 / 9.2: gradient branding panel, white card) ──
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: THEME.bg }}>
        <div
          style={{
            width: 420,
            background: "linear-gradient(145deg, #0f2444 0%, #1557b0 60%, #1a6bcc 100%)",
            padding: 40,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          className="hidden lg:flex"
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 20,
                  color: "#ffffff",
                }}
              >
                S
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 20, color: "#ffffff" }}>Sutra ERP</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Nepal's Cloud Accounting
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
              Powerful accounting
              <br />
              built for Nepal
            </h2>

            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                marginBottom: 32,
                lineHeight: 1.6,
              }}
            >
              Complete ERP with VAT, TDS, Nepali calendar, IRD compliance and multi-company support.
            </p>

            {[
              {
                title: "BS Calendar & VAT Ready",
                desc: "Bikram Sambat dates, 13% VAT, TDS withholding built-in",
              },
              {
                title: "Multi-Company & Users",
                desc: "Role-based access with complete audit trail",
              },
              {
                title: "Inventory + Accounting",
                desc: "Integrated stock, invoicing and double-entry ledger",
              },
              { title: "Reports & Export", desc: "Trial Balance, P&L, Balance Sheet, VAT reports" },
            ].map((feature) => (
              <div
                key={feature.title}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 12,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#ffffff",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                    {feature.title}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                    {feature.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
            © 2081 B.S. Sutra Software Pvt. Ltd. · Kathmandu, Nepal
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div
              style={{
                background: THEME.card,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
                padding: 32,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
                Sign In
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24 }}>
                Enter your credentials to access the system
              </p>

              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 4,
                    }}
                  >
                    System Operator ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    placeholder="e.g. admin"
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 10px",
                      fontSize: 13,
                      border: `1px solid ${THEME.border}`,
                      background: "#ffffff",
                      color: "#111827",
                      borderRadius: 6,
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = THEME.accent;
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(21,87,176,0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = THEME.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 4,
                    }}
                  >
                    Access Code
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 10px",
                      fontSize: 13,
                      border: `1px solid ${THEME.border}`,
                      background: "#ffffff",
                      color: "#111827",
                      borderRadius: 6,
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = THEME.accent;
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(21,87,176,0.12)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = THEME.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    height: 38,
                    background: THEME.accent,
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    transition: "background 150ms ease",
                  }}
                >
                  {loading ? "Authorizing..." : "Sign In"}
                </button>
              </form>
            </div>

            <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
              All activities are logged for compliance.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <div
        className="app-layout-with-topbar"
        style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
      >
        <TopMenuBar />

        <header
          style={{
            height: 48,
            background: THEME.card,
            borderBottom: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: THEME.accent,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                color: "#ffffff",
              }}
            >
              S
            </div>
            <span style={{ fontWeight: 600, color: "#1f2937", fontSize: 14 }}>
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, " ")}
            </span>
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "transparent",
              border: `1px solid ${THEME.border}`,
              borderRadius: 6,
              padding: 6,
              cursor: "pointer",
              color: "#374151",
            }}
          >
            <Menu style={{ width: 18, height: 18 }} />
          </button>
        </header>

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            paddingBottom: 72,
            background: "#f5f6fa",
          }}
        >
          <div
            key={currentPage}
            className="page-enter"
            style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
          >
            {children}
          </div>
        </main>

        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 56,
            background: THEME.card,
            borderTop: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            zIndex: 40,
          }}
        >
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
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: currentPage === page ? THEME.accent : "#6b7280",
                fontWeight: currentPage === page ? 700 : 400,
              }}
            >
              <Icon style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 10 }}>{label}</span>
            </button>
          ))}
        </nav>

        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
            <div
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)" }}
              onClick={() => setDrawerOpen(false)}
            />
            <div style={{ position: "relative", width: 272, height: "100%", overflowY: "auto" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${THEME.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#1e2433",
                  color: "#ffffff",
                }}
              >
                <span style={{ fontWeight: 600 }}>Menu</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    padding: 4,
                    cursor: "pointer",
                    color: "#ffffff",
                  }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
              <Sidebar collapsed={false} setCollapsed={() => undefined} />
            </div>
          </div>
        )}
        <FalconProvider />
      </div>
    );
  }

  // ── Desktop layout ──
  return (
    <div
      className="app-layout-with-topbar"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: THEME.bg,
      }}
    >
      <TopMenuBar />
      <BusyMenuBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <main style={{ flex: 1, overflowY: "auto", padding: 20, background: "#f5f6fa" }}>
          <div
            key={currentPage}
            className="page-enter"
            style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
          >
            {children}
          </div>
        </main>
        <ShortcutSidebar onShortcut={handleSidebarShortcut} />
      </div>
      <StatusBar />
      <FalconProvider />
    </div>
  );
};

export default Layout;
