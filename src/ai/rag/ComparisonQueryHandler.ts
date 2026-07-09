/** SUTRA AI — period-over-period sales comparisons */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { dateResolver } from "../context/DateResolver";

const COMPARE_PATTERNS = [
  /\b(aaja|today)\s+(vs|versus|ra)\s+(hijo|yesterday)\b/i,
  /\b(hijo|yesterday)\s+(vs|versus|ra)\s+(aaja|today)\b/i,
  /\bcompare\b.*\b(sales|bikri|income)\b/i,
  /\b(tulana|bhanda)\b.*\b(bikri|sales)\b/i,
  /आज\s*र\s*हिजो|तुलना/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

function salesTotalForDate(
  invoices: ErpRagContext["recentInvoices"],
  iso: string,
): { total: number; count: number } {
  const rows = (invoices ?? []).filter(
    (i) => i.date === iso && (i.type ?? "").includes("sales"),
  );
  return {
    total: rows.reduce((s, i) => s + (i.grandTotal ?? 0), 0),
    count: rows.length,
  };
}

export interface ComparisonResult {
  leftLabel: string;
  rightLabel: string;
  leftTotal: number;
  rightTotal: number;
  leftCount: number;
  rightCount: number;
  delta: number;
  deltaPct: number;
}

export class ComparisonQueryHandler {
  isComparisonQuery(text: string, intent?: IntentClassification): boolean {
    if (COMPARE_PATTERNS.some((re) => re.test(text))) return true;
    if (dateResolver.isComparisonQuery(text)) return true;
    if (intent?.intent === "REPORT_REQUEST" && /\b(vs|compare|tulana)\b/i.test(text)) {
      return true;
    }
    return false;
  }

  resolve(text: string, ctx?: ErpRagContext): ComparisonResult | null {
    const today = dateResolver.byKey("today");
    const yesterday = dateResolver.byKey("yesterday");

    let leftIso = today.iso;
    let rightIso = yesterday.iso;
    let leftLabel = today.labelNepali;
    let rightLabel = yesterday.labelNepali;

    if (/\b(hijo|yesterday)\s+(vs|versus|ra)\s+(aaja|today)\b/i.test(text)) {
      leftIso = yesterday.iso;
      rightIso = today.iso;
      leftLabel = yesterday.labelNepali;
      rightLabel = today.labelNepali;
    }

    const left = salesTotalForDate(ctx?.recentInvoices, leftIso);
    const right = salesTotalForDate(ctx?.recentInvoices, rightIso);
    const delta = left.total - right.total;
    const base = right.total || 1;
    const deltaPct = Math.round((delta / base) * 100);

    return {
      leftLabel,
      rightLabel,
      leftTotal: left.total,
      rightTotal: right.total,
      leftCount: left.count,
      rightCount: right.count,
      delta,
      deltaPct,
    };
  }

  format(result: ComparisonResult): { nepali: string; english: string; roman: string } {
    const trend =
      result.delta > 0 ? "बढ्यो" : result.delta < 0 ? "घट्यो" : "उस्तै";
    const trendEn = result.delta > 0 ? "up" : result.delta < 0 ? "down" : "flat";

    const nepali =
      `बिक्री तुलना:\n` +
      `${result.leftLabel}: ${formatAmount(result.leftTotal)} (${result.leftCount} बिल)\n` +
      `${result.rightLabel}: ${formatAmount(result.rightTotal)} (${result.rightCount} बिल)\n` +
      `फरक: ${formatAmount(Math.abs(result.delta))} (${result.deltaPct}%) — ${trend}`;

    const english =
      `Sales comparison:\n` +
      `${result.leftLabel}: ${formatAmount(result.leftTotal)} (${result.leftCount} invoices)\n` +
      `${result.rightLabel}: ${formatAmount(result.rightTotal)} (${result.rightCount} invoices)\n` +
      `Change: ${formatAmount(Math.abs(result.delta))} (${result.deltaPct}%) — ${trendEn}`;

    const roman =
      `Sales comparison:\n` +
      `${result.leftLabel}: ${formatAmount(result.leftTotal)}\n` +
      `${result.rightLabel}: ${formatAmount(result.rightTotal)}\n` +
      `Farak: ${formatAmount(Math.abs(result.delta))} (${result.deltaPct}%)`;

    return { nepali, english, roman };
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isComparisonQuery(text, intent)) return null;
    const result = this.resolve(text, ctx);
    if (!result) return null;

    const formatted = this.format(result);
    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: formatted,
      sourceLanguage: "roman",
      actions: [
        {
          id: `cmp-${Date.now().toString(36)}`,
          type: "navigate",
          page: "reports",
          label: "View Reports",
          labelNepali: "रिपोर्ट हेर्नुहोस्",
        },
      ],
    };
  }
}

export const comparisonQueryHandler = new ComparisonQueryHandler();
