/**
 * Phase UI-5 — Home harness (dev / VITE_ALLOW_AUTH_FIXTURE only).
 * Seeds store identity for HomePage; does not mutate accounting ledgers.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/design-system/foundations/index.css";
import { applyDensity, applyDsTheme, type Density } from "@/design-system";
import { HomePage } from "@/features/home/HomePage";
import { useStore } from "../store/useStore";

const ALLOWED =
  import.meta.env.DEV === true || import.meta.env.VITE_ALLOW_AUTH_FIXTURE === "true";

declare global {
  interface Window {
    __homeFixture?: {
      setRole: (role: string) => void;
      setTheme: (theme: "light" | "dark") => void;
      setDensity: (density: Density) => void;
      getState: () => { role: string; theme: string; density: Density };
    };
  }
}

function seedStore(role: string) {
  useStore.setState({
    isAuthenticated: true,
    authStage: "authenticated",
    currentUser: {
      id: "ui5-lab-user",
      username: "lab.user",
      name: "Lab User",
      role,
      permissions: [],
    } as never,
    companySettings: {
      id: "lab-co",
      companyName: "Himalayan Precision Trading Pvt. Ltd.",
      companyNameEn: "Himalayan Precision Trading Pvt. Ltd.",
      currencySymbol: "Rs.",
      defaultCurrency: "NPR",
    } as never,
    currentFiscalYear: {
      id: "fy1",
      name: "2081/82",
      startDate: "2024-07-16",
      endDate: "2025-07-15",
      isCurrent: true,
      isClosed: false,
    },
    accounts: [],
    parties: [],
    items: [],
    invoices: [],
    vouchers: [],
    currentPage: "dashboard",
  });
}

function HomeLabInner() {
  const [role, setRole] = useState("accountant");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [density, setDensity] = useState<Density>("productive");

  useEffect(() => {
    applyDsTheme(theme);
    applyDensity(density);
  }, [theme, density]);

  useEffect(() => {
    seedStore(role);
  }, [role]);

  useEffect(() => {
    window.__homeFixture = {
      setRole: (r: string) => {
        setRole(r);
        seedStore(r);
      },
      setTheme: (t) => setTheme(t),
      setDensity: (d) => setDensity(d),
      getState: () => ({ role, theme, density }),
    };
    return () => {
      delete window.__homeFixture;
    };
  }, [role, theme, density]);

  return (
    <div className="ds-root min-h-screen bg-[var(--ds-canvas)] p-4" data-testid="home-lab-ready">
      <p className="mb-3 text-[12px] text-[var(--ds-text-muted)]">
        UI-5 Home Laboratory · role={role} · theme={theme} · density={density}
      </p>
      <HomePage key={role} />
    </div>
  );
}

function HomeLab() {
  if (!ALLOWED) {
    return (
      <div data-testid="home-lab-blocked" className="p-8 text-[14px]">
        Home lab is not available in production.
      </div>
    );
  }
  return <HomeLabInner />;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<HomeLab />);
