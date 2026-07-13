import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  FileText,
  Package,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { getBSTodayLong, getBSToday } from "../lib/nepaliDate";
import { useEKhataStore } from "../store/eKhataStore";

const FinancialDashboard: React.FC = () => {
  const {
    currentFiscalYear,
    companySettings,
    setCurrentPage,
    invoices = [],
    vouchers = [],
    parties = [],
    items = [],
  } = useStore();
  const openOrbix = useEKhataStore((s) => s.openPanel);
  const maximizeOrbix = useEKhataStore((s) => s.maximizePanel);

  let bsDateStr = "";
  try {
    bsDateStr = getBSTodayLong();
  } catch {
    bsDateStr = getBSToday();
  }

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "Your company";
  const fiscalYearName = currentFiscalYear?.name ?? "—";

  const openOrbixWorkspace = () => {
    setCurrentPage("orbix");
    openOrbix();
    maximizeOrbix();
  };

  const quickActions = [
    { label: "New sale", page: "billing", icon: TrendingUp },
    { label: "New purchase", page: "purchase", icon: TrendingDown },
    { label: "New receipt", page: "receipt", icon: Receipt },
    { label: "New payment", page: "payment", icon: Banknote },
    { label: "Balance Sheet", page: "balance-sheet", icon: FileText },
    { label: "Ask Orbix", page: "orbix", icon: Sparkles, orbix: true },
  ];

  const attention: { label: string; detail: string; page: string }[] = [];
  if ((parties as { id: string }[]).length === 0) {
    attention.push({
      label: "No parties yet",
      detail: "Add customers and suppliers to start billing",
      page: "parties",
    });
  }
  if ((items as { id: string }[]).length === 0) {
    attention.push({
      label: "No inventory items",
      detail: "Create items before stock reports are useful",
      page: "items",
    });
  }

  const recentVouchers = [...(vouchers as { id: string; voucherNumber?: string; voucherType?: string; date?: string }[])]
    .slice(-5)
    .reverse();
  const recentInvoices = [...(invoices as { id: string; invoiceNumber?: string; type?: string }[])]
    .slice(-5)
    .reverse();

  return (
    <div className="min-h-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ox-text)]">
            Home
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ox-text-muted)]">
            {companyName} · FY {fiscalYearName} · {bsDateStr}
          </p>
        </div>
        <button
          type="button"
          onClick={openOrbixWorkspace}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--ox-radius-md)] bg-[var(--ox-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ox-primary-hover)]"
        >
          <Sparkles className="h-4 w-4" />
          Ask Orbix
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Parties",
            value: String((parties as unknown[]).length),
            icon: Receipt,
            page: "parties",
          },
          {
            label: "Items",
            value: String((items as unknown[]).length),
            icon: Package,
            page: "items",
          },
          {
            label: "Invoices",
            value: String((invoices as unknown[]).length),
            icon: FileText,
            page: "billing",
          },
          {
            label: "Vouchers",
            value: String((vouchers as unknown[]).length),
            icon: Banknote,
            page: "day-book",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setCurrentPage(card.page)}
              className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4 text-left shadow-[var(--ox-shadow-sm)] hover:border-[var(--ox-primary)]/30"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--ox-text-muted)]">
                  {card.label}
                </span>
                <Icon className="h-4 w-4 text-[var(--ox-text-subtle)]" />
              </div>
              <p className="font-mono text-[24px] font-semibold tabular-nums text-[var(--ox-text)]">
                {card.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4 lg:col-span-2">
          <h2 className="text-[14px] font-semibold text-[var(--ox-text)]">Quick actions</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    if (action.orbix) openOrbixWorkspace();
                    else setCurrentPage(action.page);
                  }}
                  className="inline-flex items-center gap-2 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--ox-text)] hover:bg-[var(--ox-primary-soft)]"
                >
                  <Icon className="h-4 w-4 text-[var(--ox-primary)]" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--ox-warning)]" />
            <h2 className="text-[14px] font-semibold text-[var(--ox-text)]">Attention required</h2>
          </div>
          {attention.length === 0 ? (
            <p className="text-[13px] text-[var(--ox-text-muted)]">
              No urgent setup items detected. Use Orbix for receivables, payables, and stock
              questions.
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(item.page)}
                    className="w-full rounded-[var(--ox-radius-md)] border border-[var(--ox-warning)]/25 bg-[var(--ox-warning-soft)] px-3 py-2 text-left"
                  >
                    <p className="text-[12px] font-semibold text-[var(--ox-text)]">{item.label}</p>
                    <p className="text-[11px] text-[var(--ox-text-muted)]">{item.detail}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--ox-text)]">Recent vouchers</h2>
            <button
              type="button"
              onClick={() => setCurrentPage("day-book")}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--ox-primary)]"
            >
              Day book <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentVouchers.length === 0 ? (
            <p className="text-[13px] text-[var(--ox-text-muted)]">No vouchers yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--ox-border)]">
              {recentVouchers.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="font-medium text-[var(--ox-text)]">
                    {v.voucherNumber || v.voucherType || "Voucher"}
                  </span>
                  <span className="text-[var(--ox-text-muted)]">{v.date || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--ox-text)]">Recent invoices</h2>
            <button
              type="button"
              onClick={() => setCurrentPage("billing")}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--ox-primary)]"
            >
              Billing <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-[13px] text-[var(--ox-text-muted)]">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--ox-border)]">
              {recentInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="font-medium text-[var(--ox-text)]">
                    {inv.invoiceNumber || "Invoice"}
                  </span>
                  <span className="text-[var(--ox-text-muted)]">{inv.type || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Ask Orbix
            </p>
            <p className="mt-1 max-w-2xl text-[13px] text-[var(--ox-text)]">
              Use Orbix for cash position, overdue receivables, Balance Sheet comparisons, and
              authorized entries. Insights appear in conversation from your live company data —
              this home screen does not invent metrics.
            </p>
          </div>
          <button
            type="button"
            onClick={openOrbixWorkspace}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3 text-[12px] font-medium text-[var(--ox-text)]"
          >
            Open Orbix
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default FinancialDashboard;
