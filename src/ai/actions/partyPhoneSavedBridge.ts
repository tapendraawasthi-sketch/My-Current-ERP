/** SUTRA AI — notify chat after party phone saved from AI prefill */

import type { LanguageCode } from "../types";
import {
  peekAgingSetphoneReturnDraft,
  encodeAgingReturnQuickReplyValue,
  formatAgingReturnQuickReplyLabel,
} from "./chatQueryDraft";
import { formatReceivableReminder, formatPayableReminder } from "../conversation/WhatsAppShareFormatter";
import { normalizeWhatsAppPhone } from "../context/PartyPhoneResolver";

export interface PartyPhoneSavedNotice {
  partyName: string;
  phone: string;
  savedAt: number;
  balance?: number;
}

const KEY = "sutra:party-phone-saved-notice";
export const PHONE_SAVED_WA_PREFIX = "__sutra_wa__:";
export const PHONE_SAVED_COPY_PREFIX = "__sutra_phone_copy__:";

export function queuePartyPhoneSavedNotice(
  partyName: string,
  phone: string,
  balance?: number,
): void {
  try {
    const payload: PartyPhoneSavedNotice = {
      partyName,
      phone,
      savedAt: Date.now(),
      balance: balance && balance > 0 ? balance : undefined,
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumePartyPhoneSavedNotice(): PartyPhoneSavedNotice | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as PartyPhoneSavedNotice;
    if (!parsed.partyName || !parsed.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function encodePhoneSavedWaValue(notice: PartyPhoneSavedNotice): string {
  return `${PHONE_SAVED_WA_PREFIX}${encodeURIComponent(JSON.stringify(notice))}`;
}

export function decodePhoneSavedWaValue(value: string): PartyPhoneSavedNotice | null {
  if (!value.startsWith(PHONE_SAVED_WA_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value.slice(PHONE_SAVED_WA_PREFIX.length)),
    ) as PartyPhoneSavedNotice;
    if (!parsed.partyName || !parsed.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildPhoneSavedReminderShare(
  notice: PartyPhoneSavedNotice,
  lang: LanguageCode,
): string {
  const agingReturn = peekAgingSetphoneReturnDraft();
  const amount =
    notice.balance != null && notice.balance > 0
      ? notice.balance
      : agingReturn?.outstanding;
  const overdueOpts =
    agingReturn?.daysOverdue && agingReturn.daysOverdue > 0
      ? { daysOverdue: agingReturn.daysOverdue }
      : undefined;

  if (amount != null && amount > 0) {
    if (agingReturn?.direction === "payable") {
      return formatPayableReminder(notice.partyName, amount, lang, overdueOpts);
    }
    return formatReceivableReminder(notice.partyName, amount, lang, overdueOpts);
  }

  if (lang === "english") {
    return (
      `Dear ${notice.partyName},\n` +
      `This is a friendly reminder. Please settle your outstanding balance at your earliest convenience. Thank you.`
    );
  }
  if (lang === "roman") {
    return (
      `Namaste ${notice.partyName},\n` +
      `Yo reminder ho — kripaya udhaar baki chittai milau. Dhanyabad.`
    );
  }
  return (
    `नमस्ते ${notice.partyName},\n` +
    `यो सम्झना हो — कृपया उधार बाँकी चाँडै मिलाइदिनुहोला। धन्यवाद।`
  );
}

export function formatPartyPhoneSavedMessage(
  notice: PartyPhoneSavedNotice,
  lang: LanguageCode = "nepali",
): string {
  const aging = peekAgingSetphoneReturnDraft();
  const amount = notice.balance ?? aging?.outstanding;
  const overdueNote =
    aging?.daysOverdue && aging.daysOverdue > 0 ? ` (${aging.daysOverdue}d overdue)` : "";
  const balanceNote =
    amount != null && amount > 0
      ? lang === "nepali"
        ? ` बाँकी Rs. ${amount.toLocaleString("en-NP")}${overdueNote}।`
        : lang === "roman"
          ? ` baki Rs. ${amount.toLocaleString("en-NP")}${overdueNote}.`
          : ` Outstanding Rs. ${amount.toLocaleString("en-NP")}${overdueNote}.`
      : "";

  if (lang === "english") {
    return `${notice.partyName}'s phone ${notice.phone} saved.${balanceNote} Tap **Send now** for one-tap WhatsApp reminder.`;
  }
  if (lang === "roman") {
    return `${notice.partyName} ko phone ${notice.phone} save bhayo.${balanceNote} **Send now** thichera WhatsApp reminder pathauna sakinchha.`;
  }
  return `${notice.partyName} को फोन ${notice.phone} save भयो।${balanceNote} **Send now** थिचेर WhatsApp reminder पठाउन सकिन्छ।`;
}

export function buildPhoneSavedReminderQuery(notice: PartyPhoneSavedNotice): string {
  const aging = peekAgingSetphoneReturnDraft();
  const days =
    aging?.daysOverdue && aging.daysOverdue > 0 ? ` ${aging.daysOverdue} days overdue` : "";
  if (aging?.direction === "payable") {
    return `/reminder supplier ${notice.partyName}${days}`;
  }
  return `/reminder ${notice.partyName}${days}`;
}

export function encodePhoneSavedCopyValue(notice: PartyPhoneSavedNotice): string {
  return `${PHONE_SAVED_COPY_PREFIX}${encodeURIComponent(JSON.stringify(notice))}`;
}

export function decodePhoneSavedCopyValue(value: string): PartyPhoneSavedNotice | null {
  if (!value.startsWith(PHONE_SAVED_COPY_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value.slice(PHONE_SAVED_COPY_PREFIX.length)),
    ) as PartyPhoneSavedNotice;
    if (!parsed.partyName || !parsed.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tryHandlePhoneSavedCopyQuickReply(
  value: string,
  lang: LanguageCode,
): { text: string; partyName: string } | null {
  const notice = decodePhoneSavedCopyValue(value);
  if (!notice) return null;
  return {
    text: buildPhoneSavedReminderShare(notice, lang),
    partyName: notice.partyName,
  };
}

export function tryHandlePhoneSavedWaQuickReply(
  value: string,
  lang: LanguageCode,
): { shareText: string; phone: string; partyName: string; confirmText: string } | null {
  const notice = decodePhoneSavedWaValue(value);
  if (!notice) return null;
  return {
    shareText: buildPhoneSavedReminderShare(notice, lang),
    phone: normalizeWhatsAppPhone(notice.phone) ?? notice.phone,
    partyName: notice.partyName,
    confirmText: formatWhatsAppSentConfirmation(notice.partyName, lang),
  };
}

export function getPhoneSavedQuickReplyLabels(lang: LanguageCode): {
  send: string;
  copy: string;
  reminder: string;
  balance: string;
} {
  if (lang === "english") {
    return { send: "Send now", copy: "Copy", reminder: "Reminder", balance: "Balance" };
  }
  if (lang === "roman") {
    return {
      send: "Ahile pathau",
      copy: "Copy garau",
      reminder: "Samjhana",
      balance: "Baki herau",
    };
  }
  return { send: "अहिले पठाउ", copy: "कपी", reminder: "सम्झना", balance: "ब्यालेन्स" };
}

export function buildPhoneSavedQuickReplies(
  notice: PartyPhoneSavedNotice,
  lang: LanguageCode = "nepali",
) {
  const labels = getPhoneSavedQuickReplyLabels(lang);
  const replies = [
    {
      id: "ph-saved-wa",
      label: labels.send,
      value: encodePhoneSavedWaValue(notice),
      kind: "confirm" as const,
    },
    {
      id: "ph-saved-copy",
      label: labels.copy,
      value: encodePhoneSavedCopyValue(notice),
      kind: "copy" as const,
    },
    {
      id: "ph-saved-rem",
      label: labels.reminder,
      value: buildPhoneSavedReminderQuery(notice),
      kind: "query" as const,
    },
    {
      id: "ph-saved-bal",
      label: labels.balance,
      value: `${notice.partyName} ko balance kati`,
      kind: "query" as const,
    },
  ];

  const agingReturn = peekAgingSetphoneReturnDraft();
  if (
    agingReturn &&
    agingReturn.searchTerm.trim().toLowerCase() === notice.partyName.trim().toLowerCase()
  ) {
    replies.push({
      id: "ph-saved-aging",
      label: formatAgingReturnQuickReplyLabel(lang),
      value: encodeAgingReturnQuickReplyValue(agingReturn),
      kind: "confirm" as const,
    });
  }

  return replies;
}

export function formatWhatsAppSentConfirmation(
  partyName: string,
  lang: LanguageCode = "nepali",
): string {
  if (lang === "english") return `WhatsApp reminder sent to ${partyName}.`;
  if (lang === "roman") return `WhatsApp ma ${partyName} lai reminder pathaisakiyo.`;
  return `WhatsApp reminder ${partyName} लाई पठाइसकियो।`;
}
