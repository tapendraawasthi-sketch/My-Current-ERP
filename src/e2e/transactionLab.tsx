/**
 * Phase UI-7 — transaction workspace lab (structure + a11y).
 * Connected posting remains in domain / orbix-connected suites.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/design-system/foundations/index.css";
import { applyDensity, applyDsTheme, type Density } from "@/design-system";
import {
  TransactionWorkspace,
  TransactionInspector,
  syncStatusToLifecycle,
  type TransactionLifecycle,
} from "@/features/transactions";
import { useStore } from "../store/useStore";

const ALLOWED =
  import.meta.env.DEV === true || import.meta.env.VITE_ALLOW_AUTH_FIXTURE === "true";

declare global {
  interface Window {
    __txnFixture?: {
      setFamily: (f: string) => void;
      setLifecycle: (l: TransactionLifecycle) => void;
      setTheme: (t: "light" | "dark") => void;
      setDensity: (d: Density) => void;
      seedPosted: (sync?: string) => void;
    };
  }
}

function seed() {
  useStore.setState({
    isAuthenticated: true,
    authStage: "authenticated",
    currentUser: {
      id: "ui7-lab",
      username: "lab.user",
      name: "Lab User",
      role: "accountant",
      permissions: [],
    } as never,
    companySettings: {
      id: "lab-co",
      companyName: "Himalayan Precision Trading Pvt. Ltd.",
      companyNameEn: "Himalayan Precision Trading Pvt. Ltd.",
    } as never,
    currentFiscalYear: {
      id: "fy1",
      name: "2081/82",
      startDate: "2024-07-16",
      endDate: "2025-07-15",
      isCurrent: true,
      isClosed: false,
    },
    currentPage: "billing",
  });
}

function TxnLabInner() {
  const [family, setFamily] = useState("sales");
  const [lifecycle, setLifecycle] = useState<TransactionLifecycle>("draft");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [density, setDensity] = useState<Density>("productive");
  const [result, setResult] = useState<{
    documentNumber: string;
    amountLabel: string;
    lifecycle: TransactionLifecycle;
    syncStatus?: string;
  } | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  useEffect(() => {
    seed();
  }, []);
  useEffect(() => {
    applyDsTheme(theme);
    applyDensity(density);
  }, [theme, density]);

  useEffect(() => {
    window.__txnFixture = {
      setFamily,
      setLifecycle,
      setTheme,
      setDensity,
      seedPosted: (sync = "pending") => {
        setLifecycle(syncStatusToLifecycle(sync));
        setResult({
          documentNumber: "SI-LAB-001",
          amountLabel: "NPR 11,300.00",
          lifecycle: syncStatusToLifecycle(sync),
          syncStatus: sync,
        });
      },
    };
    return () => {
      delete window.__txnFixture;
    };
  }, []);

  const mode =
    family === "journal"
      ? "journal-document"
      : family === "contra"
        ? "transfer-document"
        : family === "receipt" || family === "payment"
          ? "settlement-document"
          : "inventory-document";

  return (
    <div className="ds-root min-h-screen bg-[var(--ds-canvas)] p-4" data-testid="txn-lab-ready">
      <p className="mb-2 text-[12px] text-[var(--ds-text-muted)]">
        UI-7 Transaction Laboratory · {family} · {lifecycle}
      </p>
      <TransactionWorkspace
        title={`${family[0]?.toUpperCase()}${family.slice(1)} document`}
        description="Shared transaction canvas laboratory"
        family={family}
        mode={mode as never}
        companyName="Himalayan Precision Trading Pvt. Ltd."
        fiscalYearName="2081/82"
        lifecycle={lifecycle}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        postingResult={
          result
            ? {
                documentNumber: result.documentNumber,
                amountLabel: result.amountLabel,
                lifecycle: result.lifecycle,
                syncStatus: result.syncStatus,
                message:
                  result.lifecycle === "synced"
                    ? "Remote acknowledgement received"
                    : "Local posting succeeded",
              }
            : null
        }
        inspector={
          <TransactionInspector>
            <p className="text-[13px] text-[var(--ds-text-default)]">Company ledger · Masters</p>
            <p className="text-[12px] text-[var(--ds-text-muted)]">
              Sync: {result?.syncStatus || "n/a"}
            </p>
          </TransactionInspector>
        }
      >
        <div className="space-y-3" data-testid="txn-lab-canvas-body">
          <label className="block text-[12px] font-medium text-[var(--ds-text-default)]">
            Party
            <input
              className="mt-1 h-8 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-2.5 text-[13px]"
              defaultValue="Demo Customer"
              aria-label="Party"
            />
          </label>
          <div
            className="overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)]"
            data-testid="txn-lab-grid"
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--ds-surface-muted)]">
                  <th className="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Account / Item
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Debit
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2">Cash</td>
                  <td className="px-3 py-2 text-right font-mono">11,300</td>
                  <td className="px-3 py-2 text-right font-mono">—</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Sales</td>
                  <td className="px-3 py-2 text-right font-mono">—</td>
                  <td className="px-3 py-2 text-right font-mono">11,300</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TransactionWorkspace>
    </div>
  );
}

function TxnLab() {
  if (!ALLOWED) {
    return (
      <div data-testid="txn-lab-blocked" className="p-8 text-[14px]">
        Transaction lab is not available in this build.
      </div>
    );
  }
  return <TxnLabInner />;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<TxnLab />);
