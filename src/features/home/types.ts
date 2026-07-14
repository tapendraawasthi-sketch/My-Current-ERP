/**
 * Phase UI-5 — typed Home / dashboard view-model contracts.
 * Presentation components must not invent freshness, favourability, or totals.
 */

export type DashboardFreshness =
  | "fresh"
  | "refreshing"
  | "stale"
  | "local_only"
  | "partial"
  | "unavailable";

export type FavourabilityHint =
  | "neutral"
  | "higher_is_favourable"
  | "lower_is_unfavourable"
  | "balanced_is_favourable";

export type HomeWorkspaceId =
  | "owner"
  | "accountant"
  | "cashier"
  | "banking"
  | "inventory"
  | "auditor"
  | "administrator"
  | "restricted"
  | "combined";

export interface DashboardMetric {
  id: string;
  label: string;
  value: number | string | null;
  formattedValue: string;
  currency?: string;
  unitLabel?: string;
  comparison?: {
    value: string | number;
    direction: "up" | "down" | "flat";
    favourable?: boolean;
    periodLabel: string;
  };
  freshness: DashboardFreshness;
  asOf: string;
  sourceLabel: string;
  drillDownRoute?: string;
  permission: string;
  unavailableReason?: string;
  favourability: FavourabilityHint;
  periodLabel?: string;
}

export interface AttentionItem {
  id: string;
  category: string;
  severity: "info" | "warning" | "danger";
  priority: number;
  title: string;
  description?: string;
  count?: number;
  amountFormatted?: string;
  companyId: string;
  source: string;
  createdAt?: string;
  dueAt?: string;
  route?: string;
  actionLabel?: string;
  permission?: string;
  freshness: DashboardFreshness;
}

export interface QuickActionDef {
  id: string;
  label: string;
  description?: string;
  page: string;
  icon: string;
  permissionScreen?: string;
  requireCreate?: boolean;
  rolesPriority: HomeWorkspaceId[];
  mobileEligible: boolean;
  orbix?: boolean;
  unavailableReason?: string;
}

export interface ActivityItem {
  id: string;
  kind: "voucher" | "invoice" | "navigation" | "report";
  title: string;
  subtitle?: string;
  when?: string;
  route: string;
  amountFormatted?: string;
  status?: string;
}

export interface AgeingBucket {
  key: string;
  label: string;
  amount: number;
  formattedAmount: string;
  count: number;
}

export interface DashboardChartModel {
  id: string;
  title: string;
  purpose: string;
  unit: string;
  periodLabel: string;
  freshness: DashboardFreshness;
  buckets: AgeingBucket[];
  accessibleSummary: string;
  drillDownRoute: string;
  unavailableReason?: string;
}

export interface DataTrustContext {
  companyId: string;
  companyName: string;
  fiscalYearName: string;
  fiscalStart?: string;
  fiscalEnd?: string;
  currency: string;
  asOf: string;
  loadedAt: string;
  freshness: DashboardFreshness;
  syncState: string;
  syncDetail: string;
  pendingCount: number;
  conflictCount: number;
  offline: boolean;
  basisLabel: string;
}

export interface HomeViewModel {
  workspaceId: HomeWorkspaceId;
  workspaceLabel: string;
  trust: DataTrustContext;
  metrics: DashboardMetric[];
  attention: AttentionItem[];
  quickActions: QuickActionDef[];
  activity: ActivityItem[];
  charts: DashboardChartModel[];
  orbixPrompts: Array<{ id: string; label: string; prompt: string }>;
  sectionOrder: string[];
  loadError?: string;
  partialErrors: string[];
  isNewCompany: boolean;
  isEmptyActivity: boolean;
}
