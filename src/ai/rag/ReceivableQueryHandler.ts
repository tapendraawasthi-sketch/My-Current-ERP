/** SUTRA AI — receivable / payable list and totals */

import type {
  AIResponse,
  ErpPartyRef,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";

const RECEIVABLE_PATTERNS = [
  /\b(sabai|all|kul|total).*\b(udhaar|receivable|linu?\s*baki|debtor)\b/i,
  /\bko\s+ko.*\b(dinu?\s*baki|udhaar|owe|baki)\b/i,
  /\btop\s+(debtor|udhaar|receivable)/i,
  /\breceivable\s+(list|summary|report)\b/i,
  /\b(dinu?\s*baki|linu?\s*baki)\s+list\b/i,
  /सबै\s*उधार|कुल\s*बाँकी|कसले\s*दिनु\s*बाँकी/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

function rankReceivables(parties: ErpPartyRef[]): ErpPartyRef[] {
  return [...parties]
    .filter((p) => (p.balance ?? 0) > 0)
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
}

function rankPayables(parties: ErpPartyRef[]): ErpPartyRef[] {
  return [...parties]
    .filter((p) => (p.balance ?? 0) < 0)
    .sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0));
}

export class ReceivableQueryHandler {
  isReceivableQuery(text: string, intent?: IntentClassification): boolean {
    if (RECEIVABLE_PATTERNS.some((re) => re.test(text))) return true;
    if (
      intent?.intent === "REPORT_REQUEST" &&
      /\b(receivable|udhaar|debtor|payable|baki)\b/i.test(text)
    ) {
      return true;
    }
    return false;
  }

  isPayableList(text: string): boolean {
    return /\b(payable|dinu\s*baki|creditor|lai\s+dinu)\b/i.test(text) && /\b(list|sabai|all)\b/i.test(text);
  }

  format(
    receivables: ErpPartyRef[],
    payables: ErpPartyRef[],
    mode: "receivable" | "payable" | "both",
  ): { nepali: string; english: string; roman: string } {
    const recvTotal = receivables.reduce((s, p) => s + (p.balance ?? 0), 0);
    const payTotal = payables.reduce((s, p) => s + Math.abs(p.balance ?? 0), 0);

    const recvLines = receivables.slice(0, 8).map(
      (p) => `${p.name}: ${formatAmount(p.balance ?? 0)}`,
    );
    const payLines = payables.slice(0, 8).map(
      (p) => `${p.name}: ${formatAmount(Math.abs(p.balance ?? 0))}`,
    );

    let nepali = "";
    let english = "";
    let roman = "";

    if (mode !== "payable") {
      nepali += `लिनु बाँकी (कुल ${formatAmount(recvTotal)}, ${receivables.length} पार्टी):\n`;
      nepali += recvLines.length ? recvLines.join("\n") : "कुनै लिनु बाँकी छैन।";
      english += `Receivables (total ${formatAmount(recvTotal)}, ${receivables.length} parties):\n`;
      english += recvLines.length ? recvLines.join("\n") : "No receivables.";
      roman += `Linu baki (total ${formatAmount(recvTotal)}):\n`;
      roman += recvLines.length ? recvLines.join("\n") : "Chaina.";
    }

    if (mode === "both" || mode === "payable") {
      if (nepali) nepali += "\n\n";
      if (english) english += "\n\n";
      if (roman) roman += "\n\n";
      nepali += `दिनु बाँकी (कुल ${formatAmount(payTotal)}, ${payables.length} पार्टी):\n`;
      nepali += payLines.length ? payLines.join("\n") : "कुनै दिनु बाँकी छैन।";
      english += `Payables (total ${formatAmount(payTotal)}, ${payables.length} parties):\n`;
      english += payLines.length ? payLines.join("\n") : "No payables.";
      roman += `Dinu baki (total ${formatAmount(payTotal)}):\n`;
      roman += payLines.length ? payLines.join("\n") : "Chaina.";
    }

    return { nepali, english, roman };
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isReceivableQuery(text, intent) && !this.isPayableList(text)) return null;
    if (!ctx?.parties?.length) return null;

    const receivables = rankReceivables(ctx.parties);
    const payables = rankPayables(ctx.parties);
    const mode = this.isPayableList(text) ? "payable" : "receivable";
    const formatted = this.format(receivables, payables, mode);

    return {
      understood_input: understoodInput,
      confidence: 0.91,
      needs_clarification: false,
      suggestions: [],
      response: formatted,
      sourceLanguage: "roman",
      actions: [
        {
          id: `rcv-${Date.now().toString(36)}`,
          type: "navigate",
          page: "ledger",
          label: "View Ledger",
          labelNepali: "खाता हेर्नुहोस्",
        },
      ],
    };
  }
}

export const receivableQueryHandler = new ReceivableQueryHandler();
