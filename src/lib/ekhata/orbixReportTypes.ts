export type OrbixReportKind = "trial_balance" | "balance_sheet" | "profit_loss" | "party_ledger";

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
}

export interface PendingOrbixReport {
  kind: OrbixReportKind;
  partyName?: string;
  fromDate?: string;
  toDate?: string;
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
