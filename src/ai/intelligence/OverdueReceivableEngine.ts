/** SUTRA AI — overdue receivable detection from party balance + credit days */

import type { ErpPartyRef, ErpRagContext } from "../types";

export interface OverduePartyRow {
  partyId: string;
  name: string;
  balance: number;
  creditDays: number;
  lastInvoiceDate: string;
  daysOverdue: number;
}

const DEFAULT_CREDIT_DAYS = 30;

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export class OverdueReceivableEngine {
  scan(ctx?: ErpRagContext, asOf = new Date().toISOString().slice(0, 10)): OverduePartyRow[] {
    if (!ctx?.parties?.length) return [];

    const rows: OverduePartyRow[] = [];

    for (const party of ctx.parties) {
      const balance = party.balance ?? 0;
      if (balance <= 0 || !party.lastInvoiceDate) continue;

      const creditDays = party.creditDays ?? DEFAULT_CREDIT_DAYS;
      const dueDate = addDays(party.lastInvoiceDate, creditDays);
      if (asOf <= dueDate) continue;

      rows.push({
        partyId: party.id,
        name: party.name,
        balance,
        creditDays,
        lastInvoiceDate: party.lastInvoiceDate,
        daysOverdue: daysBetween(dueDate, asOf),
      });
    }

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);
  }

  totalOverdue(rows: OverduePartyRow[]): number {
    return rows.reduce((s, r) => s + r.balance, 0);
  }

  /** Supplier / creditor payables overdue (negative balance = we owe) */
  scanPayables(
    ctx?: ErpRagContext,
    asOf = new Date().toISOString().slice(0, 10),
    suppliersOnly = true,
  ): OverduePartyRow[] {
    if (!ctx?.parties?.length) return [];

    const rows: OverduePartyRow[] = [];

    for (const party of ctx.parties) {
      if (suppliersOnly) {
        const t = (party.type ?? "").toLowerCase();
        if (t && !t.includes("supplier") && !t.includes("both")) continue;
      }

      const balance = party.balance ?? 0;
      if (balance >= 0 || !party.lastInvoiceDate) continue;

      const creditDays = party.creditDays ?? DEFAULT_CREDIT_DAYS;
      const dueDate = addDays(party.lastInvoiceDate, creditDays);
      if (asOf <= dueDate) continue;

      rows.push({
        partyId: party.id,
        name: party.name,
        balance: Math.abs(balance),
        creditDays,
        lastInvoiceDate: party.lastInvoiceDate,
        daysOverdue: daysBetween(dueDate, asOf),
      });
    }

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);
  }
}

export const overdueReceivableEngine = new OverdueReceivableEngine();
