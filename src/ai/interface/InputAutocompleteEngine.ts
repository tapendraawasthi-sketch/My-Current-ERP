/** SUTRA AI — predictive phrase suggestions as user types (Sprint 13 ranked) */

import type { SessionState } from "../types";
import { userProfileManager } from "../knowledge/UserProfileManager";

export interface AutocompleteSuggestion {
  text: string;
  category: "transaction" | "query" | "report" | "stock" | "phrase";
  score: number;
}

export interface AutocompleteContext {
  products?: string[];
  parties?: string[];
  session?: SessionState;
  phraseWeights?: Record<string, number>;
  recentPhrases?: string[];
  limit?: number;
}

const BASE_PHRASES: Array<{ text: string; category: AutocompleteSuggestion["category"] }> = [
  { text: "maile 500 ko kakro bechye", category: "transaction" },
  { text: "maile 2 kg aalu kinya", category: "transaction" },
  { text: "ram lai 300 ko pyaj udhaar", category: "transaction" },
  { text: "ram ko balance kati", category: "query" },
  { text: "shyam ko baki kati cha", category: "query" },
  { text: "ram ra shyam ko balance", category: "query" },
  { text: "kakro kati baki cha", category: "stock" },
  { text: "kam stock ke ke cha", category: "stock" },
  { text: "aaja ko bikri kati", category: "report" },
  { text: "yo mahina ko profit", category: "report" },
  { text: "trial balance", category: "report" },
  { text: "hijo ko entry", category: "query" },
  { text: "aaja ko entry", category: "query" },
];

function scoreMatch(partial: string, candidate: string): number {
  const p = partial.toLowerCase().trim();
  const c = candidate.toLowerCase();
  if (!p || !c) return 0;
  if (c.startsWith(p)) return 0.95;
  if (c.includes(p)) return 0.78;
  const words = p.split(/\s+/);
  const matched = words.filter((w) => c.includes(w)).length;
  if (matched > 0) return 0.55 + (matched / words.length) * 0.2;
  return 0;
}

function sessionBoost(text: string, session?: SessionState): number {
  if (!session) return 0;
  let boost = 0;
  const lower = text.toLowerCase();
  if (session.lastParty && lower.includes(session.lastParty.toLowerCase())) boost += 0.12;
  if (session.lastProduct && lower.includes(session.lastProduct.toLowerCase())) boost += 0.12;
  for (const topic of session.topicStack ?? []) {
    if (topic === "sales" && /\b(bech|bikri)\b/i.test(lower)) boost += 0.06;
    if (topic === "reports" && /\b(report|bikri|profit)\b/i.test(lower)) boost += 0.06;
  }
  if (session.awaiting === "amount" && /\b\d+\b/.test(lower)) boost += 0.08;
  return Math.min(boost, 0.2);
}

function usageBoost(text: string, weights?: Record<string, number>): number {
  if (!weights) return 0;
  const key = text.toLowerCase().trim();
  const count = weights[key] ?? 0;
  if (!count) return 0;
  return Math.min(0.18, count * 0.025);
}

function buildDynamicPhrases(
  products: string[],
  parties: string[],
): AutocompleteSuggestion[] {
  const out: AutocompleteSuggestion[] = [];
  for (const product of products.slice(0, 8)) {
    out.push(
      { text: `maile 500 ko ${product} bechye`, category: "transaction", score: 0.7 },
      { text: `${product} kati baki cha`, category: "stock", score: 0.68 },
    );
  }
  for (const party of parties.slice(0, 8)) {
    out.push(
      { text: `${party} ko balance kati`, category: "query", score: 0.72 },
      { text: `${party} lai udhaar`, category: "transaction", score: 0.65 },
    );
  }
  return out;
}

export function getAutocompleteSuggestions(
  partial: string,
  opts?: AutocompleteContext,
): AutocompleteSuggestion[] {
  const trimmed = partial.trim();
  if (trimmed.length < 2) return [];

  const profile = userProfileManager.getProfile();
  const products = [
    ...new Set([...(opts?.products ?? []), ...profile.commonProducts]),
  ];
  const parties = [
    ...new Set([...(opts?.parties ?? []), ...profile.commonParties]),
  ];

  const recentPool: AutocompleteSuggestion[] = (opts?.recentPhrases ?? []).map((p) => ({
    text: p,
    category: "phrase" as const,
    score: 0.75,
  }));

  const pool: AutocompleteSuggestion[] = [
    ...BASE_PHRASES.map((p) => {
      const base = scoreMatch(trimmed, p.text);
      const boosted =
        base +
        sessionBoost(p.text, opts?.session) +
        usageBoost(p.text, opts?.phraseWeights);
      return { ...p, score: boosted };
    }),
    ...buildDynamicPhrases(products, parties).map((p) => {
      const base = Math.max(p.score, scoreMatch(trimmed, p.text));
      const boosted =
        base +
        sessionBoost(p.text, opts?.session) +
        usageBoost(p.text, opts?.phraseWeights);
      return { ...p, score: boosted };
    }),
    ...recentPool.map((p) => ({
      ...p,
      score: Math.max(p.score, scoreMatch(trimmed, p.text)) + usageBoost(p.text, opts?.phraseWeights),
    })),
  ];

  const seen = new Set<string>();
  return pool
    .filter((s) => s.score >= 0.55 && !seen.has(s.text) && (seen.add(s.text), true))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts?.limit ?? 6);
}
