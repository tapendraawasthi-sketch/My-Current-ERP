/** SUTRA AI — map understood intent to ERP actions */

import type {
  AiInvoiceDraft,
  ExtractedEntities,
  IntentType,
  InvoiceTabType,
  SutraAiAction,
} from "../types";
import { buildAiKhataDraft } from "./KhataCardBuilder";

function actionId(): string {
  return `act-${Date.now().toString(36)}`;
}

function tabForIntent(
  intent: IntentType,
  txType?: string,
  understoodInput?: string,
): InvoiceTabType | null {
  if (intent === "SALES_ENTRY" || txType === "sales") return "sales";
  if (intent === "PURCHASE_ENTRY" || txType === "purchase") return "purchase";
  if (intent === "RETURN_ENTRY" || txType === "return") {
    return /\b(kharid|purchase|kin|kinyo|supplier|vendor)\b/i.test(understoodInput ?? "")
      ? "purchase-return"
      : "sales-return";
  }
  return null;
}

function pageForTab(tab: InvoiceTabType): string {
  if (tab === "sales") return "sales-invoice";
  if (tab === "purchase") return "purchase-invoice";
  if (tab === "purchase-return") return "purchase-return";
  return tab;
}

function buildDraft(
  tab: InvoiceTabType,
  entities: ExtractedEntities,
  understoodInput: string,
): AiInvoiceDraft {
  const invoiceLines =
    entities.lines && entities.lines.length >= 2
      ? entities.lines.map((line) => ({
          itemName: line.productEnglish ?? line.product,
          itemId: line.itemId,
          rate: line.itemRate ?? line.amount,
          qty: line.quantity ?? 1,
          unit: line.unit,
        }))
      : [
          {
            itemName: entities.productEnglish ?? entities.product,
            itemId: entities.itemId,
            rate: entities.amount ?? entities.itemRate,
            qty: entities.quantity ?? 1,
            unit: entities.unit,
          },
        ];

  return {
    type: tab,
    partyName: entities.partyResolvedName ?? entities.party,
    partyId: entities.partyId,
    paymentMode: entities.paymentMode === "unknown" ? undefined : entities.paymentMode,
    lines: invoiceLines,
    narration: `SUTRA AI: ${understoodInput}`,
  };
}

export class ActionExecutor {
  resolve(
    intent: IntentType | undefined,
    entities: ExtractedEntities | undefined,
    understoodInput: string,
    needsClarification: boolean,
  ): SutraAiAction[] {
    if (needsClarification || !entities) return [];
    if (entities.partyAmbiguous?.length) return [];

    const khata = this.resolveKhata(entities, understoodInput);
    if (khata) return [khata];

    const tab = tabForIntent(intent ?? "OTHER", entities.transactionType, understoodInput);
    if (!tab) return [];

    const isExpense = entities.transactionType === "expense";
    if (isExpense) return [];

    const hasProduct = Boolean(
      entities.product || entities.productEnglish || (entities.lines?.length ?? 0) >= 2,
    );
    const hasAmount = entities.amount != null && entities.amount > 0;

    if (!hasProduct || !hasAmount) return [];

    const draft = buildDraft(tab, entities, understoodInput);
    const isSales = tab === "sales" || tab === "sales-return";
    const isReturn = tab === "sales-return" || tab === "purchase-return";

    return [
      {
        id: actionId(),
        type: "prefill_invoice",
        page: pageForTab(tab),
        invoiceType: tab,
        draft,
        label: isReturn
          ? "Create Return"
          : isSales
            ? "Create Sales Invoice"
            : "Create Purchase Invoice",
        labelNepali: isReturn
          ? "फिर्ता बिल बनाउनुहोस्"
          : isSales
            ? "बिक्री बिल बनाउनुहोस्"
            : "खरिद बिल बनाउनुहोस्",
      },
    ];
  }

  resolveKhata(entities: ExtractedEntities, understoodInput: string): SutraAiAction | null {
    const draft = buildAiKhataDraft(entities, understoodInput);
    if (!draft) return null;

    const isReceipt = draft.intent === "khata_payment_in";
    const isPayment = draft.intent === "khata_payment_out";

    const isExpense = draft.intent === "khata_expense";

    return {
      id: actionId(),
      type: "prefill_khata",
      page: "ekhata",
      khataDraft: draft,
      label: isExpense
        ? "Record Expense"
        : isReceipt
          ? "Record Receipt"
          : isPayment
            ? "Record Payment"
            : "Record in Khata",
      labelNepali: isExpense
        ? "खर्च रेकर्ड गर्नुहोस्"
        : isReceipt
          ? "प्राप्ति रेकर्ड गर्नुहोस्"
          : isPayment
            ? "भुक्तानी रेकर्ड गर्नुहोस्"
            : "खातामा रेकर्ड गर्नुहोस्",
    };
  }

  resolveReport(intent: IntentType | undefined): SutraAiAction | null {
    if (intent !== "REPORT_REQUEST") return null;
    return {
      id: actionId(),
      type: "navigate",
      page: "reports",
      label: "Open Reports",
      labelNepali: "रिपोर्ट हेर्नुहोस्",
    };
  }
}

export const actionExecutor = new ActionExecutor();
