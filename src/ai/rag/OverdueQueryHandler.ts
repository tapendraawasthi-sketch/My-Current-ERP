/** SUTRA AI — overdue receivable queries and reminders */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { overdueReceivableEngine } from "../intelligence/OverdueReceivableEngine";
import { parseOverduePartyFilter, filterPartiesByKind } from "../context/PartyTypeFilter";

const OVERDUE_PATTERNS = [
  /^\/overdue\b/i,
  /\b(overdue|purano\s+udhaar|dhila|late\s+payment|purano\s+baki)\b/i,
  /\b(kati\s+din\s+bhayo|kati\s+din\s+delay)\b.*\b(udhaar|baki|receivable)\b/i,
  /\breminder\b.*\b(party|udhaar|receivable)\b/i,
  /ढिला\s*भएको|पुरानो\s*उधार|बाँकी\s*सम्झाउ/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export class OverdueQueryHandler {
  isOverdueQuery(text: string, intent?: IntentClassification): boolean {
    if (OVERDUE_PATTERNS.some((re) => re.test(text))) return true;
    if (
      intent?.intent === "QUERY" &&
      /\b(overdue|purano|dhila|reminder)\b/i.test(text) &&
      /\b(udhaar|receivable|baki|party)\b/i.test(text)
    ) {
      return true;
    }
    return false;
  }

  tryBuildResponse(
    text: string,
    _entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isOverdueQuery(text, intent)) return null;

    const partyFilter = parseOverduePartyFilter(text);
    const supplierPayables = partyFilter === "supplier";

    const scopedCtx: ErpRagContext | undefined =
      ctx && partyFilter !== "all"
        ? { ...ctx, parties: filterPartiesByKind(ctx.parties ?? [], partyFilter) }
        : ctx;

    const rows = supplierPayables
      ? overdueReceivableEngine.scanPayables(scopedCtx, undefined, true)
      : overdueReceivableEngine.scan(scopedCtx);
    const total = overdueReceivableEngine.totalOverdue(rows);

    if (!rows.length) {
      return {
        understood_input: understoodInput,
        confidence: 0.88,
        needs_clarification: false,
        suggestions: [],
        response: {
          nepali: supplierPayables
            ? "कुनै ढिला supplier payable छैन।"
            : "कुनै ढिला भएको लिनु बाँकी छैन।",
          english: supplierPayables ? "No overdue supplier payables." : "No overdue receivables.",
          roman: supplierPayables ? "Kunai dhila supplier payable chaina." : "Kunai dhila udhaar chaina.",
        },
        sourceLanguage: "roman",
      };
    }

    const label = supplierPayables ? "ढिला supplier payable" : "ढिला लिनु बाँकी";
    const labelEn = supplierPayables ? "Overdue supplier payables" : "Overdue receivables";

    const lines = rows.slice(0, 8).map(
      (r) => `${r.name}: ${formatAmount(r.balance)} (${r.daysOverdue} दिन ढिला)`,
    );
    const enLines = rows.slice(0, 8).map(
      (r) => `${r.name}: ${formatAmount(r.balance)} (${r.daysOverdue}d overdue)`,
    );

    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: {
        nepali:
          `${label} (कुल ${formatAmount(total)}, ${rows.length} पार्टी):\n` +
          lines.join("\n"),
        english:
          `${labelEn} (total ${formatAmount(total)}, ${rows.length} parties):\n` +
          enLines.join("\n"),
        roman:
          `${labelEn} (total ${formatAmount(total)}):\n` +
          enLines.join("\n"),
      },
      sourceLanguage: "roman",
      actions: [
        {
          id: `od-${Date.now().toString(36)}`,
          type: "navigate",
          page: "aging-report",
          agingDirection: supplierPayables ? "payable" : "receivable",
          agingSearchTerm: rows[0]?.name,
          label: supplierPayables ? "Payables Aging" : "Debtors Aging",
          labelNepali: supplierPayables ? "लेनदार Aging" : "देनदार Aging",
        },
      ],
      quickReplies: rows.slice(0, 2).map((r, i) => ({
        id: `od-${i}`,
        label: `${r.name} reminder`,
        value: `${r.name} lai udhaar reminder pathau`,
        kind: "query" as const,
      })),
    };
  }
}

export const overdueQueryHandler = new OverdueQueryHandler();
