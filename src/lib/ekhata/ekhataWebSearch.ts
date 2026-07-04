/**
 * e-Khata Real Web Search — Wikipedia-first, no broken proxies.
 * Works in browser (CORS-safe) and server.
 */

import { understandAccountingLanguage } from "./accountingLanguageBrain";

export interface RealSearchResult {
  answer: string;
  title: string;
  url?: string;
  source: "wikipedia" | "duckduckgo" | "lexicon";
}

/** Accounting lexicon lookup before hitting Wikipedia (avoids mythological sampatti etc.) */
function tryAccountingLexicon(query: string): RealSearchResult | null {
  const accounting = understandAccountingLanguage(query);
  if (accounting.kind !== "answer" || accounting.confidence < 0.55) {
    return null;
  }
  return {
    answer: accounting.reply,
    title: "e-Khata Accounting",
    source: "lexicon",
  };
}

/** Prefix accounting queries so Wikipedia returns accounting definitions, not unrelated topics */
function accountingSearchQuery(query: string): string {
  const lower = query.toLowerCase();
  if (/\b(accounting|ifrs|nas|nfrs|debit|credit|ledger|vat|tds|ssf|asset|liability|equity)\b/i.test(lower)) {
    return query;
  }
  return `accounting definition Nepal ${query}`;
}

export function expandSearchQueries(text: string): string[] {
  const t = text.toLowerCase().replace(/\?+$/, "").trim();
  const queries: string[] = [];

  // PM / president / capital shortcuts
  if (/\bpm\s+of\s+nepal\b|\bprime\s+minister\s+of\s+nepal\b|\bnepal\s+ko\s+pm\b|\bnepal\s+pm\b/i.test(t)) {
    queries.push("Prime Minister of Nepal");
  }
  if (/\bpresident\s+of\s+nepal\b|\bnepal\s+ko\s+president\b/i.test(t)) {
    queries.push("President of Nepal");
  }
  if (/\bcapital\s+of\s+nepal\b|\bnepal\s+ko\s+rajdhani\b|\bnepal\s+capital\b/i.test(t)) {
    queries.push("Kathmandu");
  }

  // who is X → X
  const whoMatch = t.match(/\bwho\s+is\s+(?:the\s+)?(.+)/i);
  if (whoMatch) {
    let subject = whoMatch[1].trim();
    if (/\bpm\b/.test(subject) && /\bnepal\b/.test(subject)) {
      queries.push("Prime Minister of Nepal");
    }
    subject = subject.replace(/\bpm\b/gi, "Prime Minister");
    queries.push(subject);
  }

  // what is X → X
  const whatMatch = t.match(/\bwhat\s+is\s+(?:the\s+)?(.+)/i);
  if (whatMatch) queries.push(whatMatch[1].trim());

  // where is X
  const whereMatch = t.match(/\bwhere\s+is\s+(?:the\s+)?(.+)/i);
  if (whereMatch) queries.push(whereMatch[1].trim());

  // Original cleaned
  const cleaned = t
    .replace(/\b(k\s*ho|ke\s*ho|bhannu|sodh|please|tell\s+me|search\s+for)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 3) queries.push(cleaned);

  return [...new Set(queries.filter((q) => q.length > 2))];
}

async function wikiOpensearch(query: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const titles: string[] = data[1] ?? [];
    return titles[0] ?? null;
  } catch {
    return null;
  }
}

async function wikiExtract(title: string): Promise<{ extract: string; url: string } | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title.replace(/ /g, "_"))}&prop=extracts&explaintext=1&exchars=2500&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0] as { extract?: string; title?: string; missing?: string };
    if (!page || page.missing || !page.extract) return null;
    return {
      extract: page.extract,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title ?? title).replace(/ /g, "_"))}`,
    };
  } catch {
    return null;
  }
}

/** Extract the most relevant sentence(s) for a factual answer */
function extractAnswerSnippet(extract: string, query: string): string {
  const sentences = extract.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);

  const isWho = /\bwho\s+is\b/i.test(query);
  const isPm = /\bpm\b|prime\s+minister/i.test(query);

  if (isWho || isPm) {
    const officeHolder = sentences.find((s) =>
      /\b(serving|incumbent|has been|currently|is the (?:current|acting|interim)?\s*(?:prime minister|president|chief|leader))\b/i.test(
        s,
      ),
    );
    if (officeHolder) return officeHolder.trim();

    const named = sentences.find(
      (s) =>
        /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(s) &&
        /\b(since|from|appointed|elected|sworn)\b/i.test(s),
    );
    if (named) return named.trim();
  }

  return sentences.slice(0, 2).join(" ").trim();
}

/**
 * Real web search — Wikipedia first (fast, reliable, CORS-safe).
 */
export async function searchWebReal(query: string): Promise<RealSearchResult | null> {
  const lexiconHit = tryAccountingLexicon(query);
  if (lexiconHit) return lexiconHit;

  const queries = expandSearchQueries(accountingSearchQuery(query));

  for (const q of queries) {
    const title = await wikiOpensearch(q);
    if (!title) continue;

    const wiki = await wikiExtract(title);
    if (!wiki) continue;

    const snippet = extractAnswerSnippet(wiki.extract, query);
    if (snippet) {
      return {
        answer: snippet,
        title,
        url: wiki.url,
        source: "wikipedia",
      };
    }
  }

  // Direct title guess (underscore form)
  for (const q of queries) {
    const titleGuess = q.replace(/\bpm\b/gi, "Prime Minister").replace(/ /g, "_");
    const wiki = await wikiExtract(titleGuess.replace(/_/g, " "));
    if (wiki) {
      const snippet = extractAnswerSnippet(wiki.extract, query);
      if (snippet) {
        return {
          answer: snippet,
          title: titleGuess.replace(/_/g, " "),
          url: wiki.url,
          source: "wikipedia",
        };
      }
    }
  }

  return null;
}

export function formatRealSearchAnswer(
  result: RealSearchResult,
  lang: "nepali" | "english" | "mixed",
): string {
  if (result.source === "lexicon") {
    return result.answer;
  }

  const intro =
    lang === "english"
      ? "🌐 I searched Wikipedia:\n\n"
      : "🌐 Maile Wikipedia bata khojera yo paye:\n\n";

  const source = result.url ? `\n\n📎 Source: ${result.url}` : "";

  return `${intro}**${result.title}**\n${result.answer}${source}`;
}
