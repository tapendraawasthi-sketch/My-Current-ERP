/** SUTRA AI — compound multi-party credit/payment utterances */

import type {
  AIResponse,
  AiKhataDraft,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
  SutraAiAction,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";

function formatAmount(n: number): string {
  return `Rs. ${n.toLocaleString("en-NP")}`;
}

function actionId(): string {
  return `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export class CompoundTransactionHandler {
  isCompound(text: string, entities: ExtractedEntities): boolean {
    return (entities.partyLines?.length ?? 0) >= 2 || /\b(ani|ra)\b.*\blai\s+\d+/i.test(text);
  }

  resolveParties(
    lines: NonNullable<ExtractedEntities["partyLines"]>,
    ctx?: ErpRagContext,
  ): Array<{ partyName: string; amount: number }> {
    const resolved: Array<{ partyName: string; amount: number }> = [];
    for (const line of lines) {
      if (!line.party || !line.amount) continue;
      let name = line.party;
      if (ctx?.parties?.length) {
        const hit = erpRagRetriever.findParties(line.party, ctx.parties, 1)[0];
        if (hit && hit.score >= 0.6) name = hit.ref.name;
      }
      resolved.push({ partyName: name, amount: line.amount });
    }
    return resolved;
  }

  private draftForRow(
    row: { partyName: string; amount: number },
    text: string,
    understoodInput: string,
  ): AiKhataDraft {
    const isUdhaar = /\budhaar\b/i.test(text);
    const isReceipt = /\b(le|bata)\b.*\b(tiryo|diye|jama)\b/i.test(text) || /\btiryo\b/i.test(text);

    let intent: AiKhataDraft["intent"] = "khata_credit_sale";
    if (isUdhaar) intent = "khata_credit_sale";
    else if (isReceipt) intent = "khata_payment_in";
    else intent = "khata_payment_out";

    return {
      intent,
      party: row.partyName,
      amount: row.amount,
      date: todayIso(),
      rawText: understoodInput,
      narration: `SUTRA AI compound: ${row.partyName} ${row.amount}`,
    };
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    _intent: IntentClassification | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isCompound(text, entities) || !entities.partyLines?.length) return null;

    const rows = this.resolveParties(entities.partyLines, ctx);
    if (rows.length < 2) return null;

    const isCredit = /\budhaar\b/i.test(text);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const lineText = rows.map((r) => `${r.partyName}: ${formatAmount(r.amount)}`).join("\n");

    const nepali =
      `${rows.length} वटा ${isCredit ? "उधार" : "भुक्तानी"} (कुल ${formatAmount(total)}):\n${lineText}`;
    const english =
      `${rows.length} ${isCredit ? "credit" : "payment"} entries (total ${formatAmount(total)}):\n${lineText}`;
    const roman = `${rows.length} entries (total ${formatAmount(total)}):\n${lineText}`;

    const actions: SutraAiAction[] = rows.slice(0, 4).map((row) => {
      const draft = this.draftForRow(row, text, understoodInput);
      return {
        id: actionId(),
        type: "prefill_khata",
        page: "ekhata",
        khataDraft: draft,
        label: `${row.partyName} — ${formatAmount(row.amount)}`,
        labelNepali: `${row.partyName} — ${formatAmount(row.amount)}`,
      };
    });

    return {
      understood_input: understoodInput,
      confidence: 0.88,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      actions,
    };
  }
}

export const compoundTransactionHandler = new CompoundTransactionHandler();
