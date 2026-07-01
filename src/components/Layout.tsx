import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGlobalKeyboardShortcuts } from "../hooks/useGlobalKeyboardShortcuts";
import { useF12Keyboard } from "../hooks/useF12Keyboard";
import Sidebar from "./Sidebar";
import { TitleBar, StatusBar, CommandHintBar, ShortcutSidebar } from "./BusyShell";
import BusyMenuBar from "./BusyMenuBar";
import TopMenuBar from "./topbar/TopMenuBar";
import { useIsMobile } from "../hooks/use-mobile";
import { LayoutDashboard, FileText, BookOpen, TrendingUp, Settings, Menu, X } from "lucide-react";
import toast from "react-hot-toast";

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
    currentPage,
    setCurrentPage,
  } = useStore();

  const { rawShortcuts } = useKeyboardShortcuts();

  // Attach global F12 keyboard handler
  useF12Keyboard();

  useGlobalKeyboardShortcuts((page: string) => {
    if (isAuthenticated && isDbReady) {
      setCurrentPage(page);
    }
  });

  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sutra_sidebar_collapsed") === "true";
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // App.tsx handles initialization

  useEffect(() => {
    localStorage.setItem("sutra_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const handleSidebarShortcut = (key: string) => {
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
    if (loading) return; // prevent double-submission
    if (!username.trim() || !password.trim()) {
      toast.error("Credentials cannot be empty.");
      return;
    }
    setLoading(true);

    try {
      const ok = await login(username.trim(), password.trim());
      if (ok) toast.success(`Access Granted: Logged in as ${username}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error occurred.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const TWO_COLOR = {
    bg: "#E4F1D9",
    card: "#EBF5E2",
    muted: "#D4EABD",
    hover: "#C9DEB5",
    border: "#000000",
    text: "#000000",
  };

  if (!isDbReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: TWO_COLOR.bg,
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
              background: TWO_COLOR.muted,
              border: "2px solid #000000",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 28,
              color: "#000000",
            }}
          >
            S
          </div>

          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: "#000000",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Sutra ERP
            </div>
            <div style={{ fontSize: 12, color: "#000000", marginTop: 4 }}>
              Initializing database...
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  background: "#000000",
                  borderRadius: "50%",
                  animation: "bounce 1.2s infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: TWO_COLOR.bg }}>
        <div
          style={{
            width: 420,
            background: TWO_COLOR.muted,
            borderRight: "1px solid #000000",
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
                  width: 40,
                  height: 40,
                  background: TWO_COLOR.hover,
                  border: "2px solid #000000",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 20,
                  color: "#000000",
                }}
              >
                S
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 20, color: "#000000" }}>Sutra ERP</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "#000000",
                  }}
                >
                  {"Nepal's Cloud Accounting"}
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#000000", marginBottom: 8 }}>
              Powerful accounting
              <br />
              built for Nepal
            </h2>

            <p style={{ fontSize: 13, color: "#000000", marginBottom: 32, lineHeight: 1.6 }}>
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
              {
                title: "Reports & Export",
                desc: "Trial Balance, P&L, Balance Sheet, VAT reports",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    background: TWO_COLOR.hover,
                    border: "1px solid #000000",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#000000",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#000000" }}>
                    {feature.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#000000" }}>{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: "#000000" }}>
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
                background: TWO_COLOR.card,
                border: "1px solid #000000",
                borderRadius: 4,
                padding: 32,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#000000", marginBottom: 4 }}>
                Sign In
              </h3>
              <p style={{ fontSize: 12, color: "#000000", marginBottom: 24 }}>
                Enter your credentials to access the system
              </p>

              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#000000",
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
                      border: "1px solid #000000",
                      background: TWO_COLOR.card,
                      color: "#000000",
                      borderRadius: 3,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#000000",
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
                      border: "1px solid #000000",
                      background: TWO_COLOR.card,
                      color: "#000000",
                      borderRadius: 3,
                      outline: "none",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    height: 38,
                    background: TWO_COLOR.muted,
                    border: "1px solid #000000",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#000000",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Authorizing..." : "Authorize Entry"}
                </button>
              </form>
            </div>

            <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#000000" }}>
              All activities are logged for compliance.
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            background: TWO_COLOR.muted,
            borderBottom: "1px solid #000000",
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
                background: TWO_COLOR.hover,
                border: "1px solid #000000",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                color: "#000000",
              }}
            >
              S
            </div>
            <span style={{ fontWeight: 600, color: "#000000", fontSize: 14 }}>
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace(/-/g, " ")}
            </span>
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "transparent",
              border: "1px solid #000000",
              borderRadius: 4,
              padding: 6,
              cursor: "pointer",
              color: "#000000",
            }}
          >
            <Menu style={{ width: 18, height: 18, color: "#000000" }} />
          </button>
        </header>

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            paddingBottom: 72,
            background: TWO_COLOR.bg,
          }}
        >
          {children}
        </main>

        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 56,
            background: TWO_COLOR.muted,
            borderTop: "1px solid #000000",
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
                color: "#000000",
                fontWeight: currentPage === page ? 700 : 400,
              }}
            >
              <Icon style={{ width: 20, height: 20, color: "#000000" }} />
              <span style={{ fontSize: 10, color: "#000000" }}>{label}</span>
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
                  borderBottom: "1px solid #000000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: TWO_COLOR.muted,
                  color: "#000000",
                }}
              >
                <span style={{ fontWeight: 600, color: "#000000" }}>Menu</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid #000000",
                    borderRadius: 4,
                    padding: 4,
                    cursor: "pointer",
                    color: "#000000",
                  }}
                >
                  <X style={{ width: 16, height: 16, color: "#000000" }} />
                </button>
              </div>
              <Sidebar collapsed={false} setCollapsed={() => undefined} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="app-layout-with-topbar"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: TWO_COLOR.muted,
      }}
    >
      <TopMenuBar />
      <TitleBar onMinimize={() => setIsMinimized((prev) => !prev)} />
      {!isMinimized && (
        <>
          <BusyMenuBar />
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            <main style={{ flex: 1, overflowY: "auto", padding: 12, background: TWO_COLOR.bg }}>
              {children}
            </main>
            <ShortcutSidebar onShortcut={handleSidebarShortcut} />
          </div>
          <CommandHintBar />
          <StatusBar />
        </>
      )}
      {isMinimized && (
        <div onClick={() => setIsMinimized(false)} style={{ flex: 1, background: TWO_COLOR.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          Click here to restore Sutra ERP
        </div>
      )}
    </div>
  );
};

export default Layout;
