/** SUTRA AI — filter parties by customer / supplier role */

import type { ErpPartyRef } from "../types";

export type PartyKindFilter = "all" | "customer" | "supplier";

export function isSupplierParty(party: ErpPartyRef): boolean {
  const t = (party.type ?? "").toLowerCase();
  return t.includes("supplier") || t.includes("both");
}

export function isCustomerParty(party: ErpPartyRef): boolean {
  const t = (party.type ?? "").toLowerCase();
  return t.includes("customer") || t.includes("both") || !t;
}

export function filterPartiesByKind(
  parties: ErpPartyRef[],
  filter: PartyKindFilter,
): ErpPartyRef[] {
  if (filter === "all") return parties;
  if (filter === "supplier") return parties.filter(isSupplierParty);
  return parties.filter(isCustomerParty);
}

export function parseSearchPartyFilter(text: string): { query: string; filter: PartyKindFilter } {
  const slashSupplier = text.match(/^\/search\s+supplier\s+(.+)/i);
  if (slashSupplier) {
    return { query: slashSupplier[1].trim(), filter: "supplier" };
  }

  const slashCustomer = text.match(/^\/search\s+customer\s+(.+)/i);
  if (slashCustomer) {
    return { query: slashCustomer[1].trim(), filter: "customer" };
  }

  let query = text;
  let filter: PartyKindFilter = "all";

  const slash = text.match(/^\/search\s+(.+)/i);
  if (slash) query = slash[1].trim();

  const m = query.match(/\b(?:search|khoj|find|lookup)\s+(.+)/i);
  if (m) query = m[1].trim();
  if (/^khoj\s+/i.test(query)) query = query.replace(/^khoj\s+/i, "").trim();

  if (/\bsupplier\b/i.test(query)) {
    filter = "supplier";
    query = query.replace(/\bsupplier\b/gi, "").trim();
  } else if (/\bcustomer\b/i.test(query)) {
    filter = "customer";
    query = query.replace(/\bcustomer\b/gi, "").trim();
  }

  return { query: query.replace(/\s+/g, " ").trim(), filter };
}

export function parseOverduePartyFilter(text: string): PartyKindFilter {
  if (/^\/overdue\s+supplier\b/i.test(text.trim())) return "supplier";
  if (/^\/overdue\s+customer\b/i.test(text.trim())) return "customer";
  if (/\bsupplier\b/i.test(text) && /\b(overdue|udhaar|baki|payable)\b/i.test(text)) {
    return "supplier";
  }
  if (/\bcustomer\b/i.test(text) && /\b(overdue|udhaar|baki|receivable)\b/i.test(text)) {
    return "customer";
  }
  return "all";
}
