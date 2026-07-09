/** SUTRA AI — business insights from invoice history */

import type {
  AIResponse,
  ErpBusinessInsights,
  ErpPartyStats,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";

const INSIGHT_PATTERNS = [
  /\b(business\s+)?(summary|insights?)\b/i,
  /\btop\s+(selling|product|party)\b/i,
  /\b(sabai\s+bhanda|dherai)\s+.*\b(bikne|bikri)\b/i,
  /\baaja\s+kati\s+bill\b/i,
  /व्यापार\s*सारांश|सबैभन्दा\s*धेरै|आज\s*कति\s*बिल/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export class InsightQueryHandler {
  isInsightQuery(text: string, intent?: IntentClassification): boolean {
    if (INSIGHT_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "REPORT_REQUEST" && /\b(summary|insight|top)\b/i.test(text)) {
      return true;
    }
    return false;
  }

  formatInsights(insights: ErpBusinessInsights): {
    nepali: string;
    english: string;
    roman: string;
  } {
    const topParty = insights.topParties[0];
    const topProduct = insights.topProducts[0];

    const nepali =
      `व्यापार सारांश:\n` +
      `आजको बिक्री: ${formatAmount(insights.todaySalesTotal)} (${insights.todayInvoiceCount} बिल)\n` +
      (topParty
        ? `शीर्ष पार्टी: ${topParty.partyName} (औसत ${formatAmount(topParty.avgAmount)})\n`
        : "") +
      (topProduct ? `शीर्ष सामान: ${topProduct.name} (${topProduct.qty} युनिट)` : "");

    const english =
      `Business summary:\n` +
      `Today's sales: ${formatAmount(insights.todaySalesTotal)} (${insights.todayInvoiceCount} invoices)\n` +
      (topParty
        ? `Top party: ${topParty.partyName} (avg ${formatAmount(topParty.avgAmount)})\n`
        : "") +
      (topProduct ? `Top product: ${topProduct.name} (${topProduct.qty} units)` : "");

    const roman =
      `Business summary:\n` +
      `Aajako bikri: ${formatAmount(insights.todaySalesTotal)} (${insights.todayInvoiceCount} bills)\n` +
      (topParty ? `Top party: ${topParty.partyName}\n` : "") +
      (topProduct ? `Top product: ${topProduct.name}` : "");

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
    if (!this.isInsightQuery(text, intent)) return null;
    const insights = ctx?.businessInsights;
    if (!insights) return null;

    const formatted = this.formatInsights(insights);
    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: formatted,
      sourceLanguage: "roman",
      actions: [
        {
          id: `ins-${Date.now().toString(36)}`,
          type: "navigate",
          page: "reports",
          label: "View Reports",
          labelNepali: "रिपोर्ट हेर्नुहोस्",
        },
      ],
    };
  }
}

export const insightQueryHandler = new InsightQueryHandler();

export function computeBusinessInsights(
  invoices: Array<{
    date?: string;
    partyName?: string;
    grandTotal?: number;
    type?: string;
    lines?: Array<{ itemName?: string; qty?: number; rate?: number }>;
  }>,
): ErpBusinessInsights {
  const today = new Date().toISOString().slice(0, 10);
  const todayInvoices = invoices.filter(
    (i) => i.date === today && (i.type ?? "").includes("sales"),
  );
  const todaySalesTotal = todayInvoices.reduce((s, i) => s + (i.grandTotal ?? 0), 0);

  const partyMap = new Map<string, { total: number; count: number }>();
  for (const inv of invoices) {
    if (!inv.partyName) continue;
    const cur = partyMap.get(inv.partyName) ?? { total: 0, count: 0 };
    cur.total += inv.grandTotal ?? 0;
    cur.count += 1;
    partyMap.set(inv.partyName, cur);
  }

  const topParties = [...partyMap.entries()]
    .map(([partyName, v]) => ({
      partyName,
      invoiceCount: v.count,
      totalAmount: v.total,
      avgAmount: Math.round(v.total / v.count),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  const productMap = new Map<string, { qty: number; amount: number }>();
  for (const inv of invoices) {
    for (const line of inv.lines ?? []) {
      if (!line.itemName) continue;
      const cur = productMap.get(line.itemName) ?? { qty: 0, amount: 0 };
      cur.qty += line.qty ?? 1;
      cur.amount += (line.rate ?? 0) * (line.qty ?? 1);
      productMap.set(line.itemName, cur);
    }
  }

  const topProducts = [...productMap.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    todaySalesTotal,
    todayInvoiceCount: todayInvoices.length,
    topParties,
    topProducts,
  };
}

export function computePartyStats(
  invoices: Array<{ partyName?: string; grandTotal?: number }>,
): ErpPartyStats[] {
  const partyMap = new Map<string, { total: number; count: number }>();
  for (const inv of invoices) {
    if (!inv.partyName) continue;
    const cur = partyMap.get(inv.partyName) ?? { total: 0, count: 0 };
    cur.total += inv.grandTotal ?? 0;
    cur.count += 1;
    partyMap.set(inv.partyName, cur);
  }
  return [...partyMap.entries()].map(([partyName, v]) => ({
    partyName,
    invoiceCount: v.count,
    totalAmount: v.total,
    avgAmount: Math.round(v.total / v.count),
  }));
}
