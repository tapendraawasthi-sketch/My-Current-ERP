/** SUTRA AI — ledger balance queries via ERP RAG */

import type { AIResponse, ErpRagContext, ExtractedEntities, IntentClassification, LanguageCode } from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";

const BALANCE_PATTERNS = [
  /\b(ko\s+)?balance\s+kati\b/i,
  /\bbaki\s+kati\b/i,
  /\bkati\s+(baki|udhaar|daina|paisa|rupiya)\b/i,
  /\b(ko\s+)?hisaab\s+kati\b/i,
  /\b(ko\s+)?ledger\s+kati\b/i,
  /\bhow\s+much\s+(does\s+)?\w+\s+owe\b/i,
  /बाँकी|ब्यालेन्स|उधार\s*कति|कति\s*उधार/,
];

function formatAmount(n: number, symbol = "Rs."): string {
  return `${symbol} ${Math.abs(n).toLocaleString("en-NP")}`;
}

export interface BalanceQueryResult {
  partyName: string;
  balance: number;
  balanceType: "receivable" | "payable" | "zero";
  nepali: string;
  english: string;
  roman: string;
}

export class LedgerQueryHandler {
  isBalanceQuery(text: string, intent?: IntentClassification): boolean {
    if (BALANCE_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "QUERY" && /\b(balance|baki|udhaar|hisaab|kati)\b/i.test(text)) {
      return true;
    }
    if (intent?.intent === "REPORT_REQUEST" && /\b(balance|baki|party)\b/i.test(text)) {
      return true;
    }
    return false;
  }

  resolve(
    text: string,
    entities: ExtractedEntities,
    ctx?: ErpRagContext,
  ): BalanceQueryResult | null {
    if (!ctx?.parties?.length) return null;

    let partyQuery = entities.party ?? entities.partyResolvedName;
    if (!partyQuery) {
      const m = text.match(/\b([a-z\u0900-\u097F]{2,20})\s+ko\b/i);
      if (m && !["ma", "timi", "tapai", "aaja", "hijo"].includes(m[1].toLowerCase())) {
        partyQuery = m[1];
      }
    }
    if (!partyQuery) return null;

    const hits = erpRagRetriever.findParties(partyQuery, ctx.parties, 1);
    const party = hits[0]?.ref;
    if (!party || hits[0].score < 0.6) return null;

    const balance = party.balance ?? 0;
    const balanceType: BalanceQueryResult["balanceType"] =
      balance > 0 ? "receivable" : balance < 0 ? "payable" : "zero";

    const abs = formatAmount(balance);
    const nepali =
      balance > 0
        ? `${party.name} को बाँकी: ${abs} (लिन बाँकी)`
        : balance < 0
          ? `${party.name} लाई दिन बाँकी: ${formatAmount(Math.abs(balance))}`
          : `${party.name} को हिसाब मिलेको छ — बाँकी शून्य।`;

    const english =
      balance > 0
        ? `${party.name} owes you ${abs} (receivable).`
        : balance < 0
          ? `You owe ${party.name} ${formatAmount(Math.abs(balance))} (payable).`
          : `${party.name} has zero outstanding balance.`;

    const roman =
      balance > 0
        ? `${party.name} ko baki: ${abs} (linu baki)`
        : balance < 0
          ? `${party.name} lai dinu baki: ${formatAmount(Math.abs(balance))}`
          : `${party.name} ko hisaab milyo — baki sunya.`;

    return { partyName: party.name, balance, balanceType, nepali, english, roman };
  }

  toAIResponse(
    result: BalanceQueryResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
    const primary =
      outputLanguage === "english"
        ? result.english
        : outputLanguage === "roman"
          ? result.roman
          : result.nepali;

    return {
      understood_input: understoodInput,
      confidence: 0.93,
      needs_clarification: false,
      suggestions: [],
      response: {
        english: result.english,
        nepali: result.nepali,
        roman: result.roman,
      },
      sourceLanguage: "roman",
      followUp: undefined,
      actions: [
        {
          id: `bal-${Date.now().toString(36)}`,
          type: "navigate",
          page: "ledger",
          label: "View Ledger",
          labelNepali: "खाता हेर्नुहोस्",
        },
      ],
    };
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isBalanceQuery(text, intent)) return null;
    const result = this.resolve(text, entities, ctx);
    if (!result) return null;
    return this.toAIResponse(result, outputLanguage, understoodInput);
  }
}

export const ledgerQueryHandler = new LedgerQueryHandler();
