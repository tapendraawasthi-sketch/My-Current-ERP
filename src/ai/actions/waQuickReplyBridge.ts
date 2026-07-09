/** SUTRA AI — one-tap WhatsApp quick-reply encode/decode */

import type { LanguageCode } from "../types";

export const WA_OPEN_PREFIX = "__wa_open__:";

export interface WaOpenPayload {
  text: string;
  phone?: string;
  partyName?: string;
}

export function encodeWaOpenValue(payload: WaOpenPayload): string {
  return `${WA_OPEN_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

export function decodeWaOpenValue(value: string): WaOpenPayload | null {
  if (!value.startsWith(WA_OPEN_PREFIX)) return null;
  const raw = value.slice(WA_OPEN_PREFIX.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as WaOpenPayload;
    if (parsed?.text) return parsed;
  } catch {
    try {
      const text = decodeURIComponent(raw);
      if (text) return { text };
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function formatWaOpenConfirmation(
  partyName: string | undefined,
  lang: LanguageCode,
): string {
  const name = partyName ?? "party";
  if (lang === "english") return `WhatsApp opened for ${name}.`;
  if (lang === "roman") return `${name} lai WhatsApp khulyo.`;
  return `${name} लाई WhatsApp खोलियो।`;
}

export const COPY_TEXT_PREFIX = "__copy__:";

export interface CopyTextPayload {
  text: string;
  partyName?: string;
}

export function encodeCopyValue(payload: CopyTextPayload): string {
  return `${COPY_TEXT_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

export function decodeCopyValue(value: string): CopyTextPayload | null {
  if (!value.startsWith(COPY_TEXT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value.slice(COPY_TEXT_PREFIX.length)),
    ) as CopyTextPayload;
    if (parsed?.text) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function formatCopyConfirmation(
  partyName: string | undefined,
  lang: LanguageCode,
  copied: boolean,
): string {
  const name = partyName ?? "reminder";
  if (!copied) {
    if (lang === "english") return "Copy failed. Please try again.";
    if (lang === "roman") return "Copy fail bhayo. Feri try garnuhos.";
    return "कपी असफल। फेरि प्रयास गर्नुहोस्।";
  }
  if (lang === "english") return `Reminder copied for ${name}.`;
  if (lang === "roman") return `${name} ko reminder clipboard ma copy bhayo.`;
  return `${name} को सम्झना कपी भयो।`;
}
