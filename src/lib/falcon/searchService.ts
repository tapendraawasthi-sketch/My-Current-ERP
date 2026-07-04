// src/lib/falcon/searchService.ts
// Falcon AI — Multi-source Web Search Service
// Browser-safe, no external imports, CORS-proxied fetch only.

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: "wikipedia" | "duckduckgo" | "serper" | "brave" | "fallback";
  relevanceScore: number;
  publishDate?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  directAnswer?: string;
  relatedSearches?: string[];
  searchedAt: Date;
  sourcesUsed: string[];
  error?: string;
  totalResultsFound: number;
}

export interface SearchOptions {
  maxResults?: number;
  timeoutMs?: number;
  preferSource?: "wikipedia" | "duckduckgo";
  language?: string;
  safeSearch?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ALLORIGINS_RAW = "https://api.allorigins.win/raw?url=";
const DDG_BASE = "https://api.duckduckgo.com/";
const WIKI_SEARCH = "https://en.wikipedia.org/w/api.php";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY — Proxy a URL through allorigins to bypass CORS
// ─────────────────────────────────────────────────────────────────────────────

function proxyUrl(url: string): string {
  return `${ALLORIGINS_RAW}${encodeURIComponent(url)}`;
}

/**
 * Strips HTML tags and collapses whitespace from a raw HTML string.
 * Used to clean snippets from page fetches and Wikipedia extracts.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/s{2,}/g, " ")
    .trim();
}

/**
 * Truncates a string to maxLen characters, adding "…" if trimmed.
 */
function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  const clean = text.trim();
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen - 1) + "…";
}

/**
 * Deduplicates an array of SearchResult objects by their URL.
 * The first occurrence (highest score) is retained.
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key) || !r.url.startsWith("http")) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// searchDuckDuckGo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Searches DuckDuckGo Instant Answer API via an allorigins CORS proxy.
 * Handles Abstract, Answer, and RelatedTopics response shapes.
 * Returns an empty array on any network or parse failure.
 */
export async function searchDuckDuckGo(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    const ddgUrl = `${DDG_BASE}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(proxyUrl(ddgUrl), { signal });
    if (!resp.ok) return [];

    const data = await resp.json();
    const results: SearchResult[] = [];

    // ── Direct abstract answer (Wikipedia-backed or curated) ───────────
    const abstract: string = (data.AbstractText || "").trim();
    const abstractUrl: string = data.AbstractURL || "";
    if (abstract.length > 30) {
      results.push({
        title: data.Heading || query,
        snippet: truncate(abstract, 400),
        url: abstractUrl || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        source: "duckduckgo",
        relevanceScore: 90,
      });
    }

    // ── Instant calculator / fact answers ─────────────────────────────
    const instantAnswer: string = (data.Answer || "").trim();
    if (instantAnswer.length > 0 && instantAnswer !== abstract) {
      results.push({
        title: data.AnswerType ? `${data.AnswerType} Answer` : "Instant Answer",
        snippet: truncate(instantAnswer, 300),
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        source: "duckduckgo",
        relevanceScore: 88,
      });
    }

    // ── RelatedTopics array ────────────────────────────────────────────
    const topics: any[] = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
    for (const topic of topics.slice(0, 5)) {
      // Topics can be flat items or nested group objects
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: truncate(topic.Text.split(" - ")[0] || topic.Text, 80),
          snippet: truncate(topic.Text, 300),
          url: topic.FirstURL,
          source: "duckduckgo",
          relevanceScore: 65,
        });
      } else if (Array.isArray(topic.Topics)) {
        for (const sub of topic.Topics.slice(0, 2)) {
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: truncate(sub.Text.split(" - ")[0] || sub.Text, 80),
              snippet: truncate(sub.Text, 300),
              url: sub.FirstURL,
              source: "duckduckgo",
              relevanceScore: 58,
            });
          }
        }
      }
    }

    // ── Results array (not always populated) ──────────────────────────
    const rawResults: any[] = Array.isArray(data.Results) ? data.Results : [];
    for (const r of rawResults.slice(0, 3)) {
      if (r.Text && r.FirstURL) {
        results.push({
          title: truncate(r.Text, 80),
          snippet: truncate(r.Text, 300),
          url: r.FirstURL,
          source: "duckduckgo",
          relevanceScore: 72,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// searchWikipedia
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Two-step Wikipedia search:
 *   1. opensearch — finds up to 3 matching article titles + URLs
 *   2. extracts — fetches the intro paragraph of the best match
 * Returns results with source: 'wikipedia'. Never throws.
 */
export async function searchWikipedia(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    // Step 1 — opensearch (CORS-safe with origin=*)
    const openUrl = `${WIKI_SEARCH}?action=opensearch&search=${encodeURIComponent(query)}&limit=3&namespace=0&format=json&origin=*`;
    const openResp = await fetch(openUrl, { signal });
    if (!openResp.ok) return [];

    const openData: [string, string[], string[], string[]] = await openResp.json();
    const [, titles, descriptions, urls] = openData;
    if (!titles || titles.length === 0) return [];

    const results: SearchResult[] = [];

    // Step 2 — fetch extract for the top result
    const topTitle = titles[0];
    try {
      const extractUrl = `${WIKI_SEARCH}?action=query&titles=${encodeURIComponent(topTitle)}&prop=extracts&exintro=true&exchars=500&format=json&origin=*`;
      const extResp = await fetch(extractUrl, { signal });
      if (extResp.ok) {
        const extData = await extResp.json();
        const pages = extData?.query?.pages || {};
        const page = Object.values(pages)[0] as any;
        const extract = page?.extract ? stripHtml(page.extract) : descriptions[0] || "";
        if (extract.length > 10) {
          results.push({
            title: topTitle,
            snippet: truncate(extract, 400),
            url: urls[0] || `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`,
            source: "wikipedia",
            relevanceScore: 82,
          });
        }
      }
    } catch {
      // Extract failed — fall back to opensearch description
      if (descriptions[0]) {
        results.push({
          title: topTitle,
          snippet: truncate(descriptions[0], 300),
          url: urls[0] || "",
          source: "wikipedia",
          relevanceScore: 75,
        });
      }
    }

    // Add remaining opensearch results (titles 1 and 2) at lower confidence
    for (let i = 1; i < Math.min(titles.length, 3); i++) {
      if (titles[i] && urls[i]) {
        results.push({
          title: titles[i],
          snippet: truncate(descriptions[i] || titles[i], 250),
          url: urls[i],
          source: "wikipedia",
          relevanceScore: 68,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchPageSummary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a URL via allorigins CORS proxy, strips all HTML, and returns
 * the first 500 characters of clean text content. Returns empty string on error.
 */
export async function fetchPageSummary(url: string): Promise<string> {
  try {
    const resp = await fetch(proxyUrl(url), { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return "";
    const html = await resp.text();
    const clean = stripHtml(html);
    return truncate(clean, 500);
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// searchWeb — MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The main search function. Runs DuckDuckGo and Wikipedia in parallel,
 * optionally includes Brave Search if VITE_BRAVE_SEARCH_KEY is configured.
 * Deduplicates and sorts results by relevance score.
 * Individual strategy failures are silently absorbed — the function never throws.
 */
export async function searchWeb(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const {
    maxResults = 5,
    timeoutMs = 8000,
    preferSource,
    language = "en",
    safeSearch = true,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const { signal } = controller;

  const sourcesUsed: string[] = [];
  let directAnswer: string | undefined;
  let relatedSearches: string[] | undefined;
  const allResults: SearchResult[] = [];

  try {
    // ── Build parallel tasks ─────────────────────────────────────────────
    const tasks: Promise<SearchResult[]>[] = [];

    // Strategy 1 — DuckDuckGo (unless Wikipedia preferred exclusively)
    if (preferSource !== "wikipedia") {
      tasks.push(
        searchDuckDuckGo(query, signal)
          .then((r) => {
            if (r.length) sourcesUsed.push("duckduckgo");
            return r;
          })
          .catch(() => []),
      );
    }

    // Strategy 2 — Wikipedia
    if (preferSource !== "duckduckgo") {
      tasks.push(
        searchWikipedia(query, signal)
          .then((r) => {
            if (r.length) sourcesUsed.push("wikipedia");
            return r;
          })
          .catch(() => []),
      );
    }

    // Strategy 3 — Brave Search (only if API key env var is configured)
    const braveKey =
      typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BRAVE_SEARCH_KEY;
    if (braveKey) {
      tasks.push(
        fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
          {
            headers: { "X-Subscription-Token": braveKey, Accept: "application/json" },
            signal,
          },
        )
          .then(async (resp) => {
            if (!resp.ok) return [] as SearchResult[];
            const data = await resp.json();
            const braveResults: SearchResult[] = (data?.web?.results || [])
              .slice(0, 5)
              .map((r: any) => ({
                title: r.title || "",
                snippet: truncate(stripHtml(r.description || r.title || ""), 350),
                url: r.url || "",
                source: "brave" as const,
                relevanceScore: 78,
                publishDate: r.age || undefined,
              }));
            if (braveResults.length) sourcesUsed.push("brave");
            return braveResults;
          })
          .catch(() => [] as SearchResult[]),
      );
    }

    // ── Run in parallel ──────────────────────────────────────────────────
    const settled = await Promise.allSettled(tasks);
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        allResults.push(...outcome.value);
      }
    }

    // ── Extract directAnswer from the DDG abstract if present ────────────
    const topDdg = allResults.find((r) => r.source === "duckduckgo" && r.relevanceScore >= 88);
    if (topDdg) directAnswer = topDdg.snippet;

    // ── Deduplicate and sort ─────────────────────────────────────────────
    const deduped = deduplicateResults(allResults).sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );

    clearTimeout(timeoutId);

    return {
      query,
      results: deduped.slice(0, maxResults),
      directAnswer,
      relatedSearches,
      searchedAt: new Date(),
      sourcesUsed,
      totalResultsFound: deduped.length,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === "AbortError";
    return {
      query,
      results: allResults.slice(0, maxResults),
      searchedAt: new Date(),
      sourcesUsed,
      error: isAbort ? "Search timed out" : `Search failed: ${err?.message || "Unknown error"}`,
      totalResultsFound: allResults.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// formatSearchResultsForLLM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a SearchResponse into a compact, LLM-readable formatted string
 * suitable for injection into a system prompt or user message context block.
 */
export function formatSearchResultsForLLM(response: SearchResponse): string {
  if (!response.results.length && !response.directAnswer) {
    return `SEARCH RESULTS FOR: "${response.query}"nNo results found.${response.error ? ` (${response.error})` : ""}`;
  }

  const lines: string[] = [];
  lines.push(`SEARCH RESULTS FOR: "${response.query}"`);
  lines.push(
    `Searched at: ${response.searchedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`,
  );

  if (response.directAnswer) {
    lines.push("");
    lines.push(`DIRECT ANSWER: ${response.directAnswer}`);
  }

  if (response.results.length > 0) {
    lines.push("");
    lines.push("SOURCES:");
    const topResults = response.results.slice(0, 4);
    topResults.forEach((r, i) => {
      lines.push(`${i + 1}. [${r.title}] (${r.url})`);
      lines.push(`   ${r.snippet}`);
      if (r.publishDate) lines.push(`   Published: ${r.publishDate}`);
      lines.push("");
    });
  }

  if (response.relatedSearches && response.relatedSearches.length > 0) {
    lines.push(`Related: ${response.relatedSearches.slice(0, 4).join(", ")}`);
  }

  if (response.error) {
    lines.push(`Note: ${response.error}`);
  }

  return lines.join("n").trim();
}
