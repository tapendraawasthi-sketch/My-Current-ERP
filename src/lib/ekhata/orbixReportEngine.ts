/**
 * Orbix — intelligent report queries (TB, BS, P&L, party ledger) with date-range handling.
 */

import { getDB } from "../db";
import {
  computeBalanceSheet,
  computePartyStatement,
  computeProfitLoss,
  computeTrialBalance,
} from "../accounting";
import type {
  OrbixReportClarifyResult,
  OrbixReportHandleResult,
  OrbixReportPayload,
  OrbixReportSpec,
  PendingOrbixReport,
} from "./orbixReportTypes";

const ISO_DATE = /\b(20\d{2}-\d{2}-\d{2})\b/g;

const REPORT_FOLLOW_UP = /^\s*(compare|include|exclude|expand|collapse|hide\s+zero|show\s+zero|with\s+subgroups?|with\s+ledgers?|previous\s+year|last\s+year|only\s+major|groups?\s+and\s+subgroups?|drill)/i;

function kindToReportType(kind: PendingOrbixReport["kind"]): string {
  if (kind === "profit_loss") return "profit_and_loss";
  if (kind === "party_ledger") return "account_ledger";
  return kind;
}

function buildReportSpec(
  kind: PendingOrbixReport["kind"],
  text: string,
  base?: OrbixReportSpec,
): OrbixReportSpec {
  const spec: OrbixReportSpec = {
    report_type: base?.report_type || kindToReportType(kind),
    period: base?.period || { type: "financial_year", financial_year: "current" },
    comparison: base?.comparison || { enabled: false },
    detail_level: base?.detail_level || "group",
    include_groups: base?.include_groups ?? true,
    include_subgroups: base?.include_subgroups ?? false,
    include_ledgers: base?.include_ledgers ?? false,
    include_vouchers: base?.include_vouchers ?? false,
    include_zero_balances: base?.include_zero_balances ?? false,
    filters: { ...(base?.filters || {}) },
    expanded_groups: [...(base?.expanded_groups || [])],
  };

  const lower = text.toLowerCase();
  if (/previous\s+year|last\s+year|compare/.test(lower)) {
    spec.comparison = {
      enabled: true,
      comparison_type: "previous_financial_year",
      periods: ["current", "previous"],
    };
  }
  if (/groups?\s+and\s+subgroups?/.test(lower)) {
    spec.include_groups = true;
    spec.include_subgroups = true;
    spec.detail_level = "subgroup";
  } else if (/subgroups?/.test(lower) && !/not\s+.*subgroup|without\s+subgroup/.test(lower)) {
    spec.include_subgroups = true;
    spec.detail_level = "subgroup";
  }
  if (/not\s+.*ledgers?|without\s+ledgers?|but\s+not\s+ledgers?/.test(lower)) {
    spec.include_ledgers = false;
  } else if (/\bledgers?\b|individual\s+ledgers?/.test(lower)) {
    spec.include_ledgers = true;
    spec.detail_level = "ledger";
  }
  if (/hide\s+zero|exclude\s+zero/.test(lower)) spec.include_zero_balances = false;
  if (/include\s+zero|show\s+zero/.test(lower)) spec.include_zero_balances = true;
  if (/only\s+major|summary/.test(lower)) {
    spec.detail_level = "summary";
    spec.include_subgroups = false;
    spec.include_ledgers = false;
  }
  const expand = lower.match(/expand\s+([a-z][a-z\s]{2,40}?)(?:\.|$|,|and\b)/);
  if (expand) {
    const group = expand[1].trim();
    if (!spec.expanded_groups!.includes(group)) spec.expanded_groups!.push(group);
    spec.filters!.expanded_group = group;
  }
  const branch = lower.match(/under\s+([a-z][a-z\s]{2,40}?)(?:\s+and|\s+with|\.|$)/);
  if (branch) spec.filters!.branch = branch[1].trim();

  return spec;
}

const REPORT_PATTERNS: { kind: PendingOrbixReport["kind"]; patterns: RegExp[] }[] = [
  {
    kind: "trial_balance",
    patterns: [
      /\btrial\s*balance\b/i,
      /\bparikshan\s*santulan\b/i,
      /\bhisaab\s*milo\b/i,
      /\btb\s+report\b/i,
      /ट्रायल\s*ब्यालेन्स|परीक्षण\s*सन्तुलन/,
    ],
  },
  {
    kind: "balance_sheet",
    patterns: [
      /\bbalance\s*sheet\b/i,
      /\bstatement\s+of\s+financial\s+position\b/i,
      /\bsampatti\s*(ra\s*)?dayitwo\b/i,
      /\bvasalat\b/i,
      /ब्यालेन्स\s*शीट|वासलात/,
    ],
  },
  {
    kind: "profit_loss",
    patterns: [
      /\bprofit\s*(and|&)\s*loss\b/i,
      /\bp\s*&\s*l\b/i,
      /\bpnl\b/i,
      /\bincome\s*statement\b/i,
      /\blabh\s*(ra\s*)?nakksan\b/i,
      /\baamdani\s*(ra\s*)?kharcha\b/i,
      /नाफा\s*नोक्सान|आम्दानी\s*खर्च/,
    ],
  },
  {
    kind: "party_ledger",
    patterns: [
      /\bparty\s+ledger\b/i,
      /\bledger\s+(of|for)\b/i,
      /\bparty\s+statement\b/i,
      /\bko\s+(ledger|khata|statement)\b/i,
      /\b(ledger|khata)\s+dekha/u,
      /पार्टी\s*खाता|खाताबही/,
    ],
  },
];

function fmt(n: number): string {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function extractIsoDates(text: string): string[] {
  return [...text.matchAll(ISO_DATE)].map((m) => m[1]);
}

function detectReportKind(text: string): PendingOrbixReport["kind"] | null {
  for (const { kind, patterns } of REPORT_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return kind;
  }
  return null;
}

function extractPartyName(text: string, parties: { id: string; name: string }[]): string | undefined {
  const lower = text.toLowerCase();
  for (const p of parties) {
    const n = p.name.toLowerCase();
    if (n.length >= 2 && lower.includes(n)) return p.name;
  }
  const patterns = [
    /(?:ledger|khata|statement)\s+(?:of|for)\s+([a-zA-Z\u0900-\u097F][\w\s.-]{1,40})/i,
    /([a-zA-Z\u0900-\u097F][\w\s.-]{1,40})\s+ko\s+(?:ledger|khata|statement)/i,
    /(?:show|dekha|dinu|display)\s+([a-zA-Z\u0900-\u097F][\w\s.-]{1,40})\s+(?:ko|ka)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim();
      const hit = parties.find(
        (p) =>
          p.name.toLowerCase().includes(candidate.toLowerCase()) ||
          candidate.toLowerCase().includes(p.name.toLowerCase()),
      );
      if (hit) return hit.name;
      if (candidate.length >= 2) return candidate;
    }
  }
  return undefined;
}

function resolveDateRange(
  text: string,
  fyStart?: string,
  fyEnd?: string,
  pending?: PendingOrbixReport,
): { fromDate?: string; toDate?: string; needsClarify: boolean } {
  const dates = extractIsoDates(text);
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = fyStart || today.slice(0, 8) + "01";
  const defaultTo = fyEnd || today;

  if (dates.length >= 2) {
    const sorted = [...dates].sort();
    return { fromDate: sorted[0], toDate: sorted[sorted.length - 1], needsClarify: false };
  }
  if (dates.length === 1) {
    if (pending?.kind === "balance_sheet") {
      return { fromDate: defaultFrom, toDate: dates[0], needsClarify: false };
    }
    return { fromDate: dates[0], toDate: defaultTo, needsClarify: false };
  }

  if (/\b(aaja|today)\b/i.test(text)) {
    return { fromDate: today, toDate: today, needsClarify: false };
  }
  if (/\b(yo\s+)?mahina|this\s+month\b/i.test(text)) {
    const d = new Date();
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { fromDate: from, toDate: today, needsClarify: false };
  }
  if (/\b(fy|fiscal|barsa|a\.?v\.?)\b/i.test(text) && fyStart && fyEnd) {
    return { fromDate: fyStart, toDate: fyEnd, needsClarify: false };
  }

  if (pending?.fromDate && pending?.toDate) {
    return { fromDate: pending.fromDate, toDate: pending.toDate, needsClarify: false };
  }

  return { fromDate: pending?.fromDate, toDate: pending?.toDate, needsClarify: true };
}

async function buildTrialBalanceReport(
  fromDate: string,
  toDate: string,
  _fyStart?: string,
  companyName?: string,
): Promise<OrbixReportPayload> {
  const db = getDB();
  const [accounts, vouchers] = await Promise.all([
    db.accounts.toArray(),
    db.table("vouchers").toArray(),
  ]);
  const filtered = vouchers.filter(
    (v) => v.status === "posted" && v.date >= fromDate && v.date <= toDate,
  );
  const tb = computeTrialBalance(accounts, filtered);
  const balanced = Math.abs(tb.totalDebit - tb.totalCredit) < 0.02;

  return {
    kind: "trial_balance",
    title: "Trial Balance",
    subtitle: companyName ? `${companyName} · ${fromDate} to ${toDate}` : `${fromDate} to ${toDate}`,
    fromDate,
    toDate,
    columns: [
      { key: "accountCode", label: "Code", align: "left" },
      { key: "accountName", label: "Account", align: "left" },
      { key: "debit", label: "Debit (Dr)", align: "right", mono: true },
      { key: "credit", label: "Credit (Cr)", align: "right", mono: true },
    ],
    rows: tb.rows.map((r) => ({
      accountCode: r.accountCode || "—",
      accountName: r.accountName,
      debit: r.debit > 0 ? fmt(r.debit) : "—",
      credit: r.credit > 0 ? fmt(r.credit) : "—",
    })),
    summary: [
      { label: "Total Debit", value: fmt(tb.totalDebit), accent: true },
      { label: "Total Credit", value: fmt(tb.totalCredit), accent: true },
      { label: "Status", value: balanced ? "Balanced ✓" : "Unbalanced ✗", accent: true },
    ],
    balanced,
    footerNote: `${tb.rows.length} accounts · Period transactions ${fromDate} to ${toDate}`,
  };
}

async function buildBalanceSheetReport(
  asOfDate: string,
  companyName?: string,
): Promise<OrbixReportPayload> {
  const db = getDB();
  const [accounts, vouchers] = await Promise.all([
    db.accounts.toArray(),
    db.table("vouchers").toArray(),
  ]);
  const bs = computeBalanceSheet(accounts, vouchers, asOfDate);
  const rows: Record<string, string | number>[] = [];

  for (const a of bs.assets) {
    rows.push({ section: "Assets", accountName: a.name, amount: fmt(a.amount) });
  }
  for (const l of bs.liabilities) {
    rows.push({ section: "Liabilities", accountName: l.name, amount: fmt(l.amount) });
  }
  for (const e of bs.equity) {
    rows.push({ section: "Equity", accountName: e.name, amount: fmt(e.amount) });
  }

  const diff = Math.abs(bs.totalAssets - bs.totalLiabEquity);
  const balanced = diff < 0.02;

  return {
    kind: "balance_sheet",
    title: "Balance Sheet",
    subtitle: companyName ? `${companyName} · As at ${asOfDate}` : `As at ${asOfDate}`,
    asOfDate,
    toDate: asOfDate,
    columns: [
      { key: "section", label: "Section", align: "left" },
      { key: "accountName", label: "Account", align: "left" },
      { key: "amount", label: "Amount (NPR)", align: "right", mono: true },
    ],
    rows,
    summary: [
      { label: "Total Assets", value: fmt(bs.totalAssets), accent: true },
      { label: "Total Liabilities + Equity", value: fmt(bs.totalLiabEquity), accent: true },
      { label: "Status", value: balanced ? "Balanced ✓" : `Difference ${fmt(diff)}`, accent: true },
    ],
    balanced,
    footerNote: "Assets = Liabilities + Equity (incl. current period P&L)",
  };
}

async function buildProfitLossReport(
  fromDate: string,
  toDate: string,
  companyName?: string,
): Promise<OrbixReportPayload> {
  const db = getDB();
  const [accounts, vouchers] = await Promise.all([
    db.accounts.toArray(),
    db.table("vouchers").toArray(),
  ]);
  const pl = computeProfitLoss(accounts, vouchers, fromDate, toDate);
  const rows: Record<string, string | number>[] = [
    ...pl.incomeRows.map((r) => ({ type: "Income", accountName: r.name, amount: fmt(r.amount) })),
    ...pl.expenseRows.map((r) => ({ type: "Expense", accountName: r.name, amount: fmt(r.amount) })),
  ];

  return {
    kind: "profit_loss",
    title: "Profit & Loss Account",
    subtitle: companyName ? `${companyName} · ${fromDate} to ${toDate}` : `${fromDate} to ${toDate}`,
    fromDate,
    toDate,
    columns: [
      { key: "type", label: "Type", align: "left" },
      { key: "accountName", label: "Account", align: "left" },
      { key: "amount", label: "Amount (NPR)", align: "right", mono: true },
    ],
    rows,
    summary: [
      { label: "Total Income", value: fmt(pl.totalIncome), accent: true },
      { label: "Total Expense", value: fmt(pl.totalExpense), accent: true },
      {
        label: pl.netProfit >= 0 ? "Net Profit" : "Net Loss",
        value: fmt(Math.abs(pl.netProfit)),
        accent: true,
      },
    ],
    footerNote: `${pl.incomeRows.length} income · ${pl.expenseRows.length} expense accounts`,
  };
}

async function buildPartyLedgerReport(
  partyName: string,
  fromDate: string,
  toDate: string,
  parties: any[],
  companyName?: string,
): Promise<OrbixReportPayload | null> {
  const party =
    parties.find((p) => p.name.toLowerCase() === partyName.toLowerCase()) ||
    parties.find(
      (p) =>
        p.name.toLowerCase().includes(partyName.toLowerCase()) ||
        partyName.toLowerCase().includes(p.name.toLowerCase()),
    );
  if (!party) return null;

  const db = getDB();
  const [accounts, vouchers, invoices] = await Promise.all([
    db.accounts.toArray(),
    db.table("vouchers").toArray(),
    db.table("invoices").toArray().catch(() => []),
  ]);

  const stmt = computePartyStatement(party, accounts, vouchers, invoices, fromDate, toDate);

  return {
    kind: "party_ledger",
    title: `Party Ledger — ${party.name}`,
    subtitle: companyName ? `${companyName} · ${fromDate} to ${toDate}` : `${fromDate} to ${toDate}`,
    fromDate,
    toDate,
    partyName: party.name,
    columns: [
      { key: "date", label: "Date", align: "left" },
      { key: "voucherNo", label: "Voucher", align: "left" },
      { key: "narration", label: "Particulars", align: "left" },
      { key: "debit", label: "Debit", align: "right", mono: true },
      { key: "credit", label: "Credit", align: "right", mono: true },
      { key: "balance", label: "Balance", align: "right", mono: true },
    ],
    rows: [
      {
        date: fromDate,
        voucherNo: "—",
        narration: "Opening Balance",
        debit: stmt.openingBalance > 0 ? fmt(stmt.openingBalance) : "—",
        credit: stmt.openingBalance < 0 ? fmt(-stmt.openingBalance) : "—",
        balance: fmt(stmt.openingBalance),
      },
      ...stmt.rows.map((r: any) => ({
        date: r.date,
        voucherNo: r.voucherNo || "—",
        narration: r.narration || "—",
        debit: r.debit > 0 ? fmt(r.debit) : "—",
        credit: r.credit > 0 ? fmt(r.credit) : "—",
        balance: fmt(r.balance),
      })),
    ],
    summary: [
      { label: "Opening", value: fmt(stmt.openingBalance) },
      { label: "Closing", value: fmt(stmt.closingBalance), accent: true },
      { label: "Entries", value: String(stmt.rows.length) },
    ],
    footerNote: "Running balance · Dr positive = receivable nature",
  };
}

export async function handleOrbixReportQuery(
  text: string,
  ctx: {
    pendingReport?: PendingOrbixReport | null;
    parties: { id: string; name: string }[];
    fyStart?: string;
    fyEnd?: string;
    companyName?: string;
    activeReportSpec?: OrbixReportSpec | null;
  },
): Promise<OrbixReportHandleResult> {
  const followUpOnly =
    Boolean(ctx.activeReportSpec || ctx.pendingReport) && REPORT_FOLLOW_UP.test(text);
  const kind =
    detectReportKind(text) ||
    ctx.pendingReport?.kind ||
    (followUpOnly && ctx.activeReportSpec
      ? ((ctx.activeReportSpec.report_type === "profit_and_loss"
          ? "profit_loss"
          : ctx.activeReportSpec.report_type === "account_ledger"
            ? "party_ledger"
            : ctx.activeReportSpec.report_type) as PendingOrbixReport["kind"])
      : null);
  if (!kind) return null;

  const partyName =
    extractPartyName(text, ctx.parties) || ctx.pendingReport?.partyName;

  const spec = buildReportSpec(kind, text, ctx.activeReportSpec || ctx.pendingReport?.spec);

  if (kind === "party_ledger" && !partyName) {
    return {
      type: "clarify",
      text: "Which party ledger do you need? Select the party and date range below.",
      pending: {
        kind,
        fromDate: ctx.fyStart,
        toDate: ctx.fyEnd || new Date().toISOString().slice(0, 10),
        spec,
      },
    };
  }

  const { fromDate, toDate, needsClarify } = resolveDateRange(
    text,
    ctx.fyStart,
    ctx.fyEnd,
    ctx.pendingReport || { kind, partyName },
  );

  const defaultFrom = ctx.fyStart || new Date().toISOString().slice(0, 10);
  const defaultTo = ctx.fyEnd || new Date().toISOString().slice(0, 10);

  if (needsClarify && !fromDate && !toDate) {
    const label =
      kind === "balance_sheet"
        ? "Balance Sheet"
        : kind === "trial_balance"
          ? "Trial Balance"
          : kind === "profit_loss"
            ? "Profit & Loss"
            : `Ledger — ${partyName || "Party"}`;

    return {
      type: "clarify",
      text: `**${label}** — please confirm the date range below.`,
      pending: {
        kind,
        partyName,
        fromDate: defaultFrom,
        toDate: defaultTo,
      },
    };
  }

  const from = fromDate || defaultFrom;
  const to = toDate || defaultTo;

  if (from > to) {
    return {
      type: "clarify",
      text: "From date cannot be after To date. Please correct the range.",
      pending: { kind, partyName, fromDate: to, toDate: from },
    };
  }

  try {
    let report: OrbixReportPayload | null = null;

    if (kind === "trial_balance") {
      report = await buildTrialBalanceReport(from, to, ctx.fyStart, ctx.companyName);
    } else if (kind === "balance_sheet") {
      report = await buildBalanceSheetReport(to, ctx.companyName);
    } else if (kind === "profit_loss") {
      report = await buildProfitLossReport(from, to, ctx.companyName);
    } else if (kind === "party_ledger" && partyName) {
      report = await buildPartyLedgerReport(
        partyName,
        from,
        to,
        ctx.parties,
        ctx.companyName,
      );
      if (!report) {
        return {
          type: "clarify",
          text: `Party **"${partyName}"** not found. Select from your party list below.`,
          pending: { kind, partyName, fromDate: from, toDate: to },
        };
      }
    }

    if (!report) return null;

    report = { ...report, spec };

    const detailNote = [
      spec.comparison?.enabled ? "vs previous year" : null,
      spec.include_subgroups ? "subgroups" : null,
      spec.include_ledgers ? "ledgers" : null,
      spec.expanded_groups?.length
        ? `expanded: ${spec.expanded_groups.join(", ")}`
        : null,
      spec.filters?.branch ? `under ${spec.filters.branch}` : null,
      spec.include_zero_balances === false ? "zeros hidden" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const textSummary =
      kind === "trial_balance"
        ? `Trial Balance (${from} to ${to}) — ${report.rows.length} accounts.${detailNote ? ` (${detailNote})` : ""}`
        : kind === "balance_sheet"
          ? `Balance Sheet as at ${to}.${detailNote ? ` (${detailNote})` : ""}`
          : kind === "profit_loss"
            ? `Profit & Loss (${from} to ${to}).${detailNote ? ` (${detailNote})` : ""}`
            : `Ledger for ${partyName} (${from} to ${to}) — ${report.rows.length - 1} entries.`;

    return { type: "report", text: textSummary, report };
  } catch (err) {
    return {
      type: "clarify",
      text: `Could not generate report: ${err instanceof Error ? err.message : "Unknown error"}. Try adjusting dates.`,
      pending: { kind, partyName, fromDate: from, toDate: to },
    };
  }
}

export function isReportFollowUp(text: string, pending: PendingOrbixReport | null): boolean {
  if (!pending) return false;
  if (extractIsoDates(text).length > 0) return true;
  if (/\b(yes|ho|ok|confirm|generate|show|dekha)\b/i.test(text)) return true;
  return false;
}
