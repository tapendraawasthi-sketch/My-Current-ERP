/**
 * Tier 0 — instant local answers from Dexie (no LLM).
 * Runs before report engine and Qwen stream.
 */

import { buildSessionSnapshot, getPartyBalance } from "./dexieBridge";

export type SessionSnapshot = Awaited<ReturnType<typeof buildSessionSnapshot>>;

export interface OrbixLocalResult {
  text: string;
  kind: "entry_count" | "party_balance" | "cash_bank" | "recent_entries";
}

const TODAY_ENTRY = /\b(aaja|aaj|today).*(entry|prawisti|प्रविष्टि)|entry\s*vayo|kunai\s*entry|kati\s*entry|aajako\s*entry/i;
const YESTERDAY_ENTRY = /\b(hijo|yesterday).*(entry|prawisti)/i;
const CASH_Q = /\b(cash|nagad|नगद)\s+(kati|balance|baki)\b/i;
const BANK_Q = /\b(bank)\s+(balance|kati)\b|\b(bank\s*balance|cash\s*balance)\b/i;
const PARTY_BAKI = /(\w{2,})\s+ko\s+(baki|balance|khata|udhaar)/i;
/** Mutations must reach Orbix draft/preview — never answer as a balance lookup. */
const MUTATION_SIGNAL =
  /\b(return(?:ed|ing)?|firta|refund|credit\s*note|debit\s*note|sold|sell(?:ing)?|sale|bought|purchase|record|post|enter|invoice\s+(?:SI-|PI-)|received|receipt|paid|payment|deposit|withdraw(?:al)?|transfer|contra|journal|advance|withholding|adjust)\b/i;

function fmt(n: number): string {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function handleOrbixLocalQuery(
  text: string,
  snapshot?: SessionSnapshot,
): Promise<OrbixLocalResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Sales returns / refunds / sales often contain the word "cash" or "bank"
  // without being a balance inquiry (e.g. "refund the customer in cash").
  if (MUTATION_SIGNAL.test(trimmed)) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const data = snapshot ?? (await buildSessionSnapshot());
  const recent = (data.recent_entries as Array<Record<string, unknown>>) || [];

  if (TODAY_ENTRY.test(trimmed)) {
    const count = Number(data.today_entry_count ?? 0);
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
      text: `Cash balance: ${fmt(Number(data.cash_balance || 0))}.`,
      kind: "cash_bank",
    };
  }

  if (BANK_Q.test(trimmed)) {
    return {
      text: `Bank balance: ${fmt(Number(data.bank_balance || 0))}.`,
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
