/**
 * Bank statement CSV import (Phase 10).
 *
 * E2E fixture format (header map defaults):
 *   date,description,reference,debit,credit,balance
 * Example row:
 *   2026-07-10,NEFT RAM TRADERS,RV-E2E-001,,5000.00,105000.00
 *   2026-07-11,CHQ 001234 PAYMENT,CH-E2E-001,2500.00,,102500.00
 *
 * Debit = money OUT of bank; credit = money IN.
 * signed_amount = credit - debit (inflow positive).
 */

import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";
import type { MoneyString } from "./types";

export type CsvHeaderMap = {
  date?: string;
  description?: string;
  reference?: string;
  debit?: string;
  credit?: string;
  balance?: string;
  bank_transaction_id?: string;
};

export const DEFAULT_CSV_HEADER_MAP: Required<CsvHeaderMap> = {
  date: "date",
  description: "description",
  reference: "reference",
  debit: "debit",
  credit: "credit",
  balance: "balance",
  bank_transaction_id: "bank_transaction_id",
};

export interface NormalizedStatementLine {
  lineNumber: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  bankTransactionId: string | null;
  debit: MoneyString;
  credit: MoneyString;
  signed_amount: MoneyString;
  balance: MoneyString | null;
  debitPaisa: number;
  creditPaisa: number;
  signedAmountPaisa: number;
  balancePaisa: number | null;
  rawHash: string;
}

export interface ImportReport {
  ok: boolean;
  lineCount: number;
  accepted: number;
  rejected: number;
  errors: Array<{ lineNumber: number; code: string; message: string }>;
  warnings: Array<{ lineNumber: number; code: string; message: string }>;
  sourceHash: string;
  periodStart: string | null;
  periodEnd: string | null;
  lines: NormalizedStatementLine[];
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      current.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      current.push(cell);
      cell = "";
      if (current.some((c) => c.trim() !== "")) rows.push(current);
      current = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length || current.length) {
    current.push(cell);
    if (current.some((c) => c.trim() !== "")) rows.push(current);
  }
  return rows;
}

/** SHA-256 hex when Web Crypto is available; else deterministic FNV-1a style hex. */
export async function computeSourceHash(content: string): Promise<string> {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const data = new TextEncoder().encode(normalized);
      const digest = await subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fall through */
  }
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Expand to 64 hex chars deterministically for contract stability in tests.
  let out = "";
  let state = hash >>> 0;
  for (let i = 0; i < 8; i++) {
    state = Math.imul(state ^ (i + 1), 16777619) >>> 0;
    out += state.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

function moneyOrZero(raw: string | undefined): { str: MoneyString; paisa: number } {
  const t = (raw || "").trim();
  if (!t) return { str: "0.00", paisa: 0 };
  const paisa = parseMoneyToPaisa(t);
  return { str: paisaToString(paisa), paisa };
}

export async function parseCsvStatement(
  text: string,
  mapping: CsvHeaderMap = {},
): Promise<{ lines: NormalizedStatementLine[]; sourceHash: string }> {
  const map = { ...DEFAULT_CSV_HEADER_MAP, ...mapping };
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return { lines: [], sourceHash: await computeSourceHash(text) };
  }
  const headers = rows[0].map(normalizeHeader);
  const col = (key: keyof Required<CsvHeaderMap>) => {
    const want = normalizeHeader(map[key]);
    const idx = headers.indexOf(want);
    return idx;
  };
  const iDate = col("date");
  const iDesc = col("description");
  const iRef = col("reference");
  const iDebit = col("debit");
  const iCredit = col("credit");
  const iBal = col("balance");
  const iTxn = col("bank_transaction_id");

  const lines: NormalizedStatementLine[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (idx: number) => (idx >= 0 ? (row[idx] || "").trim() : "");
    const date = get(iDate);
    if (!date) continue;
    const debit = moneyOrZero(get(iDebit));
    const credit = moneyOrZero(get(iCredit));
    const signedPaisa = credit.paisa - debit.paisa;
    const balRaw = get(iBal);
    let balancePaisa: number | null = null;
    let balanceStr: MoneyString | null = null;
    if (balRaw) {
      balancePaisa = parseMoneyToPaisa(balRaw);
      balanceStr = paisaToString(balancePaisa);
    }
    const description = get(iDesc) || "(no description)";
    const reference = get(iRef) || null;
    const bankTransactionId = get(iTxn) || null;
    const rawForHash = [date, description, reference || "", debit.str, credit.str, balanceStr || ""].join(
      "|",
    );
    const rawHash = await computeSourceHash(rawForHash);
    lines.push({
      lineNumber: r,
      transactionDate: date.slice(0, 10),
      description,
      reference,
      bankTransactionId,
      debit: debit.str,
      credit: credit.str,
      signed_amount: paisaToString(signedPaisa),
      balance: balanceStr,
      debitPaisa: debit.paisa,
      creditPaisa: credit.paisa,
      signedAmountPaisa: signedPaisa,
      balancePaisa,
      rawHash,
    });
  }
  return { lines, sourceHash: await computeSourceHash(text) };
}

export async function validateImport(
  text: string,
  mapping: CsvHeaderMap = {},
  opts?: { currency?: string; requireBalance?: boolean },
): Promise<ImportReport> {
  const errors: ImportReport["errors"] = [];
  const warnings: ImportReport["warnings"] = [];
  let lines: NormalizedStatementLine[] = [];
  let sourceHash = "";
  try {
    const parsed = await parseCsvStatement(text, mapping);
    lines = parsed.lines;
    sourceHash = parsed.sourceHash;
  } catch (err: any) {
    return {
      ok: false,
      lineCount: 0,
      accepted: 0,
      rejected: 1,
      errors: [{ lineNumber: 0, code: "parse_failed", message: String(err?.message || err) }],
      warnings: [],
      sourceHash: await computeSourceHash(text),
      periodStart: null,
      periodEnd: null,
      lines: [],
    };
  }

  if (lines.length === 0) {
    errors.push({
      lineNumber: 0,
      code: "empty_statement",
      message: "No statement lines found after header.",
    });
  }

  const acceptedLines: NormalizedStatementLine[] = [];
  for (const line of lines) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(line.transactionDate)) {
      errors.push({
        lineNumber: line.lineNumber,
        code: "invalid_date",
        message: `Invalid date: ${line.transactionDate}`,
      });
      continue;
    }
    if (line.debitPaisa > 0 && line.creditPaisa > 0) {
      warnings.push({
        lineNumber: line.lineNumber,
        code: "both_debit_credit",
        message: "Line has both debit and credit; using signed = credit - debit.",
      });
    }
    if (line.debitPaisa === 0 && line.creditPaisa === 0) {
      errors.push({
        lineNumber: line.lineNumber,
        code: "zero_amount",
        message: "Line has zero debit and credit.",
      });
      continue;
    }
    if (opts?.requireBalance && line.balancePaisa == null) {
      warnings.push({
        lineNumber: line.lineNumber,
        code: "missing_balance",
        message: "Balance column empty.",
      });
    }
    acceptedLines.push(line);
  }

  const dates = acceptedLines.map((l) => l.transactionDate).sort();
  return {
    ok: errors.length === 0 && acceptedLines.length > 0,
    lineCount: lines.length,
    accepted: acceptedLines.length,
    rejected: lines.length - acceptedLines.length + (errors.length && acceptedLines.length === 0 ? 0 : 0),
    errors,
    warnings,
    sourceHash,
    periodStart: dates[0] || null,
    periodEnd: dates[dates.length - 1] || null,
    lines: acceptedLines,
  };
}
