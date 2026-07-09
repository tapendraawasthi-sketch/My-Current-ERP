/** SUTRA AI — proactive ERP alerts (low stock, high receivables, overdue) */

import type { ErpProactiveAlert, ErpRagContext } from "../types";
import { overdueReceivableEngine } from "./OverdueReceivableEngine";

const RECEIVABLE_WARN = 25_000;
const PAYABLE_WARN = 15_000;

export class ProactiveAlertEngine {
  scan(ctx?: ErpRagContext, limit = 5): ErpProactiveAlert[] {
    if (!ctx) return [];

    const alerts: ErpProactiveAlert[] = [];

    for (const item of ctx.items ?? []) {
      if (item.reorderLevel == null) continue;
      const qty = item.stockQty ?? 0;
      if (qty > item.reorderLevel) continue;

      const severity: ErpProactiveAlert["severity"] = qty <= 0 ? "danger" : "warning";
      alerts.push({
        id: `stk-${item.id}`,
        severity,
        nepali: `${item.name}: ${qty} ${item.unit ?? "units"} बाँकी (reorder ${item.reorderLevel})`,
        english: `${item.name}: ${qty} ${item.unit ?? "units"} left (reorder at ${item.reorderLevel})`,
        roman: `${item.name}: ${qty} ${item.unit ?? "units"} baki (reorder ${item.reorderLevel})`,
      });
    }

    for (const party of ctx.parties ?? []) {
      const bal = party.balance ?? 0;
      if (bal >= RECEIVABLE_WARN) {
        alerts.push({
          id: `rcv-${party.id}`,
          severity: "info",
          nepali: `${party.name} बाट लिन बाँकी: Rs. ${bal.toLocaleString("en-NP")}`,
          english: `Receivable from ${party.name}: Rs. ${bal.toLocaleString("en-NP")}`,
          roman: `${party.name} bata lin baki: Rs. ${bal.toLocaleString("en-NP")}`,
        });
      } else if (bal <= -PAYABLE_WARN) {
        alerts.push({
          id: `pay-${party.id}`,
          severity: "warning",
          nepali: `${party.name} लाई दिन बाँकी: Rs. ${Math.abs(bal).toLocaleString("en-NP")}`,
          english: `Payable to ${party.name}: Rs. ${Math.abs(bal).toLocaleString("en-NP")}`,
          roman: `${party.name} lai din baki: Rs. ${Math.abs(bal).toLocaleString("en-NP")}`,
        });
      }
    }

    for (const row of overdueReceivableEngine.scan(ctx)) {
      if (row.daysOverdue < 7) continue;
      alerts.push({
        id: `od-${row.partyId}`,
        severity: row.daysOverdue >= 30 ? "danger" : "warning",
        nepali: `${row.name}: ${row.daysOverdue} दिन ढिला · Rs. ${row.balance.toLocaleString("en-NP")}`,
        english: `${row.name}: ${row.daysOverdue}d overdue · Rs. ${row.balance.toLocaleString("en-NP")}`,
        roman: `${row.name}: ${row.daysOverdue} din dhila · Rs. ${row.balance.toLocaleString("en-NP")}`,
      });
    }

    const order = { danger: 0, warning: 1, info: 2 };
    return alerts
      .sort((a, b) => order[a.severity] - order[b.severity])
      .slice(0, limit);
  }

  formatBanner(alerts: ErpProactiveAlert[], lang: "nepali" | "english" | "roman"): string {
    if (!alerts.length) return "";
    const lines = alerts.map((a) =>
      lang === "english" ? a.english : lang === "roman" ? a.roman : a.nepali,
    );
    return lines.join("\n");
  }
}

export const proactiveAlertEngine = new ProactiveAlertEngine();
