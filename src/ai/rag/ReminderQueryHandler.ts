/** SUTRA AI — party balance / overdue reminder messages */

import type {
  AIResponse,
  ErpRagContext,
  ExtractedEntities,
  IntentClassification,
  LanguageCode,
} from "../types";
import { phoneFromPartyRef } from "../context/PartyPhoneResolver";
import { resolveUniqueParty } from "./mai08MasterResolve";
import { overdueReceivableEngine } from "../intelligence/OverdueReceivableEngine";
import {
  formatPayableReminder,
  formatReceivableReminder,
} from "../conversation/WhatsAppShareFormatter";
import { encodeWaOpenValue, encodeCopyValue } from "../actions/waQuickReplyBridge";
import { isSupplierParty } from "../context/PartyTypeFilter";

function stripReminderPartyQuery(raw: string): string {
  return raw
    .replace(/\s+\d{1,3}\s+days?(\s+overdue)?\b/gi, "")
    .replace(/\s+payable\s+\d{1,3}\s+days?\b/gi, "")
    .replace(/^supplier\s+/i, "")
    .trim();
}

function parseDaysOverdueFromText(text: string): number | undefined {
  const m = text.match(/\b(\d{1,3})\s+days?\b/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : undefined;
}

const REMINDER_PATTERNS = [
  /^\/reminder\s+(.+)/i,
  /\breminder\s+(pathau|patahau|send|patha)\b/i,
  /\b(udhaar|balance|baki|payable|payment)\s+reminder\b/i,
  /\b(lai|ko)\s+.*\breminder\b/i,
  /सम्झना\s*पठाउ|रिमाइन्डर/,
];

function extractParty(text: string, entities: ExtractedEntities): string | null {
  const slash = text.match(/^\/reminder\s+(.+)/i);
  if (slash) return stripReminderPartyQuery(slash[1]);

  if (entities.partyResolvedName) return entities.partyResolvedName;
  if (entities.party) return entities.party;

  const ko = text.match(/\b([a-z\u0900-\u097F]{2,24})\s+(lai|ko)\s+.*\breminder\b/i);
  if (ko) return ko[1];

  const m2 = text.match(/\breminder\s+(pathau|patahau)\s+([a-z\u0900-\u097F]{2,24})\b/i);
  if (m2) return m2[2];

  return null;
}

function isPayableReminder(text: string, partyType?: string): boolean {
  if (/\b(supplier|payable|payment|lene|tirnu|creditor)\b/i.test(text)) return true;
  return isSupplierParty({ id: "", name: "", type: partyType });
}

export class ReminderQueryHandler {
  isReminderQuery(text: string, intent?: IntentClassification): boolean {
    if (REMINDER_PATTERNS.some((re) => re.test(text))) return true;
    if (intent?.intent === "QUERY" && /\breminder\b/i.test(text)) return true;
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
    if (!this.isReminderQuery(text, intent)) return null;

    const partyQuery = extractParty(text, entities);
    if (!partyQuery || !ctx?.parties?.length) return null;

    const resolved = resolveUniqueParty(partyQuery, ctx.parties);
    if (resolved.status !== "bound") return null;

    const party = resolved.hit.ref;
    const balance = party.balance ?? 0;
    const payable = isPayableReminder(text, party.type) || balance < 0;
    const amount = Math.abs(balance);

    if (amount <= 0) {
      return {
        understood_input: understoodInput,
        confidence: 0.85,
        needs_clarification: false,
        suggestions: [],
        response: {
          nepali: payable
            ? `${party.name} लाई तिर्न बाँकी छैन।`
            : `${party.name} बाट लिन बाँकी छैन।`,
          english: payable
            ? `No payable to ${party.name}.`
            : `No receivable from ${party.name}.`,
          roman: payable
            ? `${party.name} lai tirnu baki chaina.`
            : `${party.name} bata lin baki chaina.`,
        },
        sourceLanguage: "roman",
      };
    }

    const overdueRecv = overdueReceivableEngine.scan(ctx).find((r) => r.partyId === party.id);
    const overduePay = overdueReceivableEngine
      .scanPayables(ctx)
      .find((r) => r.partyId === party.id);
    const explicitDays = parseDaysOverdueFromText(text);
    const daysOverdue =
      explicitDays ?? (payable ? overduePay?.daysOverdue : overdueRecv?.daysOverdue);

    const formatReminder = payable ? formatPayableReminder : formatReceivableReminder;
    const shareText = formatReminder(party.name, amount, outputLanguage, { daysOverdue });

    const nepali =
      `${party.name} लाई सम्झना सन्देश तयार भयो:\n\n` +
      formatReminder(party.name, amount, "nepali", { daysOverdue });
    const english = `Reminder ready for ${party.name}:\n\n${shareText}`;
    const roman =
      `${party.name} lai reminder:\n\n` +
      formatReminder(party.name, amount, "roman", { daysOverdue });

    const partyPhone = phoneFromPartyRef(party);

    const quickReplies = partyPhone
      ? [
          {
            id: "rem-wa",
            label: "WhatsApp",
            value: encodeWaOpenValue({
              text: shareText,
              phone: partyPhone,
              partyName: party.name,
            }),
            kind: "whatsapp" as const,
          },
          {
            id: "rem-copy",
            label: "Copy",
            value: encodeCopyValue({ text: shareText, partyName: party.name }),
            kind: "copy" as const,
          },
        ]
      : [
          {
            id: "rem-copy",
            label: "Copy",
            value: encodeCopyValue({ text: shareText, partyName: party.name }),
            kind: "copy" as const,
          },
        ];

    return {
      understood_input: understoodInput,
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: { nepali, english, roman },
      sourceLanguage: "roman",
      shareText,
      partyPhone,
      quickReplies,
    };
  }
}

export const reminderQueryHandler = new ReminderQueryHandler();
