/** SUTRA AI — P&L and trial balance report queries */

import type {
  AIResponse,
  ErpPnlSnapshot,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { computePnlFromInvoices } from "./FiscalPnlCalculator";

const REPORT_PATTERNS = [
  /\b(aaja|today)\s+ko\s+(bikri|sales|income)\b/i,
  /\b(yo\s+)?mahina\s+ko\s+(profit|labh|nakksan|pnl)\b/i,
  /\b(a\.?v\.?|chalu\s+a\.?v\.?)\s+ko\s+(profit|nafa|labh|pnl)\b/i,
  /\b(profit|loss|pnl|labh|nafa)\s+(kati|summary|report)\b/i,
  /\bko\s+(profit|nafa|labh|pnl)\b/i,
  /\b(sales|income|expense)\s+(summary|report|kati)\b/i,
  /\btrial\s+balance\b/i,
  /\bhisaab\s+milo\b/i,
  /आज\s*को\s*बिक्री|यो\s*महिना|नाफा|नोक्सान|ट्रायल\s*ब्यालेन्स/,
];

const PERIOD_PATTERNS: Array<{
  re: RegExp;
  period: ErpPnlSnapshot["period"];
}> = [
  { re: /\b(aaja|today)\b/i, period: "today" },
  { re: /\b(hijo|yesterday)\b/i, period: "this_week" },
  { re: /\b(last\s+month|gata\s+mahina)\b/i, period: "last_month" },
  { re: /\b(fy|fiscal|barsa|a\.?v\.?|chalu\s+a\.?v\.?)\b/i, period: "current_fy" },
  { re: /\b(week|hafta)\b/i, period: "this_week" },
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export interface ReportQueryResult {
  kind: "pnl" | "trial_balance";
  nepali: string;
  english: string;
  roman: string;
}

export class ReportQueryHandler {
  isReportQuery(text: string, intent?: IntentClassification): boolean {
    if (REPORT_PATTERNS.some((re) => re.test(text))) return true;
    if (
      intent?.intent === "REPORT_REQUEST" ||
      (intent?.intent === "QUERY" && /\b(report|profit|sales|trial|hisaab)\b/i.test(text))
    ) {
      return true;
    }
    return false;
  }

  isTrialBalanceQuery(text: string): boolean {
    return /\b(trial\s+balance|hisaab\s+milo)\b/i.test(text);
  }

  detectPeriod(text: string): ErpPnlSnapshot["period"] {
    for (const { re, period } of PERIOD_PATTERNS) {
      if (re.test(text)) return period;
    }
    return "current_month";
  }

  resolvePnl(snapshot: ErpPnlSnapshot, fyLabel?: string): ReportQueryResult {
    const periodLabel =
      snapshot.period === "today"
        ? "आज"
        : snapshot.period === "this_week"
          ? "यो हप्ता"
          : snapshot.period === "last_month"
            ? "गत महिना"
            : snapshot.period === "current_fy"
              ? fyLabel ? `चालु आ.व. ${fyLabel}` : "चालु आ.व."
              : "यो महिना";

    const nepali =
      `${periodLabel} को सारांश:\n` +
      `आम्दानी: ${formatAmount(snapshot.totalIncome)}\n` +
      `खर्च: ${formatAmount(snapshot.totalExpense)}\n` +
      `नाफा/नोक्सान: ${formatAmount(snapshot.netProfit)} (${snapshot.entryCount} प्रविष्टि)`;

    const english =
      `Summary (${snapshot.period}):\n` +
      `Income: ${formatAmount(snapshot.totalIncome)}\n` +
      `Expense: ${formatAmount(snapshot.totalExpense)}\n` +
      `Net profit: ${formatAmount(snapshot.netProfit)} (${snapshot.entryCount} entries)`;

    const roman =
      `Saransh (${snapshot.period}):\n` +
      `Aamdani: ${formatAmount(snapshot.totalIncome)}\n` +
      `Kharcha: ${formatAmount(snapshot.totalExpense)}\n` +
      `Nafa/Noksan: ${formatAmount(snapshot.netProfit)} (${snapshot.entryCount} entries)`;

    return { kind: "pnl", nepali, english, roman };
  }

  resolveTrialBalance(ctx: ErpRagContext): ReportQueryResult | null {
    const tb = ctx.trialBalance;
    if (!tb) return null;

    const status = tb.isBalanced ? "मिलेको छ" : "मिलेन";
    const nepali =
      `ट्रायल ब्यालेन्स (${tb.rowCount} खाता):\n` +
      `कुल डेबिट: ${formatAmount(tb.totalDebit)}\n` +
      `कुल क्रेडिट: ${formatAmount(tb.totalCredit)}\n` +
      `स्थिति: ${status}`;

    const english =
      `Trial balance (${tb.rowCount} accounts):\n` +
      `Total debit: ${formatAmount(tb.totalDebit)}\n` +
      `Total credit: ${formatAmount(tb.totalCredit)}\n` +
      `Status: ${tb.isBalanced ? "Balanced" : "Unbalanced"}`;

    const roman =
      `Trial balance (${tb.rowCount} accounts):\n` +
      `Kul debit: ${formatAmount(tb.totalDebit)}\n` +
      `Kul credit: ${formatAmount(tb.totalCredit)}\n` +
      `Status: ${tb.isBalanced ? "Milyo" : "Milena"}`;

    return { kind: "trial_balance", nepali, english, roman };
  }

  resolve(
    text: string,
    ctx?: ErpRagContext,
  ): ReportQueryResult | null {
    if (!ctx) return null;

    if (this.isTrialBalanceQuery(text)) {
      return this.resolveTrialBalance(ctx);
    }

    const period = this.detectPeriod(text);
    let snapshot = ctx.pnlSnapshot;

    if (ctx.recentInvoices?.length) {
      snapshot = computePnlFromInvoices(
        ctx.recentInvoices,
        period,
        ctx.fiscalYear,
      );
    }

    if (snapshot) {
      return this.resolvePnl(snapshot, ctx.fiscalYear?.label);
    }

    return null;
  }

  toAIResponse(
    result: ReportQueryResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
    return {
      understood_input: understoodInput,
      confidence: 0.91,
      needs_clarification: false,
      suggestions: [],
      response: {
        english: result.english,
        nepali: result.nepali,
        roman: result.roman,
      },
      sourceLanguage: "roman",
      actions: [
        {
          id: `rpt-${Date.now().toString(36)}`,
          type: "navigate",
          page: "reports",
          label: "Open Reports",
          labelNepali: "रिपोर्ट हेर्नुहोस्",
        },
      ],
    };
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isReportQuery(text, intent)) return null;
    const result = this.resolve(text, ctx);
    if (!result) return null;
    return this.toAIResponse(result, outputLanguage, understoodInput);
  }
}

export const reportQueryHandler = new ReportQueryHandler();
