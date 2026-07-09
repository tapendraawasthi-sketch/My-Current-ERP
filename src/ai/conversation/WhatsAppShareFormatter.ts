/** SUTRA AI — WhatsApp-ready message formatting */

import type { LanguageCode } from "../types";

function formatRs(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export function formatReceivableReminder(
  partyName: string,
  balance: number,
  lang: LanguageCode,
  opts?: { daysOverdue?: number; shopName?: string },
): string {
  const shop = opts?.shopName ?? "हाम्रो पसल";
  const amt = formatRs(balance);

  if (lang === "english") {
    const overdue =
      opts?.daysOverdue != null && opts.daysOverdue > 0
        ? ` (${opts.daysOverdue} days overdue)`
        : "";
    return (
      `Dear ${partyName},\n` +
      `This is a friendly reminder from ${shop}. ` +
      `Your outstanding balance is ${amt}${overdue}. ` +
      `Please settle at your earliest convenience. Thank you.`
    );
  }

  if (lang === "roman") {
    return (
      `Namaste ${partyName},\n` +
      `${shop} bata reminder: tapai ko baki ${amt} cha. ` +
      `Kripaya chittai milau. Dhanyabad.`
    );
  }

  const overdueNe =
    opts?.daysOverdue != null && opts.daysOverdue > 0
      ? ` (${opts.daysOverdue} दिन ढिला)`
      : "";
  return (
    `नमस्ते ${partyName},\n` +
    `${shop} बाट सम्झना: तपाईंको बाँकी ${amt}${overdueNe} छ। ` +
    `कृपया चाँडै मिलाइदिनुहोला। धन्यवाद।`
  );
}

export function formatPayableReminder(
  partyName: string,
  balance: number,
  lang: LanguageCode,
  opts?: { daysOverdue?: number; shopName?: string },
): string {
  const shop = opts?.shopName ?? "हाम्रो पसल";
  const amt = formatRs(balance);

  if (lang === "english") {
    const overdue =
      opts?.daysOverdue != null && opts.daysOverdue > 0
        ? ` (${opts.daysOverdue} days overdue)`
        : "";
    return (
      `Dear ${partyName},\n` +
      `Payment reminder from ${shop}. ` +
      `Outstanding payable amount is ${amt}${overdue}. ` +
      `Please arrange payment at your earliest convenience. Thank you.`
    );
  }

  if (lang === "roman") {
    return (
      `Namaste ${partyName},\n` +
      `${shop} bata payment reminder: hami tapai lai ${amt} tirnu baki cha. ` +
      `Kripaya chittai payment milau. Dhanyabad.`
    );
  }

  const overdueNe =
    opts?.daysOverdue != null && opts.daysOverdue > 0
      ? ` (${opts.daysOverdue} दिन ढिला)`
      : "";
  return (
    `नमस्ते ${partyName},\n` +
    `${shop} बाट भुक्तानी सम्झना: तपाईंलाई ${amt} तिर्न बाँकी${overdueNe} छ। ` +
    `कृपया चाँडै भुक्तानी मिलाइदिनुहोला। धन्यवाद।`
  );
}

export function formatBalanceShare(
  partyName: string,
  balance: number,
  lang: LanguageCode,
): string {
  const amt = formatRs(balance);
  if (lang === "english") return `${partyName} balance: ${amt}`;
  if (lang === "roman") return `${partyName} ko balance: ${amt}`;
  return `${partyName} को ब्यालेन्स: ${amt}`;
}

export function formatForWhatsApp(text: string): string {
  return text.replace(/\n/g, "\n").trim();
}

export function buildWhatsAppUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(formatForWhatsApp(text));
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export async function copyWhatsAppText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatForWhatsApp(text));
    return true;
  } catch {
    return false;
  }
}

export function openWhatsAppShare(text: string, phone?: string): void {
  window.open(buildWhatsAppUrl(text, phone), "_blank", "noopener,noreferrer");
}
