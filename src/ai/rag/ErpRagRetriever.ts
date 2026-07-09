/** SUTRA AI — fuzzy retrieval over live ERP parties & stock items */

import type { ErpItemRef, ErpPartyRef, ErpRagContext, RagMatch } from "../types";
import {
  computeBusinessInsights,
  computePartyStats,
} from "./InsightQueryHandler";
import { resolveFiscalYear } from "../context/FiscalYearResolver";
import { computePnlFromInvoices } from "./FiscalPnlCalculator";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyScore(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.startsWith(q) || q.startsWith(c)) return 0.92;
  if (c.includes(q) || q.includes(c)) return 0.78;
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  const ratio = 1 - dist / maxLen;
  return ratio >= 0.6 ? ratio * 0.85 : 0;
}

function scoreAgainstFields(
  query: string,
  fields: Array<{ value?: string; weight: number; label: string }>,
): { score: number; field: string } {
  let best = 0;
  let field = "";
  for (const f of fields) {
    if (!f.value) continue;
    const s = fuzzyScore(query, f.value) * f.weight;
    if (s > best) {
      best = s;
      field = f.label;
    }
  }
  return { score: best, field };
}

export class ErpRagRetriever {
  findParties(query: string, parties: ErpPartyRef[] = [], limit = 5): RagMatch<ErpPartyRef>[] {
    const results: RagMatch<ErpPartyRef>[] = [];
    for (const p of parties) {
      const { score, field } = scoreAgainstFields(query, [
        { value: p.name, weight: 1, label: "name" },
        { value: p.nameNepali, weight: 0.95, label: "nameNepali" },
        { value: p.code, weight: 0.85, label: "code" },
      ]);
      if (score >= 0.55) results.push({ ref: p, score, matchedField: field });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  findItems(query: string, items: ErpItemRef[] = [], limit = 5): RagMatch<ErpItemRef>[] {
    const results: RagMatch<ErpItemRef>[] = [];
    for (const item of items) {
      const { score, field } = scoreAgainstFields(query, [
        { value: item.name, weight: 1, label: "name" },
        { value: item.nameNepali, weight: 0.95, label: "nameNepali" },
        { value: item.code, weight: 0.9, label: "code" },
      ]);
      if (score >= 0.55) results.push({ ref: item, score, matchedField: field });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  buildContextSummary(ctx: ErpRagContext, entities?: { party?: string; product?: string }): string {
    const parts: string[] = [];
    if (entities?.party && ctx.parties?.length) {
      const hits = this.findParties(entities.party, ctx.parties, 3);
      if (hits.length) {
        parts.push(
          `Parties: ${hits.map((h) => `${h.ref.name} (${(h.score * 100).toFixed(0)}%)`).join(", ")}`,
        );
      }
    }
    if (entities?.product && ctx.items?.length) {
      const hits = this.findItems(entities.product, ctx.items, 3);
      if (hits.length) {
        parts.push(
          `Items: ${hits.map((h) => {
            const stock = h.ref.stockQty != null ? ` stock=${h.ref.stockQty}` : "";
            return `${h.ref.name} @${h.ref.saleRate ?? "?"}${stock} (${(h.score * 100).toFixed(0)}%)`;
          }).join(", ")}`,
        );
      }
    }
    return parts.join("\n");
  }
}

export const erpRagRetriever = new ErpRagRetriever();

/** Compute live stock from opening + movements (matches store logic) */
export function computeItemStock(
  itemId: string,
  openingStock: number,
  movements: Array<{ itemId?: string; qty?: number }> = [],
): number {
  const relevant = movements.filter((m) => m.itemId === itemId);
  const totalIn = relevant.reduce((s, m) => s + (m.qty && m.qty > 0 ? m.qty : 0), 0);
  const totalOut = relevant.reduce(
    (s, m) => s + (m.qty && m.qty < 0 ? Math.abs(m.qty) : 0),
    0,
  );
  return (openingStock || 0) + totalIn - totalOut;
}

/** Normalize raw store parties/items into RAG refs */
function partyPhoneFromRaw(p: Record<string, unknown>): string | undefined {
  const raw =
    p.phone ?? p.mobile ?? p.mobileNo ?? p.contactNo ?? p.phoneNumber;
  return raw != null ? String(raw).trim() || undefined : undefined;
}

export function toErpRagContext(raw: {
  parties?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  stockMovements?: Array<{ itemId?: string; qty?: number }>;
  invoices?: Array<Record<string, unknown>>;
  accounts?: Array<Record<string, unknown>>;
  fiscalYear?: { name?: string; fiscalYearBS?: string; startDate?: string; endDate?: string };
}): ErpRagContext {
  const movements = raw.stockMovements ?? [];
  const recentInvoices = (raw.invoices ?? [])
    .map((inv) => ({
      id: String(inv.id ?? ""),
      invoiceNo: String(inv.invoiceNo ?? inv.voucherNo ?? ""),
      date: String(inv.date ?? ""),
      partyName: inv.partyName
        ? String(inv.partyName)
        : inv.customerName
          ? String(inv.customerName)
          : undefined,
      grandTotal: Number(inv.grandTotal ?? inv.amount ?? 0) || 0,
      type: String(inv.type ?? "sales-invoice"),
      status: inv.status ? String(inv.status) : undefined,
      lines: Array.isArray(inv.lines)
        ? (inv.lines as Array<Record<string, unknown>>).map((l) => ({
            itemName: l.itemName ? String(l.itemName) : undefined,
            itemId: l.itemId ? String(l.itemId) : undefined,
            rate: Number(l.rate ?? l.sellingPrice ?? 0) || undefined,
            qty: Number(l.qty ?? l.quantity ?? 0) || undefined,
          }))
        : undefined,
    }))
    .filter((inv) => inv.id && inv.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const accounts = raw.accounts ?? [];
  const findBal = (code: string) => {
    const acc = accounts.find((a) => String(a.code ?? "") === code);
    return acc != null ? Number(acc.balance ?? 0) : undefined;
  };

  const fiscalYear = resolveFiscalYear(raw.fiscalYear);
  const pnlSnapshot = recentInvoices.length
    ? computePnlFromInvoices(recentInvoices, "current_month", fiscalYear)
    : undefined;

  const partyLastInvoice = new Map<string, string>();
  for (const inv of recentInvoices) {
    if (!inv.partyName || !inv.date) continue;
    const prev = partyLastInvoice.get(inv.partyName);
    if (!prev || inv.date > prev) partyLastInvoice.set(inv.partyName, inv.date);
  }

  return {
    parties: (raw.parties ?? []).map((p) => {
      const name = String(p.name ?? "");
      return {
      id: String(p.id ?? ""),
      name,
      nameNepali: p.nameNepali ? String(p.nameNepali) : undefined,
      code: p.code ? String(p.code) : undefined,
      type: p.type ? String(p.type) : undefined,
      balance:
        typeof p.balance === "number"
          ? p.balance
          : Number(p.openingBalance ?? p.outstandingBalance ?? 0) || undefined,
      creditLimit:
        p.creditLimit != null
          ? Number(p.creditLimit) || undefined
          : undefined,
      creditDays:
        p.creditDays != null
          ? Number(p.creditDays) || undefined
          : undefined,
      lastInvoiceDate: partyLastInvoice.get(name),
      phone: partyPhoneFromRaw(p),
    };
    }),
    items: (raw.items ?? []).map((i) => {
      const id = String(i.id ?? "");
      const opening = Number(i.openingStock ?? 0) || 0;
      return {
        id,
        name: String(i.name ?? ""),
        nameNepali: i.nameNepali ? String(i.nameNepali) : (i as { name_ne?: string }).name_ne
          ? String((i as { name_ne?: string }).name_ne)
          : undefined,
        code: i.code ? String(i.code) : undefined,
        unit: i.unit ? String(i.unit) : undefined,
        saleRate: Number(i.saleRate ?? i.sellingPrice ?? i.rate ?? 0) || undefined,
        purchaseRate: Number(i.purchaseRate ?? i.costPrice ?? 0) || undefined,
        stockQty: computeItemStock(id, opening, movements),
        reorderLevel: i.reorderLevel != null ? Number(i.reorderLevel) : undefined,
      };
    }),
    recentInvoices,
    partyStats: computePartyStats(recentInvoices),
    businessInsights: computeBusinessInsights(recentInvoices),
    cashBalance: findBal("KH-CASH"),
    bankBalance: findBal("KH-BANK"),
    fiscalYear,
    pnlSnapshot,
  };
}
