export type OrbixReportKind = "trial_balance" | "balance_sheet" | "profit_loss" | "party_ledger";

export type OrbixReportDetailLevel =
  | "summary"
  | "group"
  | "subgroup"
  | "ledger"
  | "voucher";

/** Structured report specification shared with backend ReportSpecification. */
export interface OrbixReportSpec {
  report_type: OrbixReportKind | string;
  period?: {
    type?: "financial_year" | "date_range" | "as_of_date";
    start_date?: string | null;
    end_date?: string | null;
    financial_year?: string | null;
  };
  comparison?: {
    enabled?: boolean;
    comparison_type?: string | null;
    periods?: string[];
  };
  detail_level?: OrbixReportDetailLevel;
  include_groups?: boolean;
  include_subgroups?: boolean;
  include_ledgers?: boolean;
  include_vouchers?: boolean;
  include_zero_balances?: boolean;
  filters?: Record<string, string>;
  expanded_groups?: string[];
}

export interface OrbixReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
}

export interface OrbixReportPayload {
  kind: OrbixReportKind;
  title: string;
  subtitle: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
  partyName?: string;
  columns: OrbixReportColumn[];
  rows: Record<string, string | number>[];
  summary: { label: string; value: string; accent?: boolean }[];
  footerNote?: string;
  balanced?: boolean;
  spec?: OrbixReportSpec;
}

export interface PendingOrbixReport {
  kind: OrbixReportKind;
  partyName?: string;
  fromDate?: string;
  toDate?: string;
  spec?: OrbixReportSpec;
}

export interface OrbixReportResult {
  type: "report";
  text: string;
  report: OrbixReportPayload;
}

export interface OrbixReportClarifyResult {
  type: "clarify";
  text: string;
  pending: PendingOrbixReport;
}

export type OrbixReportHandleResult = OrbixReportResult | OrbixReportClarifyResult | null;
