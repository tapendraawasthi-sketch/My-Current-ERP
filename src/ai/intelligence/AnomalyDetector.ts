/** SUTRA AI — detect unusual amounts vs party history */

import type { ErpRagContext, ExtractedEntities } from "../types";

export interface AnomalyWarning {
  nepali: string;
  english: string;
  roman: string;
}

export class AnomalyDetector {
  detect(entities: ExtractedEntities, ctx?: ErpRagContext): AnomalyWarning | null {
    const amount = entities.amount;
    const party = entities.partyResolvedName ?? entities.party;
    if (!amount || amount <= 0 || !party || !ctx?.partyStats?.length) return null;

    const stats = ctx.partyStats.find((s) =>
      s.partyName.toLowerCase().includes(party.toLowerCase()),
    );
    if (!stats || stats.invoiceCount < 2 || stats.avgAmount <= 0) return null;

    const ratio = amount / stats.avgAmount;
    if (ratio < 4) return null;

    const avgLabel = stats.avgAmount.toLocaleString("en-NP");
    const amtLabel = amount.toLocaleString("en-NP");

    return {
      nepali: `⚠️ ${party} को औसत बिल Rs. ${avgLabel} हो — Rs. ${amtLabel} असामान्य देखिन्छ।`,
      english: `⚠️ ${party} average invoice is Rs. ${avgLabel} — Rs. ${amtLabel} looks unusual.`,
      roman: `⚠️ ${party} ko ausat bill Rs. ${avgLabel} ho — Rs. ${amtLabel} unusual cha.`,
    };
  }
}

export const anomalyDetector = new AnomalyDetector();
