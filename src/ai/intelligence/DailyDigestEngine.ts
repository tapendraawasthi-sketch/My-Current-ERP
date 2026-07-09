/** SUTRA AI — daily business digest on panel open (v2) */

import type { ErpRagContext, LanguageCode } from "../types";
import { proactiveAlertEngine } from "./ProactiveAlertEngine";
import { overdueReceivableEngine } from "./OverdueReceivableEngine";

function formatAmount(n: number): string {
  return `Rs. ${Math.abs(n).toLocaleString("en-NP")}`;
}

export interface DailyDigest {
  nepali: string;
  english: string;
  roman: string;
}

export class DailyDigestEngine {
  build(ctx?: ErpRagContext, lang: LanguageCode = "nepali"): DailyDigest | null {
    if (!ctx) return null;

    const insights = ctx.businessInsights;
    const alerts = proactiveAlertEngine.scan(ctx, 5);
    const lowStock = alerts.filter((a) => a.id.startsWith("stk-")).length;
    const highRecv = alerts.filter((a) => a.id.startsWith("rcv-")).length;
    const overdueCount = overdueReceivableEngine.scan(ctx).length;

    const todaySales = insights?.todaySalesTotal ?? 0;
    const todayBills = insights?.todayInvoiceCount ?? 0;
    const topParty = insights?.topParties?.[0];
    const monthProfit = ctx.pnlSnapshot?.netProfit;
    const cash = ctx.cashBalance;
    const bank = ctx.bankBalance;

    const extraNepali: string[] = [];
    const extraEnglish: string[] = [];
    const extraRoman: string[] = [];

    if (monthProfit != null) {
      extraNepali.push(`• यो महिना नाफा: ${formatAmount(monthProfit)}`);
      extraEnglish.push(`• Month profit: ${formatAmount(monthProfit)}`);
      extraRoman.push(`• Mahina nafa: ${formatAmount(monthProfit)}`);
    }
    if (cash != null) {
      extraNepali.push(`• क्यास: ${formatAmount(cash)}`);
      extraEnglish.push(`• Cash: ${formatAmount(cash)}`);
      extraRoman.push(`• Cash: ${formatAmount(cash)}`);
    }
    if (bank != null) {
      extraNepali.push(`• बैंक: ${formatAmount(bank)}`);
      extraEnglish.push(`• Bank: ${formatAmount(bank)}`);
      extraRoman.push(`• Bank: ${formatAmount(bank)}`);
    }
    if (overdueCount > 0) {
      extraNepali.push(`• ढिला udhaar: ${overdueCount} पार्टी`);
      extraEnglish.push(`• Overdue receivables: ${overdueCount} parties`);
      extraRoman.push(`• Dhila udhaar: ${overdueCount} party`);
    }

    const nepali =
      `आजको सारांश:\n` +
      `• बिक्री: ${formatAmount(todaySales)} (${todayBills} बिल)\n` +
      (topParty ? `• शीर्ष पार्टी: ${topParty.partyName}\n` : "") +
      (lowStock > 0 ? `• कम स्टक: ${lowStock} वस्तु\n` : "") +
      (highRecv > 0 ? `• उच्च receivable: ${highRecv} पार्टी\n` : "") +
      extraNepali.join("\n");

    const english =
      `Today's digest:\n` +
      `• Sales: ${formatAmount(todaySales)} (${todayBills} invoices)\n` +
      (topParty ? `• Top party: ${topParty.partyName}\n` : "") +
      (lowStock > 0 ? `• Low stock: ${lowStock} items\n` : "") +
      (highRecv > 0 ? `• High receivables: ${highRecv} parties\n` : "") +
      extraEnglish.join("\n");

    const roman =
      `Aajko summary:\n` +
      `• Bikri: ${formatAmount(todaySales)} (${todayBills} bills)\n` +
      (lowStock > 0 ? `• Kam stock: ${lowStock}\n` : "") +
      extraRoman.join("\n");

    const hasActivity =
      todaySales > 0 ||
      todayBills > 0 ||
      lowStock > 0 ||
      highRecv > 0 ||
      overdueCount > 0 ||
      monthProfit != null ||
      cash != null ||
      bank != null;

    if (!hasActivity) return null;

    return {
      nepali,
      english,
      roman,
    };
  }

  format(digest: DailyDigest, lang: LanguageCode): string {
    if (lang === "english") return digest.english;
    if (lang === "roman") return digest.roman;
    return digest.nepali;
  }
}

export const dailyDigestEngine = new DailyDigestEngine();
