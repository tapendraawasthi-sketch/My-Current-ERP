/**
 * Server-side DuckDuckGo Lite search — no API key required.
 * Used by serve.mjs and Vite dev middleware when erp_bot is offline.
 */

const DDG_LITE = "https://lite.duckduckgo.com/lite/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<b>/gi, "")
    .replace(/<\/b>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTargetUrl(href) {
  if (!href) return "";
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const parsed = new URL(absolute);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (parsed.hostname !== "duckduckgo.com") return parsed.toString();
  } catch {
    // fall through
  }
  return href;
}

function parseLiteResults(html, maxResults) {
  const results = [];
  const linkPattern =
    /<a[^>]*href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = linkPattern.exec(html)) && results.length < maxResults) {
    const href = match[1];
    const title = decodeHtml(match[2].replace(/<[^>]+>/g, " "));
    const tail = html.slice(match.index, match.index + 1200);
    const snippetMatch = tail.match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i);
    const snippet = snippetMatch
      ? decodeHtml(snippetMatch[1].replace(/<[^>]+>/g, " "))
      : title;
    const url = extractTargetUrl(href);

    if (!title && !snippet) continue;
    results.push({
      title: title || url,
      snippet: snippet.slice(0, 400),
      url,
      source: "duckduckgo",
      relevanceScore: Math.max(50, 85 - results.length * 5),
    });
  }

  return results;
}

/**
 * @param {string} query
 * @param {number} [maxResults=5]
 * @returns {Promise<object>}
 */
export async function searchWebViaDdgHtml(query, maxResults = 5) {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return {
      query: trimmed,
      results: [],
      searchedAt: new Date().toISOString(),
      sourcesUsed: [],
      totalResultsFound: 0,
      error: "Query cannot be empty",
    };
  }

  try {
    const searchUrl = `${DDG_LITE}?q=${encodeURIComponent(trimmed)}`;
    const resp = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!resp.ok) {
      throw new Error(`DuckDuckGo HTTP ${resp.status}`);
    }

    const html = await resp.text();
    const results = parseLiteResults(html, maxResults);

    return {
      query: trimmed,
      results,
      directAnswer: results[0]?.snippet,
      searchedAt: new Date().toISOString(),
      sourcesUsed: results.length ? ["duckduckgo"] : [],
      totalResultsFound: results.length,
      error: results.length ? undefined : "No web results found for this query.",
    };
  } catch (err) {
    return {
      query: trimmed,
      results: [],
      searchedAt: new Date().toISOString(),
      sourcesUsed: [],
      totalResultsFound: 0,
      error: err?.message || "Web search failed",
    };
  }
}
