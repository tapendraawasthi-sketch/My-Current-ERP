import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, EmptyState, Input, LoadingState } from "@/design-system";
import { PreWorkspaceShell, CompanyMonogram, environmentLabel } from "./PreWorkspaceShell";
import { CompanyOpeningPanel, TrustSyncHint } from "./AuthAccessSurfaces";

function formatLoginDate(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return (
    d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

function loginAtOf(info: { loginAt?: string; loggedInAt?: string } | null | undefined): string | undefined {
  return info?.loginAt || info?.loggedInAt;
}

export default function GatewayScreen() {
  const { companySettings, lastLoginInfo, selectCompanyForLogin, setAuthStage, isInitializing } =
    useStore();
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const [opening, setOpening] = useState(false);
  const [query, setQuery] = useState("");
  const env = environmentLabel();

  useEffect(() => {
    openBtnRef.current?.focus();
  }, [companySettings?.id]);

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "My Company";
  const companies = companySettings ? [companySettings] : [];
  const filtered = companies.filter((c) => {
    const n = (c.companyNameEn || c.name || "").toLowerCase();
    return !query.trim() || n.includes(query.trim().toLowerCase());
  });

  const handleOpen = () => {
    const companyId = companySettings?.id || "main";
    setOpening(true);
    selectCompanyForLogin(companyId);
  };

  return (
    <PreWorkspaceShell title="Choose a company" footerNote="Orbix ERP · Choose which organisation to open">
      <div
        className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-6 shadow-[var(--ds-shadow-1)]"
        data-testid="gateway-screen"
      >
        <div className="mb-5">
          <h2 className="text-[18px] font-semibold text-[var(--ds-text-strong)]">Choose a company</h2>
          <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
            Open an organisation you are authorised to access.
            {env.kind !== "production" ? ` Environment: ${env.label}.` : ""}
          </p>
        </div>

        {companies.length > 1 || query ? (
          <label className="mb-3 block">
            <span className="sr-only">Search companies</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-subtle)]"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies"
                className="h-9 pl-9 text-[14px]"
                aria-label="Search companies"
              />
            </div>
          </label>
        ) : null}

        {isInitializing && !companySettings ? (
          <LoadingState label="Loading company data…" />
        ) : !companySettings ? (
          <EmptyState
            title="No company available"
            description="No company is ready on this device. Create a company to continue, or contact an administrator."
            primaryAction={
              <Button variant="primary" onClick={() => setAuthStage("no-company")}>
                Create company
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching companies" description="Try a different search." />
        ) : (
          <ul className="space-y-2" aria-label="Companies">
            {filtered.map((co) => {
              const name = co.companyNameEn || co.name || "Company";
              const lastAt = loginAtOf(lastLoginInfo);
              return (
                <li
                  key={co.id || "main"}
                  className="flex items-center gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-3"
                >
                  <CompanyMonogram name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[var(--ds-text-strong)]">{name}</div>
                    <div className="text-[13px] text-[var(--ds-text-muted)]">
                      PAN: {co.panNumber || "—"}
                      {co.vatNumber ? ` · VAT: ${co.vatNumber}` : ""}
                    </div>
                    {lastAt ? (
                      <div className="text-[13px] text-[var(--ds-text-muted)]">
                        Last access: {formatLoginDate(lastAt)}
                        {lastLoginInfo?.username ? ` by ${lastLoginInfo.username}` : ""}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    ref={openBtnRef}
                    variant="primary"
                    size="small"
                    onClick={handleOpen}
                    loading={opening}
                    disabled={opening}
                    endIcon={<ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                    aria-label={`Open company ${name}`}
                    data-testid="gateway-open-company"
                  >
                    Open company
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <TrustSyncHint />

        {opening ? <CompanyOpeningPanel companyName={companyName} stage="verifying" /> : null}

        <div className="mt-5 border-t border-[var(--ds-border-subtle)] pt-4 text-center">
          <Button variant="quiet" onClick={() => setAuthStage("no-company")}>
            Create new company
          </Button>
        </div>
      </div>
    </PreWorkspaceShell>
  );
}
