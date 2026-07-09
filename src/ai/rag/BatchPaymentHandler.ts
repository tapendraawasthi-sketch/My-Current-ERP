/** SUTRA AI — batch payment/receipt entries (multi-party tiryo/jama) */

import type {
  AIResponse,
  AiKhataDraft,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
  SutraAiAction,
} from "../types";
import { compoundTransactionHandler } from "./CompoundTransactionHandler";

const BATCH_PAYMENT_PATTERNS = [
  /\b(ani|ra|and)\b.*\b(lai|le|bata)\b.*\b(tiryo|tireko|diye|jama|payment)\b/i,
  /\b(tiryo|tireko|diye|jama)\b.*\b(ani|ra|and)\b/i,
  /\bbatch\s+payment\b/i,
];

function formatAmount(n: number): string {
  return `Rs. ${n.toLocaleString("en-NP")}`;
}

function actionId(): string {
  return `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export class BatchPaymentHandler {
  isBatchPayment(text: string, entities: ExtractedEntities): boolean {
    if ((entities.partyLines?.length ?? 0) < 2) return false;
    if (/\budhaar\b/i.test(text)) return false;
    if (BATCH_PAYMENT_PATTERNS.some((re) => re.test(text))) return true;
    if (/\b(tiryo|tireko|diye|jama)\b/i.test(text)) return true;
    return false;
  }

  intentForRow(text: string, partyName: string): AiKhataDraft["intent"] {
    const seg = new RegExp(`\\b${partyName}\\s+(le|bata)\\b`, "i");
    if (seg.test(text) || /\bbata\b/i.test(text)) return "khata_payment_in";
    return "khata_payment_out";
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isBatchPayment(text, entities)) return null;

    const compound = compoundTransactionHandler.tryBuildResponse(
      text,
      entities,
      ctx,
      intent,
      outputLanguage,
      understoodInput,
    );
    if (!compound) return null;

    const rows = compoundTransactionHandler.resolveParties(entities.partyLines!, ctx);
    if (rows.length < 2) return null;

    const actions: SutraAiAction[] = rows.slice(0, 5).map((row) => {
      const draft: AiKhataDraft = {
        intent: this.intentForRow(text, row.partyName),
        party: row.partyName,
        amount: row.amount,
        date: todayIso(),
        rawText: understoodInput,
        narration: `SUTRA AI batch payment: ${row.partyName}`,
      };
      return {
        id: actionId(),
        type: "prefill_khata",
        page: "ekhata",
        khataDraft: draft,
        label: `${row.partyName} — ${formatAmount(row.amount)}`,
        labelNepali: `${row.partyName} — ${formatAmount(row.amount)}`,
      };
    });

    const total = rows.reduce((s, r) => s + r.amount, 0);
    const lineText = rows.map((r) => `${r.partyName}: ${formatAmount(r.amount)}`).join("\n");

    return {
      ...compound,
      response: {
        nepali: `ब्याच भुक्तानी (${rows.length} पार्टी, कुल ${formatAmount(total)}):\n${lineText}`,
        english: `Batch payment (${rows.length} parties, total ${formatAmount(total)}):\n${lineText}`,
        roman: `Batch payment (${rows.length} parties, total ${formatAmount(total)}):\n${lineText}`,
      },
      actions,
    };
  }
}

export const batchPaymentHandler = new BatchPaymentHandler();
