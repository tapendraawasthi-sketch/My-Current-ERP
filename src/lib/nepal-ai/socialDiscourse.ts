/**
 * Nepal Universal AI — social discourse (greeting / thanks / goodbye / small talk / politeness).
 * These are human conversation, NEVER transactions and NOT accounting questions.
 */

import {
  SOCIAL_DISCOURSE_PHRASES,
  type SocialDiscoursePhrase,
} from "./generated/runtimeMaps";

export type SocialDiscourseType =
  | "greeting"
  | "thanks"
  | "goodbye"
  | "small_talk"
  | "politeness"
  | string;

export interface SocialDiscourseMatch {
  phrase: SocialDiscoursePhrase;
  score: number;
  reply: string;
}

function normalizeSocial(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!।.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPick(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return n <= 0 ? 0 : h % n;
}

/**
 * Match user text against social discourse lexicon.
 * Exact input wins; otherwise allow short containing matches for longer canned phrases.
 */
export function matchSocialDiscourse(text: string): SocialDiscourseMatch | null {
  const t = normalizeSocial(text);
  if (!t) return null;

  let best: { phrase: SocialDiscoursePhrase; score: number } | null = null;

  for (const phrase of SOCIAL_DISCOURSE_PHRASES) {
    const input = normalizeSocial(phrase.input);
    if (!input) continue;

    let score = 0;
    if (t === input) {
      score = 1000 + input.length;
    } else if (t.length <= 48 && (t.includes(input) || input.includes(t))) {
      // Prefer the more specific (longer) canned phrase when overlapping
      const overlap = Math.min(t.length, input.length);
      const coverage = overlap / Math.max(t.length, input.length);
      if (coverage >= 0.85) {
        score = 400 + input.length;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { phrase, score };
    }
  }

  if (!best) return null;

  const replies = best.phrase.appropriateResponses;
  const reply =
    replies.length > 0 ? replies[hashPick(t + best.phrase.id, replies.length)] : "";

  return { phrase: best.phrase, score: best.score, reply };
}

export function isSocialDiscourseUtterance(text: string): boolean {
  return matchSocialDiscourse(text) !== null;
}

/** Pick a canned reply when matched; null if not social. */
export function replySocialDiscourse(text: string): string | null {
  const m = matchSocialDiscourse(text);
  return m?.reply || null;
}

export function socialDiscourseType(text: string): SocialDiscourseType | null {
  return matchSocialDiscourse(text)?.phrase.type ?? null;
}
