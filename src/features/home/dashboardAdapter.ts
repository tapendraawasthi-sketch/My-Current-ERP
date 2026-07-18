/**
 * Home dashboard adapter — authoritative services → typed view model.
 * Does not reimplement trial balance, P&L, or settlement math.
 */

import {
  computeOutstandingPayables,
  computeOutstandingReceivables,
  computeAgingReport,
} from "@/lib/accounting";
import { isCashOrBankAccount } from "@/domains/settlement/postingFramework";
import { readAllAccountBalances } from "@/domains/report-engine/accountLedgerReader";
import { buildProfitLossFromProjection } from "@/domains/report-engine/profitLossBuilder";
import { buildInventoryValuationReport } from "@/domains/report-engine/inventoryValuationReport";
import { readTrialBalanceFromProjection } from "@/domains/report-engine/trialBalanceProjectionReader";
import { buildAgingReportFromProjection } from "@/domains/report-engine/agingReportBuilder";
import {
  getAggregatedSyncStatus,
  type UiSyncState,
} from "@/platform/sync/syncStatusAggregate";
import type { UserPermission } from "@/lib/permissions";
import {
  WORKSPACE_METRICS,
  WORKSPACE_SECTION_ORDER,
  canViewScreen,
  resolvePermissionProfile,
  resolveWorkspaces,
} from "./roleWorkspace";
import { selectQuickActions } from "./quickActions";
import { formatHomeAmount, formatHomeCount, resolveCurrencySymbol } from "./format";
import type {
  ActivityItem,
  AttentionItem,
  DashboardChartModel,
  DashboardFreshness,
  DashboardMetric,
  DataTrustContext,
  HomeViewModel,
  HomeWorkspaceId,
} from "./types";

export interface HomeAdapterInput {
  companyId: string;
  companySettings: {
    id?: string;
    companyNameEn?: string;
    name?: string;
    companyName?: string;
    currencySymbol?: string;
    defaultCurrency?: string;
  } | null;
  currentFiscalYear: {
    name?: string;
    startDate?: string;
    endDate?: string;
  } | null;
  currentUser: { id?: string; role?: string; name?: string } | null;
  permissions: UserPermission | null;
  accounts: Array<{
    id: string;
    name?: string;
    code?: string;
    type?: string;
    isCash?: boolean;
    isBank?: boolean;
    isGroup?: boolean;
  }>;
  parties: unknown[];
  items: Array<{
    id: string;
    name?: string;
    quantity?: number;
    reorderLevel?: number;
    currentStock?: number;
  }>;
  invoices: Array<{
    id: string;
    type?: string;
    status?: string;
    date?: string;
    grandTotal?: number;
    total?: number;
    invoiceNumber?: string;
    partyId?: string;
    paidAmount?: number;
    paymentStatus?: string;
    dueDate?: string;
  }>;
  vouchers: Array<{
    id: string;
    voucherNumber?: string;
    voucherType?: string;
    date?: string;
    status?: string;
  }>;
  online?: boolean;
  refreshing?: boolean;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapSyncToFreshness(state: UiSyncState, refreshing?: boolean): DashboardFreshness {
  if (refreshing) return "refreshing";
  switch (state) {
    case "synced":
      return "fresh";
    case "syncing":
      return "refreshing";
    case "pending":
    case "retry_scheduled":
      return "stale";
    case "local_only":
      return "local_only";
    case "offline":
      return "stale";
    case "stale":
      return "stale";
    case "conflict":
    case "action_required":
    case "failed":
      return "partial";
    default:
      return "fresh";
  }
}

function unavailableMetric(
  id: string,
  label: string,
  permission: string,
  reason: string,
  asOf: string,
  favourability: DashboardMetric["favourability"] = "neutral",
): DashboardMetric {
  return {
    id,
    label,
    value: null,
    formattedValue: "—",
    freshness: "unavailable",
    asOf,
    sourceLabel: "Unavailable",
    permission,
    unavailableReason: reason,
    favourability,
  };
}

async function buildCashAndBank(
  accounts: HomeAdapterInput["accounts"],
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): Promise<DashboardMetric> {
  try {
    const balances = await readAllAccountBalances();
    const map = new Map(balances.map((b) => [b.accountId, Number(b.balance ?? 0)]));
    let total = 0;
    for (const acc of accounts) {
      if (acc.isGroup) continue;
      if (!isCashOrBankAccount(acc)) continue;
      total += map.get(acc.id) ?? 0;
    }
    return {
      id: "cash_and_bank",
      label: "Cash and Bank",
      value: total,
      formattedValue: formatHomeAmount(total, currency),
      currency,
      freshness,
      asOf,
      sourceLabel: "Account balances (projection)",
      drillDownRoute: "day-book",
      permission: "balanceSheet|dayBook",
      favourability: "neutral",
    };
  } catch (err) {
    return unavailableMetric(
      "cash_and_bank",
      "Cash and Bank",
      "balanceSheet|dayBook",
      err instanceof Error ? err.message : "Balance source unavailable",
      asOf,
    );
  }
}

function buildReceivables(
  parties: unknown[],
  invoices: HomeAdapterInput["invoices"],
  vouchers: HomeAdapterInput["vouchers"],
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): DashboardMetric {
  try {
    const result = computeOutstandingReceivables(parties, invoices, vouchers);
    return {
      id: "receivables",
      label: "Receivables",
      value: result.totalAmount,
      formattedValue: formatHomeAmount(result.totalAmount, currency),
      currency,
      freshness,
      asOf,
      sourceLabel: "computeOutstandingReceivables",
      drillDownRoute: "outstanding-receivables",
      permission: "salesVoucher|dayBook",
      favourability: "neutral",
    };
  } catch (err) {
    return unavailableMetric(
      "receivables",
      "Receivables",
      "salesVoucher|dayBook",
      err instanceof Error ? err.message : "Receivables unavailable",
      asOf,
    );
  }
}

function buildPayables(
  parties: unknown[],
  invoices: HomeAdapterInput["invoices"],
  vouchers: HomeAdapterInput["vouchers"],
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): DashboardMetric {
  try {
    const result = computeOutstandingPayables(parties, invoices, vouchers);
    return {
      id: "payables",
      label: "Payables",
      value: result.totalAmount,
      formattedValue: formatHomeAmount(result.totalAmount, currency),
      currency,
      freshness,
      asOf,
      sourceLabel: "computeOutstandingPayables",
      drillDownRoute: "outstanding-payables",
      permission: "purchaseVoucher|dayBook",
      favourability: "neutral",
    };
  } catch (err) {
    return unavailableMetric(
      "payables",
      "Payables",
      "purchaseVoucher|dayBook",
      err instanceof Error ? err.message : "Payables unavailable",
      asOf,
    );
  }
}

async function buildPlMetrics(
  fyStart: string | undefined,
  fyEnd: string | undefined,
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): Promise<{ sales: DashboardMetric; net: DashboardMetric }> {
  try {
    const pl = await buildProfitLossFromProjection(fyStart, fyEnd);
    return {
      sales: {
        id: "sales_period",
        label: "Sales (period)",
        value: pl.totalIncome,
        formattedValue: formatHomeAmount(pl.totalIncome, currency),
        currency,
        freshness,
        asOf,
        sourceLabel: "buildProfitLossFromProjection",
        drillDownRoute: "profit-loss",
        permission: "profitLoss",
        favourability: "higher_is_favourable",
        periodLabel: fyStart && fyEnd ? `${fyStart} → ${fyEnd}` : "Current fiscal year",
      },
      net: {
        id: "net_result",
        label: "Net result",
        value: pl.netProfit,
        formattedValue: formatHomeAmount(pl.netProfit, currency),
        currency,
        freshness,
        asOf,
        sourceLabel: "buildProfitLossFromProjection",
        drillDownRoute: "profit-loss",
        permission: "profitLoss",
        favourability: "higher_is_favourable",
        periodLabel: fyStart && fyEnd ? `${fyStart} → ${fyEnd}` : "Current fiscal year",
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "P&L unavailable";
    return {
      sales: unavailableMetric("sales_period", "Sales (period)", "profitLoss", reason, asOf, "higher_is_favourable"),
      net: unavailableMetric("net_result", "Net result", "profitLoss", reason, asOf, "higher_is_favourable"),
    };
  }
}

async function buildInventory(
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): Promise<DashboardMetric> {
  try {
    const inv = await buildInventoryValuationReport();
    return {
      id: "inventory_value",
      label: "Inventory value",
      value: inv.totalValue,
      formattedValue: formatHomeAmount(inv.totalValue, currency),
      currency,
      freshness,
      asOf,
      sourceLabel: "buildInventoryValuationReport",
      drillDownRoute: "stock-summary",
      permission: "itemMaster",
      favourability: "neutral",
    };
  } catch (err) {
    return unavailableMetric(
      "inventory_value",
      "Inventory value",
      "itemMaster",
      err instanceof Error ? err.message : "Inventory valuation unavailable",
      asOf,
    );
  }
}

async function buildTbHealth(
  asOf: string,
  freshness: DashboardFreshness,
): Promise<DashboardMetric> {
  try {
    const tb = await readTrialBalanceFromProjection();
    const diff = Math.abs(Number(tb.totalDebit) - Number(tb.totalCredit));
    const balanced = diff < 0.02;
    return {
      id: "trial_balance_health",
      label: "Trial balance",
      value: balanced ? 0 : diff,
      formattedValue: balanced ? "Balanced" : `Diff ${formatHomeAmount(diff)}`,
      freshness,
      asOf,
      sourceLabel: "readTrialBalanceFromProjection",
      drillDownRoute: "trial-balance",
      permission: "trialBalance",
      favourability: "balanced_is_favourable",
    };
  } catch (err) {
    return unavailableMetric(
      "trial_balance_health",
      "Trial balance",
      "trialBalance",
      err instanceof Error ? err.message : "Trial balance unavailable",
      asOf,
      "balanced_is_favourable",
    );
  }
}

function buildTodaysSales(
  invoices: HomeAdapterInput["invoices"],
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): DashboardMetric {
  const today = todayISO();
  let total = 0;
  for (const inv of invoices) {
    if (inv.type !== "sales-invoice" || inv.status !== "posted") continue;
    if (String(inv.date || "").slice(0, 10) !== today) continue;
    total += Number(inv.grandTotal ?? inv.total ?? 0);
  }
  return {
    id: "todays_sales",
    label: "Today's sales",
    value: total,
    formattedValue: formatHomeAmount(total, currency),
    currency,
    freshness,
    asOf,
    sourceLabel: "Posted sales invoices (store)",
    drillDownRoute: "billing",
    permission: "salesVoucher",
    favourability: "higher_is_favourable",
    periodLabel: today,
  };
}

function metricAllowed(
  id: string,
  profile: UserPermission,
  isAdmin: boolean,
  workspace: HomeWorkspaceId,
): boolean {
  // Cashiers must not see net result / inventory cost / period P&L without privilege
  if (
    workspace === "cashier" &&
    (id === "net_result" || id === "inventory_value" || id === "sales_period")
  ) {
    return false;
  }
  switch (id) {
    case "cash_and_bank":
      return (
        canViewScreen(profile, "balanceSheet", isAdmin) ||
        canViewScreen(profile, "dayBook", isAdmin)
      );
    case "receivables":
      return (
        canViewScreen(profile, "salesVoucher", isAdmin) ||
        canViewScreen(profile, "dayBook", isAdmin)
      );
    case "payables":
      return (
        canViewScreen(profile, "purchaseVoucher", isAdmin) ||
        canViewScreen(profile, "dayBook", isAdmin)
      );
    case "sales_period":
    case "net_result":
      return canViewScreen(profile, "profitLoss", isAdmin);
    case "inventory_value":
      return canViewScreen(profile, "itemMaster", isAdmin);
    case "trial_balance_health":
      return canViewScreen(profile, "trialBalance", isAdmin);
    case "todays_sales":
      return canViewScreen(profile, "salesVoucher", isAdmin);
    case "parties_count":
      return canViewScreen(profile, "partyMaster", isAdmin);
    case "items_count":
      return canViewScreen(profile, "itemMaster", isAdmin);
    default:
      return false;
  }
}

function buildAttention(input: HomeAdapterInput, sync: Awaited<ReturnType<typeof getAggregatedSyncStatus>>, freshness: DashboardFreshness, currency: string): AttentionItem[] {
  const companyId = input.companyId;
  const items: AttentionItem[] = [];
  let priority = 10;

  if (sync.conflictCount > 0 || sync.state === "conflict") {
    items.push({
      id: "sync_conflict",
      category: "sync_conflict",
      severity: "danger",
      priority: 1,
      title: "Synchronization conflict",
      description: `${sync.conflictCount || 1} item(s) need review before sync can complete.`,
      count: sync.conflictCount || 1,
      companyId,
      source: "getAggregatedSyncStatus",
      route: "dashboard",
      actionLabel: "Review sync status",
      freshness,
    });
  }
  if (sync.failedCount > 0 || sync.state === "failed") {
    items.push({
      id: "sync_failed",
      category: "failed_synchronization",
      severity: "danger",
      priority: 2,
      title: "Synchronization failed",
      description: sync.detail || "One or more sync operations failed.",
      count: sync.failedCount || undefined,
      companyId,
      source: "getAggregatedSyncStatus",
      actionLabel: "Open sync status",
      freshness: "partial",
    });
  }

  try {
    const aging = computeAgingReport(input.invoices, input.parties, todayISO(), "customer");
    const overdue = aging.filter((r: { daysOverdue?: number; outstanding?: number }) => (r.daysOverdue ?? 0) > 0);
    const overdueAmt = overdue.reduce(
      (s: number, r: { outstanding?: number }) => s + Number(r.outstanding || 0),
      0,
    );
    if (overdue.length > 0) {
      items.push({
        id: "overdue_receivables",
        category: "overdue_receivable",
        severity: overdueAmt > 0 ? "warning" : "info",
        priority: 4,
        title: "Overdue receivables",
        description: `${overdue.length} invoice(s) past due.`,
        count: overdue.length,
        amountFormatted: formatHomeAmount(overdueAmt, currency),
        companyId,
        source: "computeAgingReport",
        route: "outstanding-receivables",
        actionLabel: "Open receivables",
        permission: "salesVoucher",
        freshness,
      });
    }
  } catch {
    /* skip */
  }

  try {
    const agingP = computeAgingReport(input.invoices, input.parties, todayISO(), "supplier");
    const overdue = agingP.filter((r: { daysOverdue?: number }) => (r.daysOverdue ?? 0) > 0);
    if (overdue.length > 0) {
      const amt = overdue.reduce(
        (s: number, r: { outstanding?: number }) => s + Number(r.outstanding || 0),
        0,
      );
      items.push({
        id: "overdue_payables",
        category: "overdue_payable",
        severity: "warning",
        priority: 4,
        title: "Overdue payables",
        description: `${overdue.length} purchase invoice(s) past due.`,
        count: overdue.length,
        amountFormatted: formatHomeAmount(amt, currency),
        companyId,
        source: "computeAgingReport",
        route: "outstanding-payables",
        actionLabel: "Open payables",
        permission: "purchaseVoucher",
        freshness,
      });
    }
  } catch {
    /* skip */
  }

  const lowStock = input.items.filter((it) => {
    const qty = Number(it.currentStock ?? it.quantity ?? 0);
    const reorder = Number(it.reorderLevel ?? 0);
    return reorder > 0 && qty <= reorder;
  });
  if (lowStock.length > 0) {
    items.push({
      id: "low_stock",
      category: "low_stock",
      severity: "warning",
      priority: 5,
      title: "Low stock",
      description: `${lowStock.length} item(s) at or below reorder level.`,
      count: lowStock.length,
      companyId,
      source: "items.reorderLevel",
      route: "stock-summary",
      actionLabel: "Review stock",
      permission: "itemMaster",
      freshness,
    });
  }

  const pendingApproval = input.vouchers.filter(
    (v) => v.status === "submitted" || v.status === "pending_approval",
  );
  if (pendingApproval.length > 0) {
    items.push({
      id: "pending_approval",
      category: "pending_approval",
      severity: "info",
      priority: 3,
      title: "Pending approvals",
      description: `${pendingApproval.length} voucher(s) awaiting approval.`,
      count: pendingApproval.length,
      companyId,
      source: "vouchers.status",
      route: "day-book",
      actionLabel: "Open day book",
      freshness,
    });
  }

  if (input.parties.length === 0) {
    items.push({
      id: "setup_parties",
      category: "incomplete_setup",
      severity: "info",
      priority: 6,
      title: "No parties yet",
      description: "Add customers and suppliers to start billing.",
      companyId,
      source: "parties",
      route: "parties",
      actionLabel: "Add party",
      permission: "partyMaster",
      freshness,
    });
  }
  if (input.items.length === 0) {
    items.push({
      id: "setup_items",
      category: "incomplete_setup",
      severity: "info",
      priority: 6,
      title: "No inventory items",
      description: "Create items before stock reports are useful.",
      companyId,
      source: "items",
      route: "items",
      actionLabel: "Add item",
      permission: "itemMaster",
      freshness,
    });
  }

  return items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

async function buildAgeingChart(
  asOf: string,
  currency: string,
  freshness: DashboardFreshness,
): Promise<DashboardChartModel | null> {
  try {
    const rows = await buildAgingReportFromProjection(asOf, "customer");
    const bucketOrder = ["Not Due", "1-30", "31-60", "61-90", "90+"];
    const map = new Map<string, { amount: number; count: number }>();
    for (const key of bucketOrder) map.set(key, { amount: 0, count: 0 });
    for (const row of rows as Array<{ bucket?: string; outstanding?: number }>) {
      const b = String(row.bucket || "Not Due");
      const cur = map.get(b) || { amount: 0, count: 0 };
      cur.amount += Number(row.outstanding || 0);
      cur.count += 1;
      map.set(b, cur);
    }
    const buckets = bucketOrder.map((key) => {
      const v = map.get(key)!;
      return {
        key,
        label: key,
        amount: v.amount,
        formattedAmount: formatHomeAmount(v.amount, currency),
        count: v.count,
      };
    });
    const total = buckets.reduce((s, b) => s + b.amount, 0);
    const overdue = buckets.filter((b) => b.key !== "Not Due").reduce((s, b) => s + b.amount, 0);
    return {
      id: "receivable_ageing_buckets",
      title: "Receivable ageing",
      purpose: "Identify overdue concentration",
      unit: currency,
      periodLabel: `As of ${asOf}`,
      freshness,
      buckets,
      accessibleSummary: `Receivable ageing total ${formatHomeAmount(total, currency)}; overdue ${formatHomeAmount(overdue, currency)}.`,
      drillDownRoute: "aging-report",
    };
  } catch (err) {
    return {
      id: "receivable_ageing_buckets",
      title: "Receivable ageing",
      purpose: "Identify overdue concentration",
      unit: currency,
      periodLabel: `As of ${asOf}`,
      freshness: "unavailable",
      buckets: [],
      accessibleSummary: "Receivable ageing unavailable.",
      drillDownRoute: "aging-report",
      unavailableReason: err instanceof Error ? err.message : "Unavailable",
    };
  }
}

function buildActivity(input: HomeAdapterInput): ActivityItem[] {
  const out: ActivityItem[] = [];
  const vouchers = [...input.vouchers].slice(-8).reverse();
  for (const v of vouchers) {
    out.push({
      id: `v-${v.id}`,
      kind: "voucher",
      title: v.voucherNumber || v.voucherType || "Voucher",
      subtitle: v.voucherType,
      when: v.date,
      route: "day-book",
      status: v.status,
    });
  }
  const invoices = [...input.invoices].slice(-8).reverse();
  for (const inv of invoices) {
    out.push({
      id: `i-${inv.id}`,
      kind: "invoice",
      title: inv.invoiceNumber || "Invoice",
      subtitle: inv.type,
      when: inv.date,
      route: inv.type?.includes("purchase") ? "purchase" : "billing",
      status: inv.status,
    });
  }
  return out.slice(0, 12);
}

export async function buildHomeViewModel(input: HomeAdapterInput): Promise<HomeViewModel> {
  const loadedAt = new Date().toISOString();
  const asOf = todayISO();
  const currency = resolveCurrencySymbol(input.companySettings);
  const companyName =
    input.companySettings?.companyNameEn ||
    input.companySettings?.companyName ||
    input.companySettings?.name ||
    "Company";
  const fy = input.currentFiscalYear;
  const role = input.currentUser?.role;
  const isAdmin = ["admin", "owner", "super_admin"].includes(String(role || "").toLowerCase());
  const profile = resolvePermissionProfile(input.currentUser?.id, role, input.permissions);
  const workspace = resolveWorkspaces(role);
  const online = input.online !== false;

  let sync = await getAggregatedSyncStatus(online).catch(() => ({
    state: "local_only" as UiSyncState,
    pendingCount: 0,
    syncingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    deadLetterCount: 0,
    deviceId: "",
    deviceIdShort: "",
    registrationStatus: null,
    lastSuccessfulSync: null,
    detail: "Sync status unavailable",
  }));

  const freshness = mapSyncToFreshness(sync.state, input.refreshing);
  const partialErrors: string[] = [];

  const metricBuilders: Record<string, () => Promise<DashboardMetric> | DashboardMetric> = {
    cash_and_bank: () => buildCashAndBank(input.accounts, asOf, currency, freshness),
    receivables: () =>
      buildReceivables(input.parties, input.invoices, input.vouchers, asOf, currency, freshness),
    payables: () =>
      buildPayables(input.parties, input.invoices, input.vouchers, asOf, currency, freshness),
    todays_sales: () => buildTodaysSales(input.invoices, asOf, currency, freshness),
    parties_count: () => ({
      id: "parties_count",
      label: "Parties",
      value: input.parties.length,
      formattedValue: formatHomeCount(input.parties.length),
      freshness,
      asOf,
      sourceLabel: "parties store",
      drillDownRoute: "parties",
      permission: "partyMaster",
      favourability: "neutral",
    }),
    items_count: () => ({
      id: "items_count",
      label: "Items",
      value: input.items.length,
      formattedValue: formatHomeCount(input.items.length),
      freshness,
      asOf,
      sourceLabel: "items store",
      drillDownRoute: "items",
      permission: "itemMaster",
      favourability: "neutral",
    }),
    inventory_value: () => buildInventory(asOf, currency, freshness),
    trial_balance_health: () => buildTbHealth(asOf, freshness),
    sales_period: async () => {
      const pl = await buildPlMetrics(fy?.startDate, fy?.endDate, asOf, currency, freshness);
      return pl.sales;
    },
    net_result: async () => {
      const pl = await buildPlMetrics(fy?.startDate, fy?.endDate, asOf, currency, freshness);
      return pl.net;
    },
  };

  const wantedIds = WORKSPACE_METRICS[workspace.primary] ?? WORKSPACE_METRICS.restricted;
  const metrics: DashboardMetric[] = [];
  // Avoid double P&L fetch
  let plCache: Awaited<ReturnType<typeof buildPlMetrics>> | null = null;
  for (const id of wantedIds) {
    if (!metricAllowed(id, profile, isAdmin, workspace.primary)) continue;
    try {
      if (id === "sales_period" || id === "net_result") {
        if (!plCache) {
          plCache = await buildPlMetrics(fy?.startDate, fy?.endDate, asOf, currency, freshness);
        }
        metrics.push(id === "sales_period" ? plCache.sales : plCache.net);
      } else {
        const built = await metricBuilders[id]?.();
        if (built) metrics.push(built);
      }
    } catch (err) {
      partialErrors.push(`${id}: ${err instanceof Error ? err.message : "failed"}`);
    }
    if (metrics.length >= 4) break;
  }

  let attention = buildAttention(input, sync, freshness, currency);
  // Filter attention by permission when declared
  attention = attention.filter((a) => {
    if (!a.permission) return true;
    if (a.permission === "salesVoucher") return canViewScreen(profile, "salesVoucher", isAdmin);
    if (a.permission === "purchaseVoucher") return canViewScreen(profile, "purchaseVoucher", isAdmin);
    if (a.permission === "itemMaster") return canViewScreen(profile, "itemMaster", isAdmin);
    if (a.permission === "partyMaster") return canViewScreen(profile, "partyMaster", isAdmin);
    return true;
  });
  // Home Today: first viewport attention cap (full list still built above; UI may show more in More)
  attention = attention.slice(0, 5);

  // Auditor: no mutation quick actions. Ask Orbix lives on PageHeader — omit from Do next.
  const actions = selectQuickActions(workspace.all, profile, isAdmin, { limit: 5 }).filter((a) => {
    if (a.orbix) return false;
    if (workspace.primary === "auditor" && a.requireCreate) return false;
    return true;
  }).slice(0, 4);

  const charts: DashboardChartModel[] = [];
  if (
    (workspace.primary === "owner" ||
      workspace.primary === "accountant" ||
      workspace.primary === "auditor" ||
      workspace.primary === "combined") &&
    canViewScreen(profile, "salesVoucher", isAdmin)
  ) {
    const chart = await buildAgeingChart(asOf, currency, freshness);
    if (chart) charts.push(chart);
  }

  const activity = buildActivity(input);
  const isNewCompany =
    input.parties.length === 0 &&
    input.items.length === 0 &&
    input.invoices.length === 0 &&
    input.vouchers.length === 0;

  const trust: DataTrustContext = {
    companyId: input.companyId,
    companyName,
    fiscalYearName: fy?.name ?? "—",
    fiscalStart: fy?.startDate,
    fiscalEnd: fy?.endDate,
    currency,
    asOf,
    loadedAt,
    freshness: partialErrors.length ? "partial" : freshness,
    syncState: sync.state,
    syncDetail: sync.detail,
    pendingCount: sync.pendingCount,
    conflictCount: sync.conflictCount,
    offline: !online || sync.state === "offline",
    basisLabel: "Projection + accounting helpers (read-only)",
  };

  const orbixPrompts = [
    { id: "overdue", label: "Explain overdue receivables", prompt: "Explain overdue receivables" },
    { id: "bank", label: "Summarise unmatched bank items", prompt: "Summarise unmatched bank items" },
    { id: "changed", label: "What changed this fiscal month?", prompt: "Show what changed this fiscal month" },
  ];

  return {
    workspaceId: workspace.primary,
    workspaceLabel: workspace.label,
    trust,
    metrics,
    attention,
    quickActions: actions,
    activity,
    charts,
    orbixPrompts,
    sectionOrder: WORKSPACE_SECTION_ORDER[workspace.primary] ?? WORKSPACE_SECTION_ORDER.restricted,
    partialErrors,
    isNewCompany,
    isEmptyActivity: activity.length === 0,
  };
}
