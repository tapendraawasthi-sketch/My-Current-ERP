import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useGlobalKeyboardShortcuts } from "../hooks/useGlobalKeyboardShortcuts";
import { useF12Keyboard } from "../hooks/useF12Keyboard";
import AppShell from "./shell/AppShell";
import toast from "@/lib/appToast";
import { startSyncLoop, stopSyncLoop } from "../lib/syncEngine";
import { startAutoBackupScheduler, stopAutoBackupScheduler } from "../lib/autoBackupScheduler";

interface LayoutProps {
  children: React.ReactNode;
}

const THEME = {
  bg: "var(--ox-bg)",
  card: "var(--ox-surface)",
  muted: "var(--ox-surface-muted)",
  hover: "var(--ox-primary-soft)",
  border: "var(--ox-border)",
  text: "var(--ox-text)",
  accent: "var(--ox-primary)",
  accentHover: "var(--ox-primary-hover)",
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    isAuthenticated,
    isDbReady,
    login,
    currentUser,
    setCurrentPage,
  } = useStore();

  useKeyboardShortcuts();
  useF12Keyboard();

  useGlobalKeyboardShortcuts((page: string) => {
    if (!isAuthenticated || !isDbReady) return;
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if ((activeEl as HTMLElement)?.isContentEditable) return;
    const hasOpenModal =
      document.querySelector('[role="dialog"]') !== null ||
      document.querySelector('[aria-modal="true"]') !== null;
    if (hasOpenModal) return;
    setCurrentPage(page);
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isDbReady) {
      startSyncLoop();
      startAutoBackupScheduler(() => useStore.getState().companySettings);
      return () => {
        stopSyncLoop();
        stopAutoBackupScheduler();
      };
    }
    return undefined;
  }, [isAuthenticated, isDbReady]);

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
              background: "var(--ox-primary)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 28,
              color: "#ffffff",
            }}
          >
            O
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ox-text)" }}>Orbix ERP</div>
            <div style={{ fontSize: 12, color: "var(--ox-text-muted)", marginTop: 4 }}>
              Initializing database…
            </div>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid var(--ox-primary-soft)",
              borderTopColor: "var(--ox-primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME.bg,
          padding: 24,
        }}
      >
        <form
          onSubmit={handleLoginSubmit}
          style={{
            width: "100%",
            maxWidth: 380,
            background: THEME.card,
            border: `1px solid ${THEME.border}`,
            borderRadius: 12,
            padding: 28,
            boxShadow: "var(--ox-shadow-md)",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ox-text)", marginBottom: 4 }}>
            Sign in to Orbix
          </h1>
          <p style={{ fontSize: 12, color: "var(--ox-text-muted)", marginBottom: 20 }}>
            Secure access to your company books
          </p>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-3 h-9 w-full px-3 text-[13px]"
            autoComplete="username"
          />
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 h-9 w-full px-3 text-[13px]"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-md bg-[var(--ox-primary)] text-[13px] font-semibold text-white hover:bg-[var(--ox-primary-hover)] disabled:opacity-60"
          >
            {loading ? "Authorizing…" : "Sign In"}
          </button>
          {currentUser && (
            <p className="mt-3 text-center text-[11px] text-[var(--ox-text-subtle)]">
              Last user: {currentUser.username || currentUser.name}
            </p>
          )}
        </form>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
};

export default Layout;
