/** SUTRA AI — WhatsApp invoice share templates */

import type { ErpInvoiceRef, LanguageCode } from "../types";

function formatRs(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export function formatInvoiceShare(
  invoice: ErpInvoiceRef,
  lang: LanguageCode,
  shopName?: string,
): string {
  const shop = shopName ?? "हाम्रो पसल";
  const party = invoice.partyName ?? "—";
  const amt = formatRs(invoice.grandTotal);
  const no = invoice.invoiceNo || invoice.id;

  if (lang === "english") {
    return (
      `Invoice from ${shop}\n` +
      `No: ${no}\n` +
      `Date: ${invoice.date}\n` +
      `Party: ${party}\n` +
      `Amount: ${amt}\n` +
      `Thank you for your business.`
    );
  }

  if (lang === "roman") {
    return (
      `${shop} bata bill\n` +
      `No: ${no} · Date: ${invoice.date}\n` +
      `Party: ${party} · ${amt}\n` +
      `Dhanyabad.`
    );
  }

  return (
    `${shop} बाट बिल\n` +
    `नं: ${no}\n` +
    `मिति: ${invoice.date}\n` +
    `पार्टी: ${party}\n` +
    `रकम: ${amt}\n` +
    `धन्यवाद।`
  );
}

export function formatInvoiceListShare(
  invoices: ErpInvoiceRef[],
  lang: LanguageCode,
  shopName?: string,
): string {
  if (!invoices.length) return "";
  if (invoices.length === 1) return formatInvoiceShare(invoices[0], lang, shopName);
  const header =
    lang === "english"
      ? `Invoices (${invoices.length}):`
      : lang === "roman"
        ? `Bills (${invoices.length}):`
        : `बिलहरू (${invoices.length}):`;
  return `${header}\n${invoices.map((inv) => formatInvoiceShare(inv, lang, shopName)).join("\n\n")}`;
}
