/**
 * UIL Parser — Phase 1
 * Converts natural language (EN / Roman Nepali / Devanagari) to UIL documents.
 */

import type { UILDocument } from "../contracts/types";
import { createUILFromText } from "../contracts/intelligence-contract";

const SALE_PATTERN =
  /\b(beche|becheko|bikyo|bikri|sell|sold|बेच|बिक्री)\b/i;
const PURCHASE_PATTERN =
  /\b(kine|kineko|kinyo|purchase|bought|किन|खरिद)\b/i;
const BALANCE_PATTERN =
  /\b(balance|bakaya|baki|शेष|kitna|kati)\b/i;
const TAX_PATTERN = /\b(vat|tds|tax|कर|भ्याट|आयकर)\b/i;
const PARTY_LE_PATTERN = /\b(\w+)\s+le\b/i;
const DEVANAGARI_PARTY = /([\u0900-\u097F]+)\s+ले\b/;

const ACCOUNTING_TERMS = new Set([
  "sampati",
  "sampatti",
  "सम्पत्ति",
  "सम्पति",
  "capital",
  "asset",
  "liability",
  "revenue",
  "expense",
  "debit",
  "credit",
  "journal",
  "ledger",
  "vat",
  "tds",
]);

export function isDomainTerm(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (ACCOUNTING_TERMS.has(lower)) return true;
  return /\b(sampati|sampatti|सम्पत्ति|सम्पति|आय|खर्च|सामान)\b/i.test(text);
}

export function parseToUIL(text: string): UILDocument {
  const trimmed = text.trim();
  const uil = createUILFromText(trimmed);

  if (SALE_PATTERN.test(trimmed)) {
    uil.action = "sell";
    uil.goals = ["record_sale", "update_inventory", "compute_vat"];
    uil.inventory_effect = { movement: "outbound" };
    uil.tax_effect = { vat: true };
    uil.financial_effect = { revenue: true, receivable: true };
    uil.confidence = 0.75;
    uil.dependencies = ["cap.party.resolve", "cap.inventory.check", "cap.tax.vat.calculate"];
  } else if (PURCHASE_PATTERN.test(trimmed)) {
    uil.action = "purchase";
    uil.goals = ["record_purchase", "update_inventory", "compute_vat"];
    uil.inventory_effect = { movement: "inbound" };
    uil.tax_effect = { input_vat: true };
    uil.financial_effect = { expense: true, payable: true };
    uil.confidence = 0.75;
    uil.dependencies = ["cap.party.resolve", "cap.tax.vat.calculate"];
  } else if (BALANCE_PATTERN.test(trimmed)) {
    uil.action = "ledger_query";
    uil.goals = ["fetch_balance"];
    uil.financial_effect = { balance: true };
    uil.confidence = 0.9;
    uil.dependencies = ["cap.erp.ledger.balance", "cap.erp.session_snapshot"];
  } else if (TAX_PATTERN.test(trimmed)) {
    uil.action = "tax_query";
    uil.goals = ["answer_tax_question"];
    uil.tax_effect = { query: true };
    uil.confidence = 0.8;
    uil.dependencies = ["cap.knowledge.nepal.search", "cap.tax.vat.calculate"];
    uil.evidence_needed = ["law", "engine"];
  } else {
    uil.action = "query";
    uil.goals = ["answer_question"];
    uil.confidence = 0.55;
    uil.dependencies = ["cap.knowledge.nepal.search"];
  }

  const partyMatch = trimmed.match(PARTY_LE_PATTERN) || trimmed.match(DEVANAGARI_PARTY);
  if (partyMatch?.[1]) {
    uil.actor = { party: partyMatch[1], role: "counterparty" };
    uil.confidence = Math.min(0.95, uil.confidence + 0.1);
  }

  const amountMatch = trimmed.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\b/);
  if (amountMatch) {
    uil.object = { ...(uil.object || {}), amount: parseFloat(amountMatch[1].replace(/,/g, "")) };
  }

  if (/[\u0900-\u097F]/.test(trimmed)) {
    uil.language = { detected: "nepali", script: "devanagari", canonical_text: trimmed };
  } else if (/\b(ko|le|lai|bhayo|gayo|kati|k ho)\b/i.test(trimmed)) {
    uil.language = { detected: "nepali", script: "roman", canonical_text: trimmed };
  } else {
    uil.language = { detected: "english", script: "english", canonical_text: trimmed };
  }

  return uil;
}
