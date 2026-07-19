/** SUTRA AI — party phone lookup for WhatsApp / contact */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { buildSetPhoneHandoffQuery } from "../actions/chatQueryDraft";
import { normalizeWhatsAppPhone, phoneFromPartyRef } from "../context/PartyPhoneResolver";
import { agingWaButtonLabel } from "../intelligence/DigestPinPreference";
import { resolveUniqueParty } from "./mai08MasterResolve";

const PHONE_PATTERNS = [
  /^\/phone\s+(.+)/i,
  /\b([a-z\u0900-\u097F]{2,20})\s+ko\s+(phone|mobile|number|contact)\b/i,
  /\b(phone|mobile|number)\s+(kati|cha|k ho)\b.*\b([a-z\u0900-\u097F]{2,20})\b/i,
  /फोन|मोबाइल|नम्बर/,
];

function extractParty(text: string, entities: ExtractedEntities): string | null {
  const slash = text.match(/^\/phone\s+(.+)/i);
  if (slash) return slash[1].trim();

  if (entities.partyResolvedName) return entities.partyResolvedName;
  if (entities.party) return entities.party;

  const ko = text.match(/\b([a-z\u0900-\u097F]{2,20})\s+ko\s+(phone|mobile|number)\b/i);
  if (ko) return ko[1];

  const rev = text.match(/\b(phone|mobile)\s+.*\b([a-z\u0900-\u097F]{2,20})\b/i);
  if (rev) return rev[2];

  return null;
}

export class PartyPhoneQueryHandler {
  isPhoneQuery(text: string, intent?: IntentClassification): boolean {
    if (/^\/setphone\b/i.test(text)) return false;
    if (/\b(thap|update|rakh|save)\b/i.test(text) && /\d{8,}/.test(text.replace(/\s/g, ""))) {
      return false;
    }
    if (PHONE_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "QUERY" && /\b(phone|mobile|contact|number)\b/i.test(text)) {
      return true;
    }
    return false;
  }

  tryBuildResponse(
    text: string,
    entities: ExtractedEntities,
    ctx: ErpRagContext | undefined,
    intent: IntentClassification | undefined,
    outputLanguage: LanguageCode,
    understoodInput: string,
  ): AIResponse | null {
    if (!this.isPhoneQuery(text, intent)) return null;

    const query = extractParty(text, entities);
    if (!query || !ctx?.parties?.length) return null;

    const resolved = resolveUniqueParty(query, ctx.parties);
    if (resolved.status !== "bound") return null;

    const party = resolved.hit.ref;
    const phone = phoneFromPartyRef(party);
    const display = party.phone ?? "—";

    if (!phone) {
      const setPhoneLabel = agingWaButtonLabel(false, outputLanguage);
      return {
        understood_input: understoodInput,
        confidence: 0.82,
        needs_clarification: false,
        suggestions: [],
        response: {
          nepali: `${party.name} को फोन ERP मा छैन। Party Master मा थप्नुहोस् वा /setphone प्रयोग गर्नुहोस्।`,
          english: `${party.name} has no phone in ERP. Add in Party Master or use /setphone.`,
          roman: `${party.name} ko phone chaina. Party master ma thapnuhos wa /setphone.`,
        },
        sourceLanguage: "roman",
        actions: [
          {
            id: `ph-${Date.now().toString(36)}`,
            type: "prefill_party",
            page: "parties",
            partyDraft: {
              partyId: party.id,
              partyName: party.name,
              focusPhone: true,
            },
            label: "Add Phone",
            labelNepali: "फोन थप्नुहोस्",
          },
        ],
        quickReplies: [
          {
            id: "ph-setphone",
            label: setPhoneLabel,
            value: buildSetPhoneHandoffQuery(party.name),
            kind: "query",
          },
        ],
      };
    }

    const wa = normalizeWhatsAppPhone(party.phone);
    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: {
        nepali: `${party.name} को फोन: ${display}`,
        english: `${party.name} phone: ${display}`,
        roman: `${party.name} ko phone: ${display}`,
      },
      sourceLanguage: "roman",
      partyPhone: wa,
      shareText: `${party.name} — ${display}`,
      quickReplies: [
        {
          id: "ph-rem",
          label: "Reminder",
          value: `${party.name} lai udhaar reminder pathau`,
          kind: "query",
        },
      ],
    };
  }
}

export const partyPhoneQueryHandler = new PartyPhoneQueryHandler();
