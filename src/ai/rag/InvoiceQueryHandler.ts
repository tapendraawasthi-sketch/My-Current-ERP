/** SUTRA AI — recent invoice queries from ERP RAG */

import type {
  AIResponse,
  ErpInvoiceRef,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { formatInvoiceListShare } from "../conversation/InvoiceShareFormatter";

const INVOICE_PATTERNS = [
  /\b(last|recent|pachillo)\s+(invoice|bill)\b/i,
  /\b(hijo|aaja)\s+ko\s+(bill|invoice|bikri)\b/i,
  /\bko\s+last\s+bill\b/i,
  /\bbill\s+dekhaunu\b/i,
  /पछिल्लो\s*बिल|बिल\s*देखाउनु|हिजो\s*को\s*बिल/,
];

const INVOICE_SHARE_PATTERNS = [
  /^\/share\s+invoice\b/i,
  /\b(share|pathau|whatsapp)\b.*\b(invoice|bill|bikri)\b/i,
  /\b(bill|invoice)\b.*\b(share|pathau|whatsapp)\b/i,
  /बिल\s*शेयर|बिल\s*पठाउ/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

function formatInvoiceLine(inv: ErpInvoiceRef): string {
  const party = inv.partyName ? ` · ${inv.partyName}` : "";
  return `${inv.date} ${inv.invoiceNo}: ${formatAmount(inv.grandTotal)}${party}`;
}

export interface InvoiceQueryResult {
  invoices: ErpInvoiceRef[];
  nepali: string;
  english: string;
  roman: string;
}

export class InvoiceQueryHandler {
  isInvoiceQuery(text: string, intent?: IntentClassification): boolean {
    if (INVOICE_SHARE_PATTERNS.some((re) => re.test(text))) return true;
    if (INVOICE_PATTERNS.some((re) => re.test(text))) return true;
    if (
      intent?.intent === "QUERY" &&
      /\b(invoice|bill|bikri)\b/i.test(text) &&
      /\b(last|recent|hijo|aaja|dekha)\b/i.test(text)
    ) {
      return true;
    }
    return false;
  }

  resolve(
    text: string,
    entities: ExtractedEntities,
    ctx?: ErpRagContext,
  ): InvoiceQueryResult | null {
    const invoices = ctx?.recentInvoices ?? [];
    if (!invoices.length) return null;

    let filtered = [...invoices];
    const partyQ = entities.party ?? entities.partyResolvedName;
    if (partyQ) {
      const hits = erpRagRetriever.findParties(partyQ, ctx?.parties ?? [], 1);
      const name = hits[0]?.ref.name ?? partyQ;
      filtered = invoices.filter((i) =>
        i.partyName?.toLowerCase().includes(name.toLowerCase()),
      );
    }

    if (/\bhijo\b/i.test(text)) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      filtered = filtered.filter((i) => i.date === yStr);
    } else if (/\baaja\b/i.test(text)) {
      const today = new Date().toISOString().slice(0, 10);
      filtered = filtered.filter((i) => i.date === today);
    }

    if (!filtered.length) filtered = invoices.slice(0, 1);
    const top = filtered.slice(0, 3);
    const lines = top.map(formatInvoiceLine);

    const nepali =
      top.length === 1
        ? `पछिल्लो बिल:\n${lines[0]}`
        : `पछिल्लो ${top.length} बिलहरू:\n${lines.join("\n")}`;

    const english =
      top.length === 1
        ? `Latest invoice:\n${lines[0]}`
        : `Last ${top.length} invoices:\n${lines.join("\n")}`;

    const roman =
      top.length === 1
        ? `Pachillo bill:\n${lines[0]}`
        : `Pachillo ${top.length} bills:\n${lines.join("\n")}`;

    return { invoices: top, nepali, english, roman };
  }

  isInvoiceShareQuery(text: string): boolean {
    return INVOICE_SHARE_PATTERNS.some((re) => re.test(text));
  }

  toAIResponse(
    result: InvoiceQueryResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
    shareMode = false,
  ): AIResponse {
    const shareText = shareMode
      ? formatInvoiceListShare(result.invoices, outputLanguage)
      : undefined;

    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: {
        english: result.english,
        nepali: result.nepali,
        roman: result.roman,
      },
      sourceLanguage: "roman",
      shareText,
      quickReplies: shareText
        ? [{ id: "inv-wa", label: "WhatsApp", value: "/share invoice", kind: "query" }]
        : undefined,
      actions: [
        {
          id: `inv-${Date.now().toString(36)}`,
          type: "navigate",
          page: "sales-invoice",
          label: "View Invoices",
          labelNepali: "बिल हेर्नुहोस्",
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
    if (!this.isInvoiceQuery(text, intent)) return null;
    const result = this.resolve(text, entities, ctx);
    if (!result) return null;
    return this.toAIResponse(
      result,
      outputLanguage,
      understoodInput,
      this.isInvoiceShareQuery(text),
    );
  }
}

export const invoiceQueryHandler = new InvoiceQueryHandler();
