/** SUTRA AI — compact "what I understood" line for transactions */

import type { ExtractedEntities, IntentType, LanguageCode } from "../types";

export class TeachBackFormatter {
  shouldShow(intent?: IntentType, entities?: ExtractedEntities): boolean {
    if (!entities) return false;
    if (intent !== "SALES_ENTRY" && intent !== "PURCHASE_ENTRY") return false;
    return Boolean(
      (entities.product || entities.lines?.length) &&
        (entities.amount || entities.quantity),
    );
  }

  format(entities: ExtractedEntities, intent: IntentType | undefined, lang: LanguageCode): string {
    const product =
      entities.productEnglish ?? entities.product ?? entities.lines?.[0]?.product ?? "—";
    const amt = entities.amount
      ? `Rs. ${entities.amount.toLocaleString("en-NP")}`
      : entities.quantity
        ? `${entities.quantity} ${entities.unit ?? ""}`.trim()
        : "—";
    const party = entities.partyResolvedName ?? entities.party;
    const tx =
      intent === "PURCHASE_ENTRY" || entities.transactionType === "purchase"
        ? "खरिद"
        : "बिक्री";

    if (lang === "english") {
      let line = `📋 Understood: ${product} ${amt}${party ? ` → ${party}` : ""} (${intent === "PURCHASE_ENTRY" ? "purchase" : "sale"})`;
      if (entities.vatBreakdown) {
        line += ` · VAT Rs.${entities.vatBreakdown.vat}`;
      }
      return line;
    }
    if (lang === "roman") {
      let line = `📋 Bujheko: ${product} ${amt}${party ? ` → ${party}` : ""} (${tx})`;
      if (entities.vatBreakdown) {
        line += ` · VAT Rs.${entities.vatBreakdown.vat}`;
      }
      return line;
    }
    let line = `📋 बुझेको: ${product} ${amt}${party ? ` → ${party}` : ""} (${tx})`;
    if (entities.vatBreakdown) {
      line += ` · VAT Rs.${entities.vatBreakdown.vat}`;
    }
    return line;
  }
}

export const teachBackFormatter = new TeachBackFormatter();
