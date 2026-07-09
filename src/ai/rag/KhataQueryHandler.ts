/** SUTRA AI — recent khata voucher queries from Dexie RAG */

import type {
  AIResponse,
  ErpKhataEntry,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { dateResolver } from "../context/DateResolver";

const KHATA_PATTERNS = [
  /\bhijo\s+ko\b/i,
  /\baaja\s+ko\b/i,
  /\brecent\s+(entry|transaction|voucher)\b/i,
  /\blast\s+(entry|transaction|voucher)\b/i,
  /\bkhata\s+(entry|voucher)\b/i,
  /हिजो\s*को|आज\s*को|पछिल्लो\s*लेनदेन/,
];

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

function formatEntryLine(e: ErpKhataEntry): string {
  const party = e.party ? ` · ${e.party}` : "";
  return `${e.date}: ${formatAmount(e.amount)}${party}`;
}

export interface KhataQueryResult {
  entries: ErpKhataEntry[];
  nepali: string;
  english: string;
  roman: string;
}

export class KhataQueryHandler {
  isKhataQuery(text: string, intent?: IntentClassification): boolean {
    if (KHATA_PATTERNS.some((re) => re.test(text))) return true;
    if (
      intent?.intent === "QUERY" &&
      /\b(hijo|aaja|recent|last|khata|entry|voucher)\b/i.test(text)
    ) {
      return true;
    }
    return false;
  }

  resolve(
    text: string,
    entities: ExtractedEntities,
    ctx?: ErpRagContext,
  ): KhataQueryResult | null {
    const entries = ctx?.recentKhata ?? [];
    if (!entries.length) return null;

    let filtered = entries;
    const partyQ = (entities.party ?? entities.partyResolvedName)?.toLowerCase();
    if (partyQ) {
      filtered = entries.filter((e) => e.party?.toLowerCase().includes(partyQ));
    }

    const dateIso =
      entities.resolvedDate ?? dateResolver.detect(text, entities.dateRef)?.iso;
    if (dateIso) {
      filtered = filtered.filter((e) => e.date === dateIso);
    }

    if (!filtered.length) filtered = entries;

    const top = filtered.slice(0, 5);
    const lines = top.map(formatEntryLine);

    const nepali =
      top.length === 1
        ? `पछिल्लो खाता प्रविष्टि:\n${lines[0]}`
        : `पछिल्लो ${top.length} खाता प्रविष्टिहरू:\n${lines.join("\n")}`;

    const english =
      top.length === 1
        ? `Latest khata entry:\n${lines[0]}`
        : `Last ${top.length} khata entries:\n${lines.join("\n")}`;

    const roman =
      top.length === 1
        ? `Pachillo khata entry:\n${lines[0]}`
        : `Pachillo ${top.length} khata entries:\n${lines.join("\n")}`;

    return { entries: top, nepali, english, roman };
  }

  toAIResponse(
    result: KhataQueryResult,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse {
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
      followUp: undefined,
      actions: [
        {
          id: `kht-${Date.now().toString(36)}`,
          type: "navigate",
          page: "ledger",
          label: "View Khata",
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
    if (!this.isKhataQuery(text, intent)) return null;
    const result = this.resolve(text, entities, ctx);
    if (!result) return null;
    return this.toAIResponse(result, outputLanguage, understoodInput);
  }
}

export const khataQueryHandler = new KhataQueryHandler();
