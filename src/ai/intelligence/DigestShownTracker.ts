/** SUTRA AI — show proactive digest at most once per calendar day (with hour snooze) */

import type { LanguageCode } from "../types";

const STORAGE_KEY = "sutra:digest-shown-date";
const SNOOZE_UNTIL_KEY = "sutra:digest-snooze-until";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isSnoozeActive(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_UNTIL_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (Number.isFinite(until) && Date.now() < until) return true;
    localStorage.removeItem(SNOOZE_UNTIL_KEY);
    return false;
  } catch {
    return false;
  }
}

export function wasDigestShownToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayKey();
  } catch {
    return false;
  }
}

export function isDigestBlocked(): boolean {
  return isSnoozeActive() || wasDigestShownToday();
}

export function markDigestShownToday(): void {
  try {
    localStorage.setItem(STORAGE_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

export function snoozeDigestUntilTomorrow(): void {
  markDigestShownToday();
}

export function dismissDigestForToday(): void {
  markDigestShownToday();
}

export function snoozeDigestForHours(hours: number): void {
  const safe = Math.min(72, Math.max(1, Math.round(hours)));
  try {
    localStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + safe * 3_600_000));
    markDigestShownToday();
  } catch {
    /* ignore */
  }
}

export function getDigestSnoozeRemainingMs(): number {
  try {
    const raw = localStorage.getItem(SNOOZE_UNTIL_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    return Math.max(0, until - Date.now());
  } catch {
    return 0;
  }
}

export function formatDigestHiddenLabel(lang: LanguageCode = "english"): string {
  const ms = getDigestSnoozeRemainingMs();
  if (ms > 0) {
    const mins = Math.ceil(ms / 60_000);
    if (mins < 60) {
      if (lang === "nepali") return `स्नूज · ${mins}मि बाँकी`;
      if (lang === "roman") return `Snooze · ${mins}m baki`;
      return `Snoozed · ${mins}m left`;
    }
    const hours = Math.ceil(ms / 3_600_000);
    if (lang === "nepali") return `स्नूज · ${hours}घण्टा बाँकी`;
    if (lang === "roman") return `Snooze · ${hours}h baki`;
    return `Snoozed · ${hours}h left`;
  }
  if (lang === "nepali") return "भोलिसम्म लुकाइएको";
  if (lang === "roman") return "Bholi samma lukiyeko";
  return "Hidden until tomorrow";
}

export function formatDailyDigestHeader(lang: LanguageCode): string {
  if (lang === "nepali") return "दैनिक सारांश";
  if (lang === "roman") return "Daily digest";
  return "Daily digest";
}

export type DigestSnoozeChip = "1h" | "4h" | "tomorrow";

export function formatDigestSnoozeChip(kind: DigestSnoozeChip, lang: LanguageCode): string {
  if (kind === "1h") {
    if (lang === "nepali") return "१घ";
    if (lang === "roman") return "1h";
    return "1h";
  }
  if (kind === "4h") {
    if (lang === "nepali") return "४घ";
    if (lang === "roman") return "4h";
    return "4h";
  }
  if (lang === "nepali") return "भोलि";
  if (lang === "roman") return "Bholi";
  return "Tomorrow";
}

export function formatDigestSnoozeTitle(kind: DigestSnoozeChip, lang: LanguageCode): string {
  if (kind === "1h") {
    if (lang === "nepali") return "१ घण्टाको लागि स्नूज";
    if (lang === "roman") return "1 ghanta ko lagi snooze";
    return "Snooze 1 hour";
  }
  if (kind === "4h") {
    if (lang === "nepali") return "४ घण्टाको लागि स्नूज";
    if (lang === "roman") return "4 ghanta ko lagi snooze";
    return "Snooze 4 hours";
  }
  if (lang === "nepali") return "भोलिसम्म लुकाउनुहोस्";
  if (lang === "roman") return "Bholi samma lukau";
  return "Hide until tomorrow";
}

export function formatDigestShowAgainLabel(lang: LanguageCode): string {
  if (lang === "nepali") return "फेरि देखाउ";
  if (lang === "roman") return "Feri dekhau";
  return "Show again";
}

export function buildDigestShowQuickReply(lang: LanguageCode) {
  return {
    id: "digest-show",
    label: formatDigestShowAgainLabel(lang),
    value: "/digest show",
    kind: "query" as const,
  };
}

export function formatDigestDismissReply(lang: LanguageCode): string {
  if (lang === "english") return "Today's digest dismissed. It will show again tomorrow.";
  if (lang === "roman") return "Aajko digest hatiyo. Bholi feri dekhinecha.";
  return "आजको दैनिक सारांश हटाइयो। भोलि फेरि देखिनेछ।";
}

export function formatDigestSnoozeReply(hours: number, lang: LanguageCode): string {
  if (lang === "english") return `Digest snoozed for ${hours} hours.`;
  if (lang === "roman") return `Digest ${hours} ghanta ko lagi snooze bhayo.`;
  return `दैनिक सारांश ${hours} घण्टाको लागि स्नूज भयो।`;
}

export function formatDigestShowReply(lang: LanguageCode): string {
  if (lang === "english") return "Today's digest is visible again.";
  if (lang === "roman") return "Aajko digest feri dekhiyo.";
  return "आजको दैनिक सारांश फेरि देखाइयो।";
}

export function isDigestHiddenChipMessage(msg: { isDigestChip?: boolean }): boolean {
  return Boolean(msg.isDigestChip);
}

export function withoutDigestHiddenChips<T extends { isDigestChip?: boolean }>(messages: T[]): T[] {
  return messages.filter((m) => !isDigestHiddenChipMessage(m));
}

export function restoreDigestVisibility(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SNOOZE_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

export function clearDigestShownMarker(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SNOOZE_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}
