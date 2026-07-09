/** SUTRA AI — digest bar pin preference */

import type { LanguageCode } from "../types";

const DIGEST_PIN_KEY = "sutra:digest-pinned";

export function readDigestPinnedPreference(): boolean {
  try {
    const raw = localStorage.getItem(DIGEST_PIN_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeDigestPinnedPreference(pinned: boolean): void {
  try {
    localStorage.setItem(DIGEST_PIN_KEY, pinned ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function formatCacheClearConfirm(lang: LanguageCode): string {
  if (lang === "english") {
    return "Clear LLM response cache? Cached replies will be removed until rebuilt.";
  }
  if (lang === "roman") {
    return "LLM cache clear garna? Cached jawaf haru hatauncha.";
  }
  return "LLM cache मेट्ने? सुरक्षित जवाफहरू हट्नेछन्।";
}

export function agingWaButtonLabel(hasPhone: boolean, lang: LanguageCode = "english"): string {
  if (hasPhone) return "+WA";
  if (lang === "nepali") return "फोन थप्नुहोस्";
  if (lang === "roman") return "Set phone";
  return "Set phone";
}

export function formatDigestPinLabels(
  lang: LanguageCode,
  pinned: boolean,
): { label: string; title: string } {
  if (lang === "nepali") {
    return pinned
      ? { label: "टाँसिएको", title: "स्क्रोल गर्दा digest अनपिन गर्नुहोस्" }
      : { label: "टाँस्नुहोस्", title: "स्क्रोल गर्दा digest टाँस्नुहोस्" };
  }
  if (lang === "roman") {
    return pinned
      ? { label: "Pinned", title: "Scroll garda digest unpin garnu" }
      : { label: "Pin", title: "Scroll garda digest pin garnu" };
  }
  return pinned
    ? { label: "Pinned", title: "Unpin digest while scrolling" }
    : { label: "Pin", title: "Pin digest while scrolling" };
}

export type CacheSyncKind = "clear_requested" | "stats_opened" | "stats_copied" | "copy_failed";

export function formatCacheSyncMessage(kind: CacheSyncKind, lang: LanguageCode): string {
  const table: Record<CacheSyncKind, Record<LanguageCode, string>> = {
    clear_requested: {
      english: "Cache clear requested.",
      nepali: "Cache मेट्न अनुरोध गरियो।",
      roman: "Cache clear request gariyo.",
    },
    stats_opened: {
      english: "Cache stats opened in chat.",
      nepali: "Cache तथ्याङ्क chat मा खोलियो।",
      roman: "Cache stats chat ma khulyo.",
    },
    stats_copied: {
      english: "Cache stats copied.",
      nepali: "Cache तथ्याङ्क कपी भयो।",
      roman: "Cache stats copy bhayo.",
    },
    copy_failed: {
      english: "Copy failed",
      nepali: "कपी असफल",
      roman: "Copy fail bhayo",
    },
  };
  return table[kind][lang];
}

export function formatCachedBadgeLabel(lang: LanguageCode): string {
  if (lang === "nepali") return "क्यास";
  if (lang === "roman") return "Cached";
  return "Cached";
}

export function formatCachedHeaderSubtitle(lang: LanguageCode): string {
  if (lang === "nepali") return "क्यास · नियम-आधारित · Nepali-English-Roman";
  if (lang === "roman") return "Cached · rule-based · Nepali-English-Roman";
  return "Cached · Rule-based · Nepali-English-Roman";
}

export function formatRuleBasedHeaderSubtitle(lang: LanguageCode): string {
  if (lang === "nepali") return "नियम-आधारित · Nepali-English-Roman";
  if (lang === "roman") return "Rule-based · Nepali-English-Roman";
  return "Rule-based · Nepali-English-Roman";
}

export function formatCachedBadgeTooltip(lang: LanguageCode): string {
  if (lang === "nepali") return "अन्तिम जवाफ offline LLM cache बाट";
  if (lang === "roman") return "Antim jawaf offline LLM cache bata";
  return "Last reply served from offline LLM cache";
}

export function formatAgingSearchPlaceholder(lang: LanguageCode): string {
  if (lang === "nepali") return "पार्टी नाम वा PAN खोज्नुहोस्…";
  if (lang === "roman") return "Party naam wa PAN khojnuhos…";
  return "Search party name or PAN…";
}

export function formatAgingReminderModalTitle(
  direction: "receivable" | "payable",
  lang: LanguageCode,
): string {
  if (direction === "payable") {
    if (lang === "nepali") return "भुक्तानी सम्झना";
    if (lang === "roman") return "Payment reminder";
    return "Payment reminder";
  }
  if (lang === "nepali") return "ब्यालेन्स सम्झना";
  if (lang === "roman") return "Balance reminder";
  return "Balance reminder";
}

export function formatCacheClearQuickReplyLabel(lang: LanguageCode): string {
  if (lang === "nepali") return "Cache मेट्नुहोस्";
  if (lang === "roman") return "Cache clear";
  return "Clear cache";
}

export function formatCacheClearedReply(cleared: number, lang: LanguageCode): string {
  if (lang === "english") return `LLM cache cleared (${cleared} entries).`;
  if (lang === "roman") return `LLM cache clear bhayo (${cleared} entries).`;
  return `LLM cache मेटियो (${cleared} entries)।`;
}

export function formatProactiveAlertsHeader(lang: LanguageCode): string {
  if (lang === "nepali") return "सतर्कता";
  if (lang === "roman") return "Alerts";
  return "Alerts";
}

export function formatAgingRemindWaButton(hasPhone: boolean, lang: LanguageCode): string {
  if (hasPhone) return "WhatsApp";
  if (lang === "nepali") return "WhatsApp खोल्नुहोस्";
  if (lang === "roman") return "WhatsApp kholnuhos";
  return "Open WhatsApp";
}

export function formatAgingRemindCopyButton(lang: LanguageCode): string {
  if (lang === "nepali") return "कपी";
  if (lang === "roman") return "Copy garau";
  return "Copy";
}

export type ChatSyncKind = "chat_exported" | "learning_exported" | "reminder_copied";

export function formatChatSyncMessage(kind: ChatSyncKind, lang: LanguageCode): string {
  const table: Record<ChatSyncKind, Record<LanguageCode, string>> = {
    chat_exported: {
      english: "Chat exported.",
      nepali: "Chat export भयो।",
      roman: "Chat export bhayo.",
    },
    learning_exported: {
      english: "Learning data exported.",
      nepali: "Learning data export भयो।",
      roman: "Learning data export bhayo.",
    },
    reminder_copied: {
      english: "Reminder copied to clipboard.",
      nepali: "सम्झना क्लिपबोर्डमा कपी भयो।",
      roman: "Reminder clipboard ma copy bhayo.",
    },
  };
  return table[kind][lang];
}

export function formatAnalyzingLabel(lang: LanguageCode): string {
  if (lang === "nepali") return "विश्लेषण गर्दै...";
  if (lang === "roman") return "Analyze gardai...";
  return "Analyzing...";
}

export function formatAutoCorrectedLabel(lang: LanguageCode): string {
  if (lang === "nepali") return "स्वतः सुधार";
  if (lang === "roman") return "Auto-sudhar";
  return "Auto-corrected";
}
