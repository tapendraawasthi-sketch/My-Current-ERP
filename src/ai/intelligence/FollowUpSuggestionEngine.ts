/** SUTRA AI — contextual next-query suggestions as quick-reply chips */

import type {
  AIResponse,
  ExtractedEntities,
  IntentClassification,
  QuickReply,
  SessionState,
} from "../types";

export class FollowUpSuggestionEngine {
  suggest(
    intent: IntentClassification | undefined,
    entities: ExtractedEntities | undefined,
    session: SessionState,
    response: AIResponse,
  ): QuickReply[] {
    if (response.needs_clarification || response.quickReplies?.length) return [];

    const out: QuickReply[] = [];
    const party = entities?.partyResolvedName ?? entities?.party ?? session.lastParty;

    if (
      intent?.intent === "SALES_ENTRY" ||
      intent?.intent === "PURCHASE_ENTRY" ||
      entities?.transactionType === "sales"
    ) {
      if (party) {
        out.push({
          id: "fu-bal",
          label: `${party} balance`,
          value: `${party} ko balance kati`,
          kind: "query",
        });
      }
      out.push({
        id: "fu-stock",
        label: "Stock check",
        value: entities?.product ? `${entities.product} kati baki cha` : "kam stock ke ke cha",
        kind: "query",
      });
    }

    if (intent?.intent === "QUERY" && /\b(balance|baki)\b/i.test(response.understood_input)) {
      if (party) {
        out.push({
          id: "fu-inv",
          label: "Last bill",
          value: `${party} ko last bill`,
          kind: "query",
        });
      }
      out.push({
        id: "fu-recv",
        label: "All udhaar",
        value: "sabai udhaar list",
        kind: "query",
      });
    }

    if (/\b(stock|baki cha)\b/i.test(response.understood_input)) {
      out.push({
        id: "fu-sales",
        label: "Today sales",
        value: "aaja ko bikri kati",
        kind: "query",
      });
    }

    if (intent?.intent === "REPORT_REQUEST" || /\b(profit|bikri|summary)\b/i.test(response.understood_input)) {
      out.push({
        id: "fu-cmp",
        label: "vs yesterday",
        value: "aaja vs hijo bikri",
        kind: "query",
      });
      out.push({
        id: "fu-ins",
        label: "Insights",
        value: "business summary",
        kind: "query",
      });
    }

    return out.slice(0, 3);
  }
}

export const followUpSuggestionEngine = new FollowUpSuggestionEngine();
