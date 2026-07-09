/** SUTRA AI — set / update party phone via Party Master prefill */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
  SutraAiAction,
} from "../types";
import { erpRagRetriever } from "./ErpRagRetriever";
import { normalizeWhatsAppPhone } from "../context/PartyPhoneResolver";

const EDIT_PATTERNS = [
  /^\/setphone\s+(\S+)\s+(\d[\d\s-]{8,14})/i,
  /\b([a-z\u0900-\u097F]{2,24})\s+(ko|lai)\s+(phone|mobile)\s+(\d[\d\s-]{8,14})/i,
  /\b([a-z\u0900-\u097F]{2,24})\s+(ko|lai)\s+(\d[\d\s-]{8,14})\s+(phone|mobile)\s+(thap|update|rakh|save)/i,
  /फोन\s+(थप|अपडेट|राख)/,
];

function extractPhone(text: string): string | null {
  const digits = text.match(/\b(97[0-9]{8}|98[0-9]{8}|9[78][0-9]{9})\b/);
  if (digits) return digits[1].replace(/\D/g, "");

  const loose = text.match(/(\d[\d\s-]{8,14})/);
  if (!loose) return null;
  const cleaned = loose[1].replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned.slice(-10) : null;
}

function extractParty(text: string, entities: ExtractedEntities): string | null {
  const slash = text.match(/^\/setphone\s+(\S+)/i);
  if (slash) return slash[1].trim();

  if (entities.partyResolvedName) return entities.partyResolvedName;
  if (entities.party) return entities.party;

  const ko = text.match(/\b([a-z\u0900-\u097F]{2,24})\s+(ko|lai)\s+(?:phone|mobile|\d)/i);
  if (ko) return ko[1];

  return null;
}

export class PartyPhoneEditHandler {
  isPhoneEdit(text: string): boolean {
    if (EDIT_PATTERNS.some((re) => re.test(text))) return true;
    return (
      /\b(phone|mobile)\s+(thap|update|rakh|save)\b/i.test(text) &&
      /\d{10}/.test(text.replace(/\s/g, ""))
    );
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    _intent: IntentClassification | undefined,
    _outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isPhoneEdit(text)) return null;

    const phoneRaw = extractPhone(text);
    if (!phoneRaw) return null;

    const query = extractParty(text, entities);
    if (!query || !ctx?.parties?.length) return null;

    const hit = erpRagRetriever.findParties(query, ctx.parties, 1)[0];
    if (!hit || hit.score < 0.55) return null;

    const party = hit.ref;
    const display = phoneRaw;
    const action: SutraAiAction = {
      id: `setph-${Date.now().toString(36)}`,
      type: "prefill_party",
      page: "parties",
      partyDraft: {
        partyId: party.id,
        partyName: party.name,
        phone: display,
        focusPhone: true,
      },
      label: "Edit Party Phone",
      labelNepali: "फोन सम्पादन",
    };

    return {
      understood_input: understoodInput,
      confidence: 0.91,
      needs_clarification: false,
      suggestions: [],
      response: {
        nepali: `${party.name} को फोन ${display} राख्न Party Master खुल्दैछ।`,
        english: `Opening Party Master to set ${party.name}'s phone to ${display}.`,
        roman: `${party.name} ko phone ${display} rakhna party master khuldai chu.`,
      },
      sourceLanguage: "roman",
      partyPhone: normalizeWhatsAppPhone(display),
      actions: [action],
    };
  }
}

export const partyPhoneEditHandler = new PartyPhoneEditHandler();
