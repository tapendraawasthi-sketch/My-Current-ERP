import React, { useState } from "react";
import {
  PageHeader,
  PageMeta,
  Button,
  Section,
  SectionHeader,
  EmptyState,
  LoadingState,
  RecoveryPanel,
  Skeleton,
  StatusChip,
  Banner,
  SyncStatusChip,
} from "@/design-system";
import type { SyncVisualState } from "@/design-system";
import {
  ArrowRight,
  Banknote,
  FileText,
  HardDrive,
  Landmark,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  Scale,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEKhataStore } from "@/store/eKhataStore";
import { useHomeDashboard } from "./useHomeDashboard";
import { freshnessLabel, metricTone } from "./format";
import type {
  ActivityItem,
  AttentionItem,
  DashboardChartModel,
  DashboardMetric,
  HomeViewModel,
  QuickActionDef,
} from "./types";
import { useIsMobile } from "@/hooks/use-mobile";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  TrendingDown,
  Receipt,
  Banknote,
  FileText,
  Landmark,
  Scale,
  Package,
  Users,
  HardDrive,
  MessageSquare,
  ShoppingCart,
};

function syncVisual(state: string): SyncVisualState {
  if (state === "local_only") return "local";
  const allowed: SyncVisualState[] = [
    "synced",
    "syncing",
    "pending",
    "offline",
    "failed",
    "retry_scheduled",
    "conflict",
    "action_required",
    "local",
    "stale",
  ];
  return (allowed.includes(state as SyncVisualState) ? state : "pending") as SyncVisualState;
}

function MetricCard({
  metric,
  onNavigate,
}: {
  metric: DashboardMetric;
  onNavigate: (page: string) => void;
}) {
  const interactive = Boolean(metric.drillDownRoute) && metric.freshness !== "unavailable";
  const tone = metricTone(metric.favourability, typeof metric.value === "number" ? metric.value : null);
  const valueClass =
    tone === "unfavourable"
      ? "ds-financial-value text-[var(--ds-financial-unfavourable)]"
      : "ds-financial-value text-[var(--ds-text)]";

  const body = (
    <>
      <p className="text-[12px] font-medium text-[var(--ds-text-muted)]">{metric.label}</p>
      <p className={`mt-2 text-[20px] font-semibold tracking-tight ${valueClass}`} aria-label={`${metric.label}: ${metric.formattedValue}`}>
        {metric.formattedValue}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ds-text-subtle)]">
        <span>{freshnessLabel(metric.freshness)}</span>
        {metric.periodLabel ? <span>· {metric.periodLabel}</span> : null}
        {metric.unavailableReason ? (
          <span className="text-[var(--ds-danger)]">{metric.unavailableReason}</span>
        ) : null}
      </div>
    </>
  );

  const className =
    "rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 text-left";

  if (interactive && metric.drillDownRoute) {
    return (
      <button
        type="button"
        className={`${className} hover:border-[var(--ds-primary)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-focus-ring)]`}
        onClick={() => onNavigate(metric.drillDownRoute!)}
      >
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function AttentionList({
  items,
  onNavigate,
  limit = 5,
}: {
  items: AttentionItem[];
  onNavigate: (page: string) => void;
  limit?: number;
}) {
  const shown = items.slice(0, limit);
  if (shown.length === 0) {
    return (
      <p className="text-[13px] text-[var(--ds-text-muted)]">No urgent items require attention.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {shown.map((item) => {
        const border =
          item.severity === "danger"
            ? "border-[var(--ds-danger)]/30 bg-[var(--ds-danger-soft,var(--ds-surface-muted))]"
            : item.severity === "warning"
              ? "border-[var(--ds-warning)]/30 bg-[var(--ds-warning-soft,var(--ds-surface-muted))]"
              : "border-[var(--ds-border)] bg-[var(--ds-surface-muted)]";
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`w-full rounded-[var(--ds-radius-md)] border px-3 py-2.5 text-left ${border} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-focus-ring)]`}
              onClick={() => item.route && onNavigate(item.route)}
              disabled={!item.route}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--ds-text)]">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">{item.description}</p>
                  ) : null}
                  {item.amountFormatted ? (
                    <p className="mt-1 ds-financial-value text-[12px]">{item.amountFormatted}</p>
                  ) : null}
                </div>
                {item.actionLabel ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[var(--ds-primary)]">
                    {item.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function QuickActionList({
  actions,
  onNavigate,
  onOrbix,
}: {
  actions: QuickActionDef[];
  onNavigate: (page: string) => void;
  onOrbix: () => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => {
        const Icon = ICONS[action.icon] || FileText;
        return (
          <button
            key={action.id}
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--ds-text)] hover:bg-[var(--ds-primary-soft,var(--ds-surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-focus-ring)]"
            onClick={() => (action.orbix ? onOrbix() : onNavigate(action.page))}
          >
            <Icon className="h-4 w-4 shrink-0 text-[var(--ds-primary)]" aria-hidden />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActivityList({
  items,
  onNavigate,
}: {
  items: ActivityItem[];
  onNavigate: (page: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-[13px] text-[var(--ds-text-muted)]">No recent documents yet.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--ds-border)]">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-[13px] hover:text-[var(--ds-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-focus-ring)]"
            onClick={() => onNavigate(item.route)}
          >
            <span className="min-w-0 truncate font-medium text-[var(--ds-text)]">
              {item.title}
              {item.subtitle ? (
                <span className="ml-2 font-normal text-[var(--ds-text-muted)]">{item.subtitle}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-[12px] text-[var(--ds-text-subtle)]">{item.when || "—"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AgeingChart({
  chart,
  onNavigate,
}: {
  chart: DashboardChartModel;
  onNavigate: (page: string) => void;
}) {
  const max = Math.max(1, ...chart.buckets.map((b) => b.amount));
  return (
    <Section className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <SectionHeader
        title={chart.title}
        description={`${chart.purpose}. ${chart.periodLabel}. Unit: ${chart.unit}.`}
        actions={
          <Button variant="quiet" size="small" onClick={() => onNavigate(chart.drillDownRoute)}>
            View report
          </Button>
        }
      />
      {chart.unavailableReason ? (
        <p className="mt-3 text-[13px] text-[var(--ds-text-muted)]">{chart.unavailableReason}</p>
      ) : (
        <>
          <p className="sr-only">{chart.accessibleSummary}</p>
          <div className="mt-4 space-y-2" role="img" aria-label={chart.accessibleSummary}>
            {chart.buckets.map((b) => {
              const pct = Math.max(0, Math.min(100, Math.round((b.amount / max) * 100)));
              const barWidth =
                pct >= 100
                  ? "w-full"
                  : pct >= 75
                    ? "w-3/4"
                    : pct >= 50
                      ? "w-1/2"
                      : pct >= 25
                        ? "w-1/4"
                        : pct > 0
                          ? "w-[12%]"
                          : "w-0";
              return (
                <div key={b.key} className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
                  <span className="text-[12px] text-[var(--ds-text-muted)]">{b.label}</span>
                  <div className="h-2 overflow-hidden rounded bg-[var(--ds-surface-muted)]" aria-hidden>
                    <div className={`h-full rounded bg-[var(--ds-primary)] ${barWidth}`} />
                  </div>
                  <span className="ds-financial-value text-[12px] text-[var(--ds-text)]">{b.formattedAmount}</span>
                </div>
              );
            })}
          </div>
          <table className="mt-4 w-full text-[12px]">
            <caption className="sr-only">Receivable ageing data table</caption>
            <thead>
              <tr className="text-left text-[var(--ds-text-muted)]">
                <th scope="col" className="py-1 font-medium">Bucket</th>
                <th scope="col" className="py-1 font-medium">Count</th>
                <th scope="col" className="py-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {chart.buckets.map((b) => (
                <tr key={`t-${b.key}`} className="border-t border-[var(--ds-border)]">
                  <td className="py-1.5">{b.label}</td>
                  <td className="py-1.5">{b.count}</td>
                  <td className="py-1.5 text-right ds-financial-value">{b.formattedAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Section>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <LoadingState label="Loading home workspace…" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[var(--ds-radius-md)]" />
        ))}
      </div>
    </div>
  );
}

function renderSections(
  model: HomeViewModel,
  order: string[],
  nav: (page: string) => void,
  openOrbix: () => void,
) {
  return order.map((key) => {
    switch (key) {
      case "attention":
        return (
          <Section
            key={key}
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"
          >
            <SectionHeader
              title="Attention"
              description="Authoritative issues that need review — actions navigate only."
            />
            <div className="mt-3">
              <AttentionList items={model.attention} onNavigate={nav} />
            </div>
          </Section>
        );
      case "financial":
        return (
          <section key={key} aria-labelledby="home-financial-heading">
            <h2 id="home-financial-heading" className="mb-3 text-[14px] font-semibold text-[var(--ds-text)]">
              Money picture
            </h2>
            {model.metrics.length === 0 ? (
              <EmptyState
                title="No financial metrics available"
                description="Your role does not include financial overview permissions, or sources are unavailable."
              />
            ) : (
              <div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                data-testid="home-financial-metrics"
                data-metric-ids={model.metrics.map((m) => m.id).join(",")}
              >
                {model.metrics.slice(0, 4).map((m) => (
                  <MetricCard key={m.id} metric={m} onNavigate={nav} />
                ))}
              </div>
            )}
          </section>
        );
      case "quickActions":
        return (
          <Section
            key={key}
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"
          >
            <SectionHeader title="Do next" description="Open a workflow — Home does not post." />
            <div className="mt-3">
              <QuickActionList actions={model.quickActions} onNavigate={nav} onOrbix={openOrbix} />
            </div>
          </Section>
        );
      case "trends":
        if (!model.charts.length) return null;
        return (
          <div key={key} className="space-y-4">
            {model.charts.map((c) => (
              <AgeingChart key={c.id} chart={c} onNavigate={nav} />
            ))}
          </div>
        );
      case "activity":
        return (
          <Section
            key={key}
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"
          >
            <SectionHeader title="Recent activity" description="Recent vouchers and invoices for this company." />
            <div className="mt-3">
              <ActivityList items={model.activity} onNavigate={nav} />
            </div>
          </Section>
        );
      case "orbix":
        return (
          <Section
            key={key}
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"
          >
            <SectionHeader
              title="Ask Orbix"
              description="Entry prompts only — Orbix remains the conversation authority. Home does not fabricate insights."
              actions={
                <Button variant="secondary" size="small" onClick={openOrbix}>
                  Open Orbix
                </Button>
              }
            />
            <ul className="mt-3 flex flex-wrap gap-2">
              {model.orbixPrompts.map((p) => (
                <li key={p.id}>
                  <Button variant="quiet" size="small" onClick={openOrbix}>
                    {p.label}
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        );
      default:
        return null;
    }
  });
}

export function HomePage() {
  const {
    model,
    loading,
    refreshing,
    error,
    refresh,
    retry,
    setCurrentPage,
    branchFilter,
    setBranchFilter,
    branchOptions,
  } = useHomeDashboard();
  const openPanel = useEKhataStore((s) => s.openPanel);
  const maximizePanel = useEKhataStore((s) => s.maximizePanel);
  const isMobile = useIsMobile();

  const [moreOpen, setMoreOpen] = useState(() => {
    try {
      return localStorage.getItem("orbix_home_more_open") === "true";
    } catch {
      return false;
    }
  });

  const setMore = (open: boolean) => {
    setMoreOpen(open);
    try {
      localStorage.setItem("orbix_home_more_open", String(open));
    } catch {
      /* ignore */
    }
  };

  const openOrbix = () => {
    setCurrentPage("orbix");
    openPanel();
    maximizePanel();
  };

  const nav = (page: string) => setCurrentPage(page);

  if (loading && !model) {
    return (
      <div data-testid="home-page" data-home-state="loading" className="min-h-full">
        <HomeSkeleton />
      </div>
    );
  }

  if (error && !model) {
    return (
      <div data-testid="home-page" data-home-state="error" className="min-h-full">
        <RecoveryPanel
          title="Home could not be loaded"
          whatFailed={error}
          whatRemains="Day book and other pages remain available from navigation."
          onRetry={retry}
        />
      </div>
    );
  }

  if (!model) return null;

  /** One banner only — highest severity wins (Phase B Home Today). */
  const primaryBanner = model.trust.conflictCount > 0
    ? {
        tone: "danger" as const,
        title: "Sync conflict",
        description:
          model.trust.syncDetail ||
          "Conflicts require review. Pending is not the same as synced.",
      }
    : model.trust.offline
      ? {
          tone: "warning" as const,
          title: "Offline",
          description: "Showing available local data. Remote updates may be missing.",
        }
      : model.partialErrors.length > 0
        ? {
            tone: "warning" as const,
            title: "Partial data",
            description: `Some sources failed: ${model.partialErrors.slice(0, 3).join("; ")}. Valid sections remain.`,
          }
        : model.isNewCompany
          ? {
              tone: "info" as const,
              title: "New company",
              description:
                "No transactional history yet. Use Do next to add parties, items, or documents — Home will not invent balances.",
            }
          : null;

  const todayOrder = ["attention", "financial", "quickActions"];
  const moreOrder = ["activity", "trends", "orbix"];

  return (
    <div
      data-testid="home-page"
      data-home-workspace={model.workspaceId}
      data-home-freshness={model.trust.freshness}
      data-home-company={model.trust.companyId}
      data-home-layout="today"
      className="min-h-full space-y-5"
    >
      <PageHeader
        title="Today"
        description={`${model.workspaceLabel} · ${model.trust.companyName}`}
        status={
          <StatusChip tone={model.trust.conflictCount > 0 ? "danger" : "neutral"}>
            {freshnessLabel(model.trust.freshness)}
          </StatusChip>
        }
        meta={
          <PageMeta>
            <span>FY {model.trust.fiscalYearName}</span>
            <span>As of {model.trust.asOf}</span>
            <span>{model.trust.currency}</span>
            <SyncStatusChip state={syncVisual(model.trust.syncState)} />
          </PageMeta>
        }
        primaryAction={
          <Button
            variant="primary"
            size="small"
            onClick={openOrbix}
            startIcon={<MessageSquare className="h-4 w-4" aria-hidden />}
          >
            Ask Orbix
          </Button>
        }
        secondaryActions={[
          ...(branchOptions.length > 0
            ? [
                <select
                  key="branch"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] text-[var(--ds-text-default)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                  aria-label="Branch filter — All branches for Home metrics"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code || b.id}
                    </option>
                  ))}
                </select>,
              ]
            : []),
          <Button
            key="refresh"
            variant="secondary"
            size="small"
            onClick={refresh}
            disabled={refreshing}
            startIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>,
        ]}
      />

      {primaryBanner ? (
        <Banner
          tone={primaryBanner.tone}
          title={primaryBanner.title}
          description={primaryBanner.description}
        />
      ) : null}

      <div className={isMobile ? "space-y-5" : "grid gap-5 lg:grid-cols-12"}>
        <div className={isMobile ? "space-y-5" : "space-y-5 lg:col-span-8"}>
          {renderSections(
            model,
            todayOrder.filter((s) => s !== "attention" || isMobile),
            nav,
            openOrbix,
          )}
        </div>
        {!isMobile ? (
          <aside className="space-y-5 lg:col-span-4">
            {renderSections(model, ["attention"], nav, openOrbix)}
          </aside>
        ) : null}
      </div>

      <div
        className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]"
        data-testid="home-more"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--ds-surface-muted)]"
          aria-expanded={moreOpen}
          onClick={() => setMore(!moreOpen)}
        >
          <span>
            <span className="text-[13px] font-semibold text-[var(--ds-text-strong)]">
              More on this company
            </span>
            <span className="mt-0.5 block text-[12px] text-[var(--ds-text-muted)]">
              Recent activity, ageing, Orbix prompts, and data trust
            </span>
          </span>
          <span className="text-[12px] font-medium text-[var(--ds-action-primary)]">
            {moreOpen ? "Hide" : "Show"}
          </span>
        </button>
        {moreOpen ? (
          <div className="space-y-5 border-t border-[var(--ds-border-default)] p-4">
            {renderSections(model, moreOrder, nav, openOrbix)}
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-muted)] p-3 text-[12px] text-[var(--ds-text-muted)]">
              <p className="font-medium text-[var(--ds-text)]">Data trust</p>
              <p className="mt-1">{model.trust.basisLabel}</p>
              <p className="mt-1">Loaded {new Date(model.trust.loadedAt).toLocaleString()}</p>
              <p className="mt-1">
                Sync: {model.trust.syncState}
                {model.trust.pendingCount > 0 ? ` · pending ${model.trust.pendingCount}` : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default HomePage;
