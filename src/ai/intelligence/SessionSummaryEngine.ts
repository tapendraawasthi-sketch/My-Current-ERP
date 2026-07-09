/** SUTRA AI — session summary before /clear */

import type { ConversationTurn, LanguageCode, SessionState } from "../types";

export class SessionSummaryEngine {
  build(
    turns: ConversationTurn[],
    session: SessionState,
    lang: LanguageCode = "nepali",
  ): string | null {
    if (turns.length < 2 && session.turnCount < 2) return null;

    const userTurns = turns.filter((t) => t.role === "user").slice(-5);
    const topics: string[] = [];

    if (session.lastParty) topics.push(`party: ${session.lastParty}`);
    if (session.lastProduct) topics.push(`item: ${session.lastProduct}`);
    if (session.lastAmount != null) topics.push(`amount: Rs. ${session.lastAmount.toLocaleString("en-NP")}`);
    if (session.lastIntent) topics.push(`last intent: ${session.lastIntent}`);

    const recent = userTurns.map((t) => t.content.slice(0, 60)).join(" · ");

    if (lang === "english") {
      return (
        `Session summary (${session.turnCount} turns):\n` +
        (topics.length ? `${topics.join(" · ")}\n` : "") +
        (recent ? `Recent: ${recent}` : "")
      );
    }

    if (lang === "roman") {
      return (
        `Session summary (${session.turnCount} turns):\n` +
        (topics.length ? `${topics.join(" · ")}\n` : "") +
        (recent ? `Recent: ${recent}` : "")
      );
    }

    return (
      `यो सत्रको सार (${session.turnCount} turns):\n` +
      (session.lastParty ? `• पार्टी: ${session.lastParty}\n` : "") +
      (session.lastProduct ? `• सामान: ${session.lastProduct}\n` : "") +
      (session.lastAmount != null
        ? `• रकम: Rs. ${session.lastAmount.toLocaleString("en-NP")}\n`
        : "") +
      (recent ? `• हाल: ${recent.slice(0, 120)}` : "")
    );
  }
}

export const sessionSummaryEngine = new SessionSummaryEngine();
