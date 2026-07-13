/**
 * Configured withholding helper (Phase 9).
 * Reads tdsRates / company settings when present. Does NOT invent Nepal statutory rates.
 */

import { getDB } from "@/lib/db";
import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";
import type { MoneyString } from "./types";

export interface WithholdingRequest {
  companyId: string;
  transactionDate: string;
  partyId?: string | null;
  transactionType: "receipt" | "payment" | "sales" | "purchase" | string;
  grossSettlement: MoneyString | number;
  ruleId?: string | null;
}

export interface WithholdingResult {
  withholding_amount: MoneyString;
  withholding_paisa: number;
  rate_percent: number;
  rule_id: string | null;
  rule_version: string;
  section: string | null;
}

function rateFromRow(row: any): number {
  const raw = row?.rate ?? row?.tdsRate ?? row?.percent ?? row?.percentage;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function applyConfiguredWithholding(
  req: WithholdingRequest,
): Promise<WithholdingResult> {
  const db = getDB();
  const grossPaisa = parseMoneyToPaisa(req.grossSettlement);

  let rule: any = null;
  let ruleVersion = "none";

  try {
    if (req.ruleId && (db as any).tdsNatureOfPayment) {
      rule = await (db as any).tdsNatureOfPayment.get(req.ruleId);
    }
    if (!rule && (db as any).tdsNatureOfPayment) {
      const rows = await (db as any).tdsNatureOfPayment.toArray();
      rule =
        rows.find((r: any) => r.isActive !== false && String(r.id || "") === String(req.ruleId || "")) ||
        rows.find((r: any) => r.isActive !== false && r.isDefault) ||
        null;
    }
  } catch {
    rule = null;
  }

  if (!rule) {
    try {
      const settings = (await db.companySettings.get("main")) as any;
      const cfg = settings?.withholding || settings?.tds || settings?.tdsRates;
      if (cfg && typeof cfg === "object") {
        const keyed =
          (req.ruleId && cfg[req.ruleId]) ||
          cfg[req.transactionType] ||
          cfg.default ||
          null;
        if (keyed && (keyed.rate != null || keyed.percent != null)) {
          rule = keyed;
          ruleVersion = String(keyed.version || keyed.rule_version || "company_settings");
        }
      }
    } catch {
      /* no config */
    }
  } else {
    ruleVersion = String(rule.version || rule.ruleVersion || rule.updatedAt || rule.id || "configured");
  }

  if (!rule) {
    return {
      withholding_amount: "0.00",
      withholding_paisa: 0,
      rate_percent: 0,
      rule_id: null,
      rule_version: "none",
      section: null,
    };
  }

  const rate = rateFromRow(rule);
  const withholdingPaisa = Math.round((grossPaisa * rate) / 100);
  return {
    withholding_amount: paisaToString(withholdingPaisa),
    withholding_paisa: withholdingPaisa,
    rate_percent: rate,
    rule_id: String(rule.id || req.ruleId || "") || null,
    rule_version: ruleVersion,
    section: rule.section || rule.tdsSection || null,
  };
}