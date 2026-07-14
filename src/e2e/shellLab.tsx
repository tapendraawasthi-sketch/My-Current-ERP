/**
 * Phase UI-3 — shell harness (dev / VITE_ALLOW_AUTH_FIXTURE only).
 * Deterministic chrome states without mutating accounting data.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/design-system/foundations/index.css";
import { applyDensity, applyDsTheme, type Density } from "@/design-system";
import AppShell from "../components/shell/AppShell";
import { useStore } from "../store/useStore";
import { filterNavForRole, canNavigateToPage, normalizeShellRole } from "../components/shell/shellNavVisibility";
import {
  getAggregatedSyncStatus,
  type UiSyncState,
} from "../platform/sync/syncStatusAggregate";

const ALLOWED =
  import.meta.env.DEV === true || import.meta.env.VITE_ALLOW_AUTH_FIXTURE === "true";

function ShellLabInner() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setPartial = useStore.setState;
  const [role, setRole] = useState("accountant");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [density, setDensity] = useState<Density>("productive");
  const [syncProbe, setSyncProbe] = useState<UiSyncState | "">("");

  useEffect(() => {
    applyDsTheme(theme);
    applyDensity(density);
  }, [theme, density]);

  useEffect(() => {
    setPartial({
      isAuthenticated: true,
      authStage: "authenticated",
      currentUser: {
        id: "ui3-lab-user",
        username: "lab.user",
        name: "Lab User",
        role,
        permissions: [],
      } as never,
      companySettings: {
        id: "lab-co",
        companyName: "Himalayan Precision Trading Pvt. Ltd.",
      } as never,
      currentFiscalYear: {
        id: "fy1",
        name: "2081/82",
        startDate: "2024-07-16",
        endDate: "2025-07-15",
        isCurrent: true,
        isClosed: false,
      },
      notifications: [
        {
          id: "n1",
          message: "Sync conflict requires review",
          read: false,
          timestamp: new Date().toISOString(),
          type: "conflict",
        },
        {
          id: "n2",
          message: "Backup completed",
          read: true,
          timestamp: new Date().toISOString(),
          type: "success",
        },
      ],
      currentPage: "dashboard",
    });
  }, [role, setPartial]);

  const navCount = filterNavForRole(role).length;
  const deniedUsers = !canNavigateToPage("users", role);

  return (
    <AppShell>
      <div className="space-y-4 p-2" data-testid="shell-lab-ready">
        <h1 className="text-[15px] font-semibold text-[var(--ds-text-strong)]">UI-3 Shell Laboratory</h1>
        <p className="text-[13px] text-[var(--ds-text-muted)]">
          Role={normalizeShellRole(role)} · modules={navCount} · usersDenied={String(deniedUsers)}
        </p>
        <div className="flex flex-wrap gap-2">
          {["owner", "accountant", "cashier", "auditor", "admin", "inventory", "banking"].map((r) => (
            <button
              key={r}
              type="button"
              className="rounded border px-2 py-1 text-[13px]"
              data-testid={`shell-lab-role-${r}`}
              onClick={() => {
                setRole(r);
                setPartial({
                  currentUser: {
                    id: "ui3-lab-user",
                    username: "lab.user",
                    name: "Lab User",
                    role: r,
                    permissions: [],
                  } as never,
                });
              }}
            >
              {r}
            </button>
          ))}
          <button type="button" className="rounded border px-2 py-1 text-[13px]" onClick={() => setTheme("light")}>
            Light
          </button>
          <button type="button" className="rounded border px-2 py-1 text-[13px]" onClick={() => setTheme("dark")}>
            Dark
          </button>
          {(["comfortable", "productive", "compact"] as Density[]).map((d) => (
            <button key={d} type="button" className="rounded border px-2 py-1 text-[13px]" onClick={() => setDensity(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="rounded border px-2 py-1 text-[13px]" onClick={() => setCurrentPage("billing")}>
            Go Sales
          </button>
          <button type="button" className="rounded border px-2 py-1 text-[13px]" onClick={() => setCurrentPage("users")}>
            Deep-link Users
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-[13px]"
            onClick={() => {
              void getAggregatedSyncStatus(true, "pending").then((a) => setSyncProbe(a.state));
            }}
          >
            Probe sync pending
          </button>
        </div>
        {syncProbe ? (
          <p data-testid="shell-sync-probe" className="text-[13px]">
            Aggregate state: {syncProbe}
          </p>
        ) : null}
        <p className="text-[13px]">Feature page stub — internals intentionally unchanged.</p>
      </div>
    </AppShell>
  );
}

function ShellLab() {
  if (!ALLOWED) {
    return (
      <div data-testid="shell-lab-blocked" className="p-8 text-[14px]">
        Shell lab is not available in production.
      </div>
    );
  }
  return <ShellLabInner />;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<ShellLab />);
