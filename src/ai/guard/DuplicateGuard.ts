/** SUTRA AI — warn on duplicate khata/invoice entries today */

import { checkTodayDuplicate } from "@/lib/ekhata/dexieBridge";
import type { ExtractedEntities, IntentClassification } from "../types";

export interface DuplicateWarning {
  nepali: string;
  english: string;
  roman: string;
  voucherNo?: string;
}

export class DuplicateGuard {
  async check(
    entities: ExtractedEntities,
    intent?: IntentClassification,
  ): Promise<DuplicateWarning | null> {
    const isPayment =
      entities.transactionType === "payment" ||
      entities.transactionType === "receipt";

    const isTxn =
      intent?.intent === "SALES_ENTRY" ||
      intent?.intent === "PURCHASE_ENTRY" ||
      entities.transactionType === "sales" ||
      entities.transactionType === "purchase" ||
      isPayment;

    if (!isTxn) return null;

    const party = entities.partyResolvedName ?? entities.party;
    const amount = entities.amount;
    if (!party || amount == null || amount <= 0) return null;

    let entryType: string;
    if (isPayment) {
      entryType =
        entities.transactionType === "receipt" ? "khata_payment_in" : "khata_payment_out";
    } else {
      entryType =
        entities.transactionType === "purchase" || intent?.intent === "PURCHASE_ENTRY"
          ? "khata_purchase"
          : "khata_sales";
    }

    try {
      const dup = await checkTodayDuplicate(party, amount, entryType);
      if (!dup.duplicate) return null;

      const vno = dup.match?.voucherNo;
      const kind = isPayment
        ? entities.transactionType === "receipt"
          ? "प्राप्ति"
          : "भुक्तानी"
        : "entry";
      return {
        voucherNo: vno,
        nepali: `⚠️ आजै ${party} को Rs. ${amount.toLocaleString("en-NP")} को ${kind} छ${vno ? ` (${vno})` : ""} — दोहोर्याउनुहोस्?`,
        english: `⚠️ Today already has ${party} Rs. ${amount.toLocaleString("en-NP")} ${kind}${vno ? ` (${vno})` : ""} — duplicate?`,
        roman: `⚠️ Aaja nai ${party} ko Rs. ${amount.toLocaleString("en-NP")} ${kind} cha — duplicate?`,
      };
    } catch {
      return null;
    }
  }
}

export const duplicateGuard = new DuplicateGuard();
