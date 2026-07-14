/**
 * Shared pre-workspace (unauthenticated / pre-company) layout.
 * Does not include authenticated navigation.
 */
import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun } from "lucide-react";

export function environmentLabel(): { label: string; kind: "production" | "nonprod" } {
  if (import.meta.env.DEV) return { label: "Development", kind: "nonprod" };
  if (import.meta.env.MODE === "test" || import.meta.env.MODE === "training") {
    return { label: import.meta.env.MODE === "training" ? "Training" : "Test", kind: "nonprod" };
  }
  return { label: "Production", kind: "production" };
}

const OrbixMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
    <rect width="48" height="48" rx="8" className="fill-[var(--ds-action-primary)]" />
    <path
      d="M30 13C30 13 28 11 24 11C19 11 16 13.5 16 17C16 20.5 19 22 24 23C29 24 32 25.5 32 29C32 32.5 29 37 24 37C19 37 16 35 16 35"
      stroke="white"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <line x1="13" y1="41" x2="35" y2="41" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const PreWorkspaceShell: React.FC<{
  children: React.ReactNode;
  title?: string;
  showBrandPanel?: boolean;
  footerNote?: string;
  /** Default form card; wide for onboarding */
  contentWidth?: "default" | "wide";
}> = ({ children, title, showBrandPanel = true, footerNote, contentWidth = "default" }) => {
  const { theme, toggleTheme } = useTheme();
  const env = environmentLabel();

  return (
    <div
      className="ds-root flex min-h-screen flex-col bg-[var(--ds-canvas)] text-[var(--ds-text-default)]"
      data-component="pre-workspace-shell"
      data-testid="pre-workspace-shell"
    >
      <a
        href="#pre-workspace-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[var(--ds-z-toast)] focus:rounded-[var(--ds-radius-md)] focus:bg-[var(--ds-surface-raised)] focus:px-3 focus:py-2 focus:text-[14px]"
      >
        Skip to main content
      </a>
      <header
        className="ds-no-print flex h-14 items-center justify-between border-b border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4"
        role="banner"
      >
        <div className="flex items-center gap-2.5">
          <OrbixMark size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[var(--ds-text-strong)]">Orbix ERP</span>
              {env.kind !== "production" ? (
                <span
                  className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-status-warning)]/40 bg-[var(--ds-status-warning-surface)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--ds-status-warning)]"
                  title="Non-production environment"
                >
                  {env.label}
                </span>
              ) : null}
            </div>
            <p className="text-[12px] text-[var(--ds-text-muted)]">Intelligent ERP</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="ds-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)]"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
          <a
            href="#pre-workspace-support"
            className="ds-focus-ring hidden rounded-[var(--ds-radius-md)] px-2 py-1 text-[13px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text-default)] sm:inline"
          >
            Help
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {showBrandPanel ? (
          <div
            role="complementary"
            className="hidden border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-raised)] px-8 py-10 lg:flex lg:w-[40%] lg:flex-col lg:justify-center lg:border-b-0 lg:border-r"
            aria-label="Product identity"
            data-pre-workspace-brand=""
          >
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ds-text-strong)]">
              Intelligent accounting and business control, built for Nepal.
            </h1>
            <ul className="mt-6 space-y-3 text-[14px] text-[var(--ds-text-default)]">
              <li>Company-based access with audit trail</li>
              <li>Local continuity with authoritative synchronization</li>
              <li>Fiscal-period and permission controls</li>
            </ul>
            <p className="mt-8 text-[13px] text-[var(--ds-text-default)]">
              No unsupported security claims. Work remains under your company’s access rules.
            </p>
          </div>
        ) : null}

        <main
          id="pre-workspace-main"
          className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6"
          tabIndex={-1}
        >
          {title ? (
            <h1 className="sr-only">{title}</h1>
          ) : null}
          <div className={contentWidth === "wide" ? "w-full max-w-3xl" : "w-full max-w-md"}>
            {children}
          </div>
        </main>
      </div>

      <footer
        id="pre-workspace-support"
        className="border-t border-[var(--ds-border-subtle)] px-4 py-3 text-center text-[12px] text-[var(--ds-text-muted)]"
      >
        {footerNote || "Orbix ERP · Activity is logged for compliance · Contact your administrator for access help"}
      </footer>
    </div>
  );
};

export function CompanyMonogram({ name }: { name: string }) {
  const letter = (name.charAt(0) || "C").toUpperCase();
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] text-[15px] font-semibold text-[var(--ds-action-primary)]"
      aria-hidden
    >
      {letter}
    </div>
  );
}

export default PreWorkspaceShell;
