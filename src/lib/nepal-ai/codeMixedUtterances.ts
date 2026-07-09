/**
 * Code-mixed multilingual utterance goldens — Nepali/English/Hindi/Devanagari spans,
 * normalized text, intent + entities for NLU routing.
 */

import {
  CODE_MIXED_UTTERANCE_ALIASES,
  CODE_MIXED_UTTERANCES,
  CODE_MIXED_UTTERANCES_BY_INTENT,
  type CodeMixedUtterance,
} from "./generated/runtimeMaps";
import type { LedgerBalanceSnapshot } from "@/lib/ekhata/conversationEngine";
import { replyBalance } from "@/lib/ekhata/conversationEngine";

const BY_ID = new Map(CODE_MIXED_UTTERANCES.map((e) => [e.id, e]));

const BALANCE_INTENTS = new Set([
  "balance_inquiry",
  "outstanding_inquiry",
  "balance_due_inquiry",
  "loan_balance_inquiry",
  "deposit_inquiry",
  "credit_inquiry",
]);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCodeMixedUtteranceById(
  id: string,
): CodeMixedUtterance | null {
  return BY_ID.get(id) ?? null;
}

export function getCodeMixedUtterancesByIntent(
  intentKey: string,
): CodeMixedUtterance[] {
  const ids = CODE_MIXED_UTTERANCES_BY_INTENT[intentKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as CodeMixedUtterance[];
}

/** Exact golden match on raw input, normalized, or input_normalized. */
export function matchCodeMixedUtterance(
  text: string,
): CodeMixedUtterance | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = CODE_MIXED_UTTERANCE_ALIASES[cand];
    if (hit) return getCodeMixedUtteranceById(hit.id);
  }

  return null;
}

function entitySummary(entities: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(entities)) {
    if (v == null || v === "") continue;
    parts.push(`${k}: ${String(v)}`);
  }
  return parts.length ? parts.join(", ") : "";
}

function intentReplyNe(
  entry: CodeMixedUtterance,
  balance?: LedgerBalanceSnapshot,
): string {
  const ent = entitySummary(entry.entities as Record<string, unknown>);
  const langs = entry.languagesDetected.join(", ");

  if (BALANCE_INTENTS.has(entry.intent) && balance) {
    return replyBalance(balance, entry.input);
  }

  switch (entry.intent) {
    case "correction_request": {
      const oldAmt = entry.entities.old_amount;
      const newAmt = entry.entities.new_amount;
      const party = entry.entities.party;
      if (oldAmt != null && newAmt != null) {
        return party
          ? `${party} ko entry ${oldAmt} bata ${newAmt} ma correct garne? Confirm garnuhos.`
          : `Amount ${oldAmt} bata ${newAmt} ma update garne? Confirm garnuhos.`;
      }
      return "Correction chahiyo — thik amount ra detail confirm garnuhos.";
    }
    case "balance_inquiry":
    case "outstanding_inquiry":
    case "balance_due_inquiry":
      return balance
        ? replyBalance(balance, entry.input)
        : "Balance herna ledger kholnus — total udhaar/baki dekhincha.";
    case "reconciliation_request":
      return "Khata milan garna bank statement ra ledger side-by-side match garnuhos. Mismatch line specify garnus.";
    case "invoice_request":
      return "Invoice generate/pathaune request bujhiyo. Party, amount, ra VAT detail dinus.";
    case "tax_inquiry":
      return "VAT/tax status check garna last filed return ra payment receipt hernuhos.";
    case "account_request":
      return `${ent || "Period"} ko hisab/report tayar garna date range confirm garnuhos.`;
    default:
      return `Bujhiyo (${entry.intent.replace(/_/g, " ")}). ${ent ? `(${ent}) ` : ""}[${langs}] — aru detail dinus bhane help garna sakchhu.`;
  }
}

function intentReplyEn(
  entry: CodeMixedUtterance,
  balance?: LedgerBalanceSnapshot,
): string {
  if (BALANCE_INTENTS.has(entry.intent) && balance) {
    return replyBalance(balance, entry.input);
  }

  switch (entry.intent) {
    case "correction_request": {
      const oldAmt = entry.entities.old_amount;
      const newAmt = entry.entities.new_amount;
      if (oldAmt != null && newAmt != null) {
        return `Update amount from ${oldAmt} to ${newAmt}? Please confirm.`;
      }
      return "Correction noted — please confirm the correct amount and details.";
    }
    case "balance_inquiry":
    case "outstanding_inquiry":
    case "balance_due_inquiry":
      return balance
        ? replyBalance(balance, entry.input)
        : "Open the ledger to see outstanding balance.";
    default:
      return `Understood (${entry.intent.replace(/_/g, " ")}). Mixed input detected: ${entry.languagesDetected.join(", ")}. Share more detail if needed.`;
  }
}

export function formatCodeMixedUtteranceReply(
  entry: CodeMixedUtterance,
  lang: "nepali" | "english" | "mixed",
  balance?: LedgerBalanceSnapshot,
): string {
  if (lang === "english") return intentReplyEn(entry, balance);
  return intentReplyNe(entry, balance);
}

export function isNonTransactionCodeMixedIntent(intent: string): boolean {
  return Boolean(CODE_MIXED_UTTERANCES_BY_INTENT[intent]);
}

export type { CodeMixedUtterance };
