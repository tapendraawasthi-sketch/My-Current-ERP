/** SUTRA AI — async ERP enrichment via Dexie bridge (khata, P&L, trial balance) */

import { computePnL, getPartyBalance, getTrialBalance, searchEntries } from "@/lib/ekhata/dexieBridge";
import type { ErpRagContext, ExtractedEntities } from "../types";
import { khataQueryHandler } from "./KhataQueryHandler";
import { reportQueryHandler } from "./ReportQueryHandler";

export class KhataRagProvider {
  async enrich(
    ctx: ErpRagContext | undefined,
    entities: ExtractedEntities,
    text: string,
  ): Promise<ErpRagContext | undefined> {
    if (!ctx) return ctx;

    const next: ErpRagContext = { ...ctx };

    const partyName = entities.partyResolvedName ?? entities.party;
    if (partyName) {
      try {
        const bal = await getPartyBalance(partyName);
        if (bal.transactionCount > 0) {
          next.khataPartyBalance = bal;
        }
      } catch {
        // Dexie unavailable (tests / SSR)
      }
    }

    if (khataQueryHandler.isKhataQuery(text)) {
      try {
        const query = partyName ?? entities.product ?? text.split(/\s+/).slice(0, 4).join(" ");
        const daysBack = /\bhijo\b/i.test(text) ? 2 : /\baaja\b/i.test(text) ? 1 : 14;
        const entries = await searchEntries(query, daysBack);
        if (entries.length) {
          next.recentKhata = entries.slice(0, 8).map((e) => ({
            id: e.id,
            date: e.date,
            narration: e.narration,
            amount: e.amount,
            party: e.party,
            intent: e.intent,
            voucherNo: e.voucherNo,
          }));
        }
      } catch {
        // Dexie unavailable
      }
    }

    if (reportQueryHandler.isReportQuery(text)) {
      try {
        if (reportQueryHandler.isTrialBalanceQuery(text)) {
          const tb = await getTrialBalance();
          next.trialBalance = {
            totalDebit: tb.totalDebit,
            totalCredit: tb.totalCredit,
            isBalanced: tb.isBalanced,
            rowCount: tb.rows.length,
          };
        } else {
          const period = reportQueryHandler.detectPeriod(text);
          const pnl = await computePnL(period);
          next.pnlSnapshot = { period, ...pnl };
        }
      } catch {
        // Dexie unavailable
      }
    }

    return next;
  }
}

export const khataRagProvider = new KhataRagProvider();
