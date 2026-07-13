/**
 * Deterministic bank reconciliation matching engine (Phase 10).
 * Promotes patterns from src/lib/bankMatchingEngine.ts with stricter tiers:
 * 1. exact bank_transaction_id
 * 2. exact cheque / instrument number
 * 3. exact normalized reference
 * 4. exact amount + date
 * 5. amount within date tolerance (±3 days)
 * 6. suggestGroupedMatches (1 statement → N ERP, max 4 candidates)
 */

import { paisaToNumber } from "@/domains/purchase/money";
import { daysBetween, normalizeReference } from "./postingFramework";
import type { MatchMethod } from "./types";

export interface ErpMatchCandidate {
  id: string;
  voucherId?: string | null;
  voucherNo?: string | null;
  bankTransactionId?: string | null;
  chequeNumber?: string | null;
  reference?: string | null;
  /** Book signed amount: inflow to bank positive (receipt), outflow negative (payment). */
  signedAmountPaisa: number;
  date: string;
  description?: string | null;
  partyName?: string | null;
  remainingMatchPaisa?: number;
}

export interface StatementMatchCandidate {
  id: string;
  bankTransactionId?: string | null;
  reference?: string | null;
  chequeNumber?: string | null;
  description: string;
  /** Statement signed: credit - debit (inflow positive). */
  signedAmountPaisa: number;
  date: string;
  remainingMatchPaisa?: number;
}

export interface MatchSuggestion {
  statementLineId: string;
  erpDocumentIds: string[];
  matchMethod: MatchMethod;
  confidence: number;
  explanation: string;
  matchedFields: string[];
  matchedAmountPaisa: number;
}

export interface MatchingEngineResult {
  suggestions: MatchSuggestion[];
  unmatchedStatementIds: string[];
  unmatchedErpIds: string[];
}

function amountNearPaisa(a: number, b: number, tol = 1): boolean {
  return Math.abs(a - b) <= tol;
}

function extractChequeLike(text: string | null | undefined): string {
  const m = String(text || "").match(/\b([A-Z]{0,3}\d{3,12})\b/i);
  return m ? m[1].toUpperCase() : "";
}

/**
 * Run deterministic matching. Each statement / ERP id used at most once in auto suggestions.
 */
export function runDeterministicMatching(
  statements: StatementMatchCandidate[],
  erpEntries: ErpMatchCandidate[],
  opts?: { dateToleranceDays?: number },
): MatchingEngineResult {
  const dateTol = opts?.dateToleranceDays ?? 3;
  const usedStmt = new Set<string>();
  const usedErp = new Set<string>();
  const suggestions: MatchSuggestion[] = [];

  const claim = (
    stmt: StatementMatchCandidate,
    erp: ErpMatchCandidate,
    method: MatchMethod,
    confidence: number,
    explanation: string,
    matchedFields: string[],
  ) => {
    if (usedStmt.has(stmt.id) || usedErp.has(erp.id)) return;
    // Statement inflow (credit) should match book inflow (receipt / debit to bank).
    if (!amountNearPaisa(stmt.signedAmountPaisa, erp.signedAmountPaisa)) return;
    usedStmt.add(stmt.id);
    usedErp.add(erp.id);
    suggestions.push({
      statementLineId: stmt.id,
      erpDocumentIds: [erp.id],
      matchMethod: method,
      confidence,
      explanation,
      matchedFields,
      matchedAmountPaisa: Math.abs(stmt.signedAmountPaisa),
    });
  };

  // 1. exact bank_transaction_id
  for (const stmt of statements) {
    if (usedStmt.has(stmt.id) || !stmt.bankTransactionId) continue;
    const key = String(stmt.bankTransactionId).trim().toUpperCase();
    for (const erp of erpEntries) {
      if (usedErp.has(erp.id) || !erp.bankTransactionId) continue;
      if (String(erp.bankTransactionId).trim().toUpperCase() !== key) continue;
      claim(stmt, erp, "exact_bank_transaction_id", 1, `Exact bank transaction id ${key}`, [
        "bankTransactionId",
        "amount",
      ]);
      break;
    }
  }

  // 2. exact cheque / instrument number
  for (const stmt of statements) {
    if (usedStmt.has(stmt.id)) continue;
    const stmtChq =
      (stmt.chequeNumber && normalizeReference(stmt.chequeNumber)) ||
      extractChequeLike(stmt.reference) ||
      extractChequeLike(stmt.description);
    if (!stmtChq) continue;
    for (const erp of erpEntries) {
      if (usedErp.has(erp.id)) continue;
      const erpChq =
        (erp.chequeNumber && normalizeReference(erp.chequeNumber)) ||
        extractChequeLike(erp.reference) ||
        extractChequeLike(erp.voucherNo || "");
      if (!erpChq || erpChq !== stmtChq) continue;
      if (!amountNearPaisa(stmt.signedAmountPaisa, erp.signedAmountPaisa)) continue;
      claim(
        stmt,
        erp,
        "exact_cheque_number",
        0.98,
        `Exact cheque/instrument number ${stmtChq}`,
        ["chequeNumber", "amount"],
      );
      break;
    }
  }

  // 3. exact normalized reference
  for (const stmt of statements) {
    if (usedStmt.has(stmt.id)) continue;
    const stmtRef = normalizeReference(stmt.reference);
    if (!stmtRef || stmtRef.length < 3) continue;
    for (const erp of erpEntries) {
      if (usedErp.has(erp.id)) continue;
      const erpRef = normalizeReference(erp.reference || erp.voucherNo);
      if (!erpRef || erpRef !== stmtRef) continue;
      if (!amountNearPaisa(stmt.signedAmountPaisa, erp.signedAmountPaisa)) continue;
      claim(
        stmt,
        erp,
        "exact_normalized_reference",
        0.95,
        `Exact normalized reference ${stmtRef}`,
        ["reference", "amount"],
      );
      break;
    }
  }

  // 4. exact amount + date
  for (const stmt of statements) {
    if (usedStmt.has(stmt.id)) continue;
    for (const erp of erpEntries) {
      if (usedErp.has(erp.id)) continue;
      if (!amountNearPaisa(stmt.signedAmountPaisa, erp.signedAmountPaisa)) continue;
      if (stmt.date !== erp.date) continue;
      claim(stmt, erp, "exact_amount_date", 0.9, "Exact amount + exact date", ["amount", "date"]);
      break;
    }
  }

  // 5. amount within date tolerance (±3 days)
  for (const stmt of statements) {
    if (usedStmt.has(stmt.id)) continue;
    for (const erp of erpEntries) {
      if (usedErp.has(erp.id)) continue;
      if (!amountNearPaisa(stmt.signedAmountPaisa, erp.signedAmountPaisa)) continue;
      if (daysBetween(stmt.date, erp.date) > dateTol) continue;
      claim(
        stmt,
        erp,
        "amount_date_tolerance",
        0.75,
        `Amount match + date within ±${dateTol} days (stmt ${stmt.date}, book ${erp.date})`,
        ["amount", "date_tolerance"],
      );
      break;
    }
  }

  return {
    suggestions,
    unmatchedStatementIds: statements.filter((s) => !usedStmt.has(s.id)).map((s) => s.id),
    unmatchedErpIds: erpEntries.filter((e) => !usedErp.has(e.id)).map((e) => e.id),
  };
}

/**
 * Suggest 1 statement → N ERP documents whose amounts sum to the statement
 * (bounded, max 4 candidates). Greedy absolute-amount pack.
 */
export function suggestGroupedMatches(
  statement: StatementMatchCandidate,
  erpEntries: ErpMatchCandidate[],
  opts?: { maxCandidates?: number },
): MatchSuggestion | null {
  const maxN = opts?.maxCandidates ?? 4;
  const target = Math.abs(statement.signedAmountPaisa);
  const sign = statement.signedAmountPaisa >= 0 ? 1 : -1;
  const pool = erpEntries
    .filter((e) => Math.sign(e.signedAmountPaisa || 0) === sign || e.signedAmountPaisa === 0)
    .filter((e) => Math.abs(e.signedAmountPaisa) > 0)
    .sort((a, b) => Math.abs(b.signedAmountPaisa) - Math.abs(a.signedAmountPaisa))
    .slice(0, 24);

  // Bounded search: try combinations up to maxN
  const chosen: ErpMatchCandidate[] = [];
  let sum = 0;
  for (const e of pool) {
    if (chosen.length >= maxN) break;
    const next = sum + Math.abs(e.signedAmountPaisa);
    if (next <= target + 1) {
      chosen.push(e);
      sum = next;
      if (Math.abs(sum - target) <= 1) break;
    }
  }
  if (chosen.length < 2 || Math.abs(sum - target) > 1) return null;

  return {
    statementLineId: statement.id,
    erpDocumentIds: chosen.map((c) => c.id),
    matchMethod: "grouped_suggestion",
    confidence: 0.55,
    explanation: `Grouped ${chosen.length} ERP entries summing to ${paisaToNumber(target).toFixed(2)}`,
    matchedFields: ["amount_sum", "sign"],
    matchedAmountPaisa: target,
  };
}
