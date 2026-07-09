/**
 * Tier 0 — instant local answers from Dexie (no LLM).
 * Runs before report engine and Qwen stream.
 */

import { buildSessionSnapshot, getPartyBalance } from "./dexieBridge";

export interface OrbixLocalResult {
  text: string;
  kind: "entry_count" | "party_balance" | "cash_bank" | "recent_entries";
}

const TODAY_ENTRY = /\b(aaja|aaj|today).*(entry|prawisti|प्रविष्टि)|entry\s*vayo|kunai\s*entry|kati\s*entry|aajako\s*entry/i;
const YESTERDAY_ENTRY = /\b(hijo|yesterday).*(entry|prawisti)/i;
const CASH_Q = /\b(cash|nagad|नगद)\s*(kati|balance|baki)?/i;
const BANK_Q = /\b(bank)\s*(balance|kati)?/i;
const PARTY_BAKI = /(\w{2,})\s+ko\s+(baki|balance|khata|udhaar)/i;

function fmt(n: number): string {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function handleOrbixLocalQuery(text: string): Promise<OrbixLocalResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const today = new Date().toISOString().slice(0, 10);
  const snapshot = await buildSessionSnapshot();
  const recent = (snapshot.recent_entries as Array<Record<string, unknown>>) || [];

  if (TODAY_ENTRY.test(trimmed)) {
    const count = Number(snapshot.today_entry_count ?? 0);
    const todayRows = recent.filter((e) => String(e.date) === today);
    if (count === 0) {
      return { text: "Aaja kunai entry vayeko chaina (0 wota).", kind: "entry_count" };
    }
    const lines = todayRows.slice(0, 5).map((e) => {
      const party = String(e.party || "—");
      const amt = fmt(Number(e.amount || 0));
      return `- ${party}: ${amt}`;
    });
    const detail = lines.length ? `\n${lines.join("\n")}` : "";
    return {
      text: `Aaja ${count} wota entry vayo.${detail}`,
      kind: "entry_count",
    };
  }

  if (YESTERDAY_ENTRY.test(trimmed)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const rows = recent.filter((e) => String(e.date) === yesterday);
    return {
      text: rows.length
        ? `Hijo ${rows.length} wota entry thiyo.`
        : "Hijo kunai entry vayeko chaina.",
      kind: "entry_count",
    };
  }

  if (CASH_Q.test(trimmed)) {
    return {
      text: `Cash balance: ${fmt(Number(snapshot.cash_balance || 0))}.`,
      kind: "cash_bank",
    };
  }

  if (BANK_Q.test(trimmed)) {
    return {
      text: `Bank balance: ${fmt(Number(snapshot.bank_balance || 0))}.`,
      kind: "cash_bank",
    };
  }

  const partyMatch = trimmed.match(PARTY_BAKI);
  if (partyMatch?.[1]) {
    const party = partyMatch[1];
    if (!["ko", "aaja", "hijo", "cash", "bank"].includes(party.toLowerCase())) {
      try {
        const bal = await getPartyBalance(party);
        const net = bal.netBalance;
        const label =
          net > 0
            ? `${bal.party} ko baki (receivable): ${fmt(net)}`
            : net < 0
              ? `${bal.party} lai dini: ${fmt(Math.abs(net))}`
              : `${bal.party} ko baki: ${fmt(0)}`;
        return { text: `${label}.`, kind: "party_balance" };
      } catch {
        return null;
      }
    }
  }

  return null;
}
